"use client";

import { ConversationsList } from "@/components/projects/ConversationsList";
import { FileDetailsModal } from "@/components/projects/FileDetailsModal";
import { KnowledgeBaseSidebar } from "@/components/projects/KnowledgeBaseSidebar";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { NotFound } from "@/components/ui/NotFound";
import { apiClient } from "@/lib/api";
import { useAuth } from "@clerk/nextjs";
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
    } finally {
    }
  };

  // not an async function
  const handleChatClick = (chatId: string) => {
    console.log(`Redirecting you to chat ${chatId}`);
  };

  // Document related methods
  const handleDocumentUpload = async (files: File[]) => {
    console.log(`Uploaded ${files.length} files`);
  };

  const handleDocumentDelete = async (documentId: string) => {
    console.log(`Document ${documentId} deleted`);
  };

  const handleUrlAdd = async (url: string) => {
    console.log(`Handling url : ${url}`);
  };

  const handleOpenDocument = (documentId: string) => {
    console.log(`Showing pipeline for document ${documentId}`);
    setSelectedDocumentId(documentId);
  };

  // Project settings methods
  const handleDraftSettings = (updates: any) => {
    console.log("Update local state with draft settings", updates);
  };

  const handlePublishSettings = async () => {
    console.log("Making API call to publish settings");
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
