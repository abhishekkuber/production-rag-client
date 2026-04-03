"use client";

import { use, useEffect, useState, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ChatWithMessages, Message } from "@/lib/types";
import { apiClient } from "@/lib/api";
import { MessageFeedbackModal } from "@/components/chat/MessageFeedbackModel";
import toast from "react-hot-toast";
import { NotFound } from "@/components/ui/NotFound";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ProjectChatPageProps {
  params: Promise<{
    projectId: string;
    chatId: string;
  }>;
}

export default function ProjectChatPage({ params }: ProjectChatPageProps) {
  const { projectId, chatId } = use(params);

  const [currentChatData, setCurrentChatData] =
    useState<ChatWithMessages | null>(null);

  const [isLoadingChatData, setIsLoadingChatData] = useState(true);

  const [sendMessageError, setSendMessageError] = useState<string | null>(null);
  const [isMessageSending, setIsMessageSending] = useState(false);

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [agentStatus, setAgentStatus] = useState("");

  // Ref to abort streaming if needed
  const abortControllerRef = useRef<AbortController | null>(null);

  // Ref to track first token
  const firstTokenRef = useRef(true);

  const [feedbackModal, setFeedbackModal] = useState<{
    messageId: string;
    type: "like" | "dislike";
  } | null>(null);

  const { getToken, userId } = useAuth();

  // Send message function with streaming
  const handleSendMessage = async (content: string) => {
    if (!currentChatData || !userId) {
      setSendMessageError("Chat or user not found");
      return;
    }

    // Reset states
    setSendMessageError(null);
    setIsMessageSending(true);
    setIsStreaming(false);
    setStreamingMessage("");
    setAgentStatus("");
    firstTokenRef.current = true;

    // Create optimistic user message
    // If we dont have this, what happens is that the
    // local state is changed only after the API returns the
    // human message and the API response
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      content: content,
      role: "user",
      created_at: new Date().toISOString(),
      chat_id: currentChatData.id,
      clerk_id: userId,
      citations: [],
    };

    // Add user message to UI immediately
    setCurrentChatData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [...prev.messages, optimisticMessage],
      };
    });

    try {
      // Send POST request to create message
      const token = await getToken();
      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      // Build the streaming URL with query params
      const streamUrl = new URL(
        `${API_BASE_URL}/api/projects/${projectId}/chats/${currentChatData.id}/messages/stream`,
      );
      streamUrl.searchParams.set("token", token || "");
      streamUrl.searchParams.set("clerk_id", userId);

      const response = await fetch(streamUrl.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        let eventType = "";
        let eventData = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            eventData = line.slice(6);

            // Process the event
            if (eventType && eventData) {
              try {
                const data = JSON.parse(eventData);

                switch (eventType) {
                  case "status":
                    setAgentStatus(data.status);
                    break;

                  case "token":
                    if (firstTokenRef.current) {
                      setIsMessageSending(false);
                      setIsStreaming(true);
                      firstTokenRef.current = false;
                    }
                    setStreamingMessage((prev) => prev + data.content);
                    setAgentStatus("");
                    break;

                  case "done":
                    // Replace optimistic message with real messages
                    setCurrentChatData((prev) => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        messages: [
                          ...prev.messages.filter(
                            (msg) => msg.id !== optimisticMessage.id,
                          ),
                          data.userMessage,
                          data.aiMessage,
                        ],
                      };
                    });
                    setIsStreaming(false);
                    setStreamingMessage("");
                    setAgentStatus("");
                    toast.success("Message sent");
                    break;

                  case "error":
                    throw new Error(data.message || "Stream error");
                }
              } catch (parseError) {
                // If it's a JSON parse error, log and continue
                if (parseError instanceof SyntaxError) {
                  console.warn("Failed to parse SSE data:", eventData);
                } else {
                  throw parseError;
                }
              }
            }

            // Reset for next event
            eventType = "";
            eventData = "";
          }
        }
      }
    } catch (err) {
      setSendMessageError("Failed to send message");
      toast.error("Failed to send message");
    } finally {
      setIsMessageSending(false);
      setIsStreaming(false);
      setStreamingMessage("");
      setAgentStatus("");
      abortControllerRef.current = null;
    }
  };

  const handleFeedbackOpen = (messageId: string, type: "like" | "dislike") => {
    setFeedbackModal({ messageId, type });
  };

  const handleFeedbackSubmit = async (feedback: {
    rating: "like" | "dislike";
    comment?: string;
    category?: string;
  }) => {
    if (!userId || !feedbackModal) return;

    try {
      const token = await getToken();

      await apiClient.post(
        "/api/feedback",
        {
          message_id: feedbackModal.messageId,
          rating: feedback.rating,
          comment: feedback.comment,
          category: feedback.category,
        },
        token,
      );

      toast.success("Thanks for your feedback!");
    } catch (error) {
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setFeedbackModal(null);
    }
  };

  useEffect(() => {
    const loadChat = async () => {
      if (!userId) return;

      setIsLoadingChatData(true);

      try {
        const token = await getToken();
        const result = await apiClient.get(`/api/chats/${chatId}`, token);
        const chatData = result.data;

        setCurrentChatData(chatData);
        toast.success("Chat loaded");
      } catch (err) {
        toast.error("Failed to load chat. Please try again.");
      } finally {
        setIsLoadingChatData(false);
      }
    };

    loadChat();
  }, [userId, chatId, projectId, getToken]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  if (isLoadingChatData) {
    return <LoadingSpinner message="Loading chat..." />;
  }

  if (!currentChatData) {
    return <NotFound message="Chat not found" />;
  }

  return (
    <>
      <ChatInterface
        chat={currentChatData}
        projectId={projectId}
        onSendMessage={handleSendMessage}
        onFeedback={handleFeedbackOpen}
        isLoading={isMessageSending}
        error={sendMessageError}
        onDismissError={() => setSendMessageError(null)}
        isStreaming={isStreaming}
        streamingMessage={streamingMessage}
        agentStatus={agentStatus}
      />
      <MessageFeedbackModal
        isOpen={!!feedbackModal}
        feedbackType={feedbackModal?.type}
        onSubmit={handleFeedbackSubmit}
        onClose={() => setFeedbackModal(null)}
      />
    </>
  );
}
