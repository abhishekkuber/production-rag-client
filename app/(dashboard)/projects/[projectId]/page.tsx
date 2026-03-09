"use client";

import { ConversationsList } from "@/components/projects/ConversationsList";
import { FileDetailsModal } from "@/components/projects/FileDetailsModal";
import { KnowledgeBaseSidebar } from "@/components/projects/KnowledgeBaseSidebar";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { NotFound } from "@/components/ui/NotFound";
import { apiClient } from "@/lib/api";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Project, Chat, ProjectDocument, ProjectSettings } from "@/lib/types";

interface ProjectPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

// we need the schema for the data
interface ProjectData {
  project: Project | null;
  chats: Chat[];
  documents: ProjectDocument[];
  settings: ProjectSettings | null;
}

function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = use(params);
  const { getToken, userId } = useAuth();
  const router = useRouter();

  // think about how we store the 4 different data we get from the diff apis.
  // we can 4 different usestates, but we just use 1 useState that holds all diff values
  // we need all 4 apis data to build the page
  const [data, setData] = useState<ProjectData>({
    project: null,
    chats: [],
    documents: [],
    settings: null,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);

  // UI States
  const [activeTab, setActiveTab] = useState<"documents" | "settings">(
    "documents",
  );

  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null,
  );

  // Load all data
  useEffect(() => {
    const loadAllData = async () => {
      if (!userId) {
        return;
      }

      try {
        setError(null);
        setLoading(true);
        const token = await getToken();

        const [
          projectResponse,
          chatsResponse,
          documentsResponse,
          projectSettingsResponse,
        ] = await Promise.all([
          apiClient.get(`/api/projects/${projectId}`, token),
          apiClient.get(`/api/projects/${projectId}/chats`, token),
          apiClient.get(`/api/projects/${projectId}/files`, token),
          apiClient.get(`/api/projects/${projectId}/settings`, token),
        ]);

        setData({
          project: projectResponse.data,
          chats: chatsResponse.data,
          documents: documentsResponse.data,
          settings: projectSettingsResponse.data,
        });

        // you can make api calls sequentially, or do it parallely using promise.all
      } catch (err) {
        setError("Failed to fetch data");
        toast.error("Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };
    loadAllData();
  }, [userId, projectId]);

  (useEffect(() => {
    // Go through all documents and see if they are done processing
    const hasProcessingDocuments = data.documents.some(
      (doc) =>
        doc.processing_status &&
        !["completed", "failed"].includes(doc.processing_status),
    );

    if (!hasProcessingDocuments) {
      return;
    }

    // Short polling every 3 seconds
    const pollInterval = setInterval(async () => {
      try {
        const token = await getToken();
        const documentResponse = await apiClient.get(
          `/api/projects/${projectId}/files`,
          token,
        );
        setData((prev) => ({
          ...prev,
          documents: documentResponse.data,
        }));
      } catch (err) {
        console.log("Polling error: ", err);
      }
    }, 3000);
    return () => clearInterval(pollInterval);
  }),
    [data.documents, projectId, userId]);

  // Chat related methods
  const handleCreateNewChat = async () => {
    if (!userId) return; // check if user is logged in

    try {
      setIsCreatingChat(true);
      const token = await getToken();
      const chatNumber = Date.now() % 10000;
      const result = await apiClient.post(
        "/api/chats",
        {
          title: `Chat ${chatNumber}`,
          project_id: projectId,
        },
        token,
      );
      const createdChat = result?.data || {};
      setData((prev) => ({
        ...prev,
        chats: [createdChat, ...prev.chats],
      }));

      toast.success("Chat created successfully");
      router.push(`/projects/${projectId}/chats/${createdChat.id}`);
    } catch (err) {
      toast.error("Failed to create chat");
      console.error("Error creating chat", err);
    } finally {
      setIsCreatingChat(false);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!userId) return;
    try {
      const token = await getToken();
      const result = await apiClient.delete(`/api/chats/${chatId}`, token);
      const deletedChat = result?.data || {};
      setData((prev) => ({
        ...prev,
        chats: prev.chats.filter((obj) => obj.id !== chatId),
      }));
      toast.success("Chat deleted successfully");
    } catch (err) {
      toast.error("Failed to delete chat");
      console.error("Error deleting chat", err);
    }
  };

  // not an async function
  const handleChatClick = async (chatId: string) => {
    console.log(`Redirecting you to chat ${chatId}`);
    router.push(`/projects/${projectId}/chats/${chatId}`);
  };

  // Document related methods
  const handleDocumentUpload = async (files: File[]) => {
    if (!userId) return;

    try {
      const token = await getToken();
      const uploadedDocuments: ProjectDocument[] = [];

      // Async because we make API calls in the callback function
      const uploadPromises = files.map(async (file) => {
        try {
          // Get the presigned_url for each file
          const uploadData = await apiClient.post(
            `/api/projects/${projectId}/file/upload-url`,
            {
              filename: file.name,
              file_size: file.size,
              file_type: file.type,
            },
            token,
          );

          const { upload_url, s3_key } = uploadData.data;

          // Then make an API call to S3, and then upload those files to S3
          await apiClient.uploadToS3(upload_url, file);

          // Confirm upload to the server. Client should notify the server.
          // This is so that the server can change the processing_status of a document
          const updatedDocument = await apiClient.post(
            `/api/projects/${projectId}/file/confirm`,
            {
              s3_key: s3_key,
            },
            token,
          );

          uploadedDocuments.push(updatedDocument.data);
        } catch (err) {
          console.error(`Failed to upload ${file.name}`);
        }
      });

      // Only once all the promises have settled, we move on to the next code
      await Promise.allSettled(uploadPromises);

      // // Update local state with successfully uploaded documents
      if (uploadedDocuments.length > 0) {
        setData((prev) => ({
          ...prev,
          documents: [...uploadedDocuments, ...prev.documents],
        }));
      }
      toast.success(`Uploaded ${uploadedDocuments.length} file(s)`);
    } catch (err) {}
  };

  const handleDocumentDelete = async (documentId: string) => {
    console.log(`Document ${documentId} deleted`);
    if (!userId) return;

    try {
      const token = await getToken();
      await apiClient.delete(
        `/api/projects/${projectId}/files/${documentId}`,
        token,
      );

      // remove it from the local state
      setData((prev) => ({
        ...prev,
        documents: prev.documents.filter((obj) => obj.id !== documentId),
      }));

      toast.success("Document deleted successfully");
    } catch (err) {
      toast.error("Document deletion failed");
    }
  };

  const handleUrlAdd = async (url: string) => {
    console.log(`Handling url : ${url}`);
    if (!userId) return;
    try {
      const token = await getToken();
      const result = await apiClient.post(
        `/api/projects/${projectId}/urls`,
        {
          url: url,
        },
        token,
      );
      const newDocument = result.data;

      // update the local react state
      setData((prev) => ({
        ...prev,
        documents: [newDocument, ...prev.documents],
      }));
      toast.success("URL added successfully");
    } catch (err) {
      toast.error("Failed to add URL");
      console.error("Error adding URL", err);
    }
  };

  const handleOpenDocument = (documentId: string) => {
    console.log(`Showing pipeline for document ${documentId}`);
    setSelectedDocumentId(documentId);
  };

  // Project settings methods
  const handleDraftSettings = (updates: any) => {
    // console.log("Update local state with draft settings", updates);
    setData((prev) => {
      // If no previous settings exist yet, log a warning message
      if (!prev.settings) {
        console.warn("Cannot update settings: not loaded yet");
        return prev;
      }

      // Merge the updates into existing settings
      return {
        ...prev, // copy all top level fields from prev into the new object
        settings: {
          // explicitly set the settings field in the new object
          ...prev.settings, // copy all existing settings first
          ...updates, // copy fields from updates. if a key exists in both prev.settings and updates, then the ones in updates win
        },
      };
      // NOTE : Later spreads / properties override earlier ones when keys collide
    });
  };

  const handlePublishSettings = async () => {
    console.log(data.settings);
    if (!userId || !data.settings) {
      toast.error("Cannot save settings");
    }

    try {
      const token = await getToken();
      const result = await apiClient.put(
        `/api/projects/${projectId}/settings`,
        data.settings,
        token,
      );
      setData((prev) => ({
        ...prev,
        settings: result.data,
      }));
      toast.success("Settings saved successfully");
    } catch (err) {
      toast.error("Failed to save settings");
      console.error("Error saving settings", err);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading Project"></LoadingSpinner>;
  }

  if (!data.project) {
    return <NotFound message="Project not found"></NotFound>;
  }

  const selectedDocument = selectedDocumentId
    ? data.documents.find((doc) => doc.id == selectedDocumentId)
    : null;

  return (
    <div>
      <>
        <div className="flex h-screen bg-[#0d1117] gap-4 p-4">
          <ConversationsList
            project={data.project}
            conversations={data.chats}
            error={error}
            loading={isCreatingChat}
            onCreateNewChat={handleCreateNewChat}
            onChatClick={handleChatClick}
            onDeleteChat={handleDeleteChat}
          />

          {/* KnowledgeBase Sidebar */}
          <KnowledgeBaseSidebar
            activeTab={activeTab}
            onSetActiveTab={setActiveTab}
            projectDocuments={data.documents}
            onDocumentUpload={handleDocumentUpload}
            onDocumentDelete={handleDocumentDelete}
            onOpenDocument={handleOpenDocument}
            onUrlAdd={handleUrlAdd}
            projectSettings={data.settings}
            settingsError={null}
            settingsLoading={false}
            onUpdateSettings={handleDraftSettings}
            onApplySettings={handlePublishSettings}
          />
        </div>
        {selectedDocument && (
          <FileDetailsModal
            document={selectedDocument}
            onClose={() => setSelectedDocumentId(null)}
          />
        )}
      </>
    </div>
  );
}

export default ProjectPage;
