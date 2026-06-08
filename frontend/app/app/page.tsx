"use client";

import { useState, useEffect, useCallback } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { DocumentsSidebar } from "@/components/DocumentsSidebar";
import { useToast } from "@/components/Toast";
import { useDocuments } from "@/hooks/useDocuments";
import type { Message, ChatThread } from "@/lib/types";

export default function ChatApp() {
  const { showToast } = useToast();
  const {
    uploadedDocs,
    selectedDocIds,
    uploadError,
    setUploadError,
    handleToggleDoc,
    handleFileChange,
    handleRemoveDoc,
  } = useDocuments(showToast);

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load threads from localStorage on mount
  useEffect(() => {
    const storedThreads = localStorage.getItem("chat_threads");
    const storedActiveThreadId = localStorage.getItem("active_thread_id");

    if (storedThreads) {
      try {
        const parsed = JSON.parse(storedThreads);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setThreads(parsed);
        }
      } catch (e) {
        console.error("Failed to parse chat threads", e);
      }
    }

    if (storedActiveThreadId) {
      setActiveThreadId(storedActiveThreadId);
    }
  }, []);

  // Sync threads and activeThreadId to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && threads.length > 0) {
      localStorage.setItem("chat_threads", JSON.stringify(threads));
      if (activeThreadId) {
        localStorage.setItem("active_thread_id", activeThreadId);
      }
    }
  }, [threads, activeThreadId]);

  // Ensure there is always at least one active thread
  useEffect(() => {
    if (threads.length === 0) {
      const newThreadId = Date.now().toString();
      const newThread: ChatThread = {
        id: newThreadId,
        title: "New Chat",
        messages: [],
        createdAt: new Date().toISOString(),
      };
      setThreads([newThread]);
      setActiveThreadId(newThreadId);
    } else if (!activeThreadId || !threads.some((t) => t.id === activeThreadId)) {
      setActiveThreadId(threads[0].id);
    }
  }, [threads, activeThreadId]);

  const handleSelectThread = (threadId: string) => {
    setActiveThreadId(threadId);
  };

  const handleNewChat = () => {
    const newThreadId = Date.now().toString();
    const newThread: ChatThread = {
      id: newThreadId,
      title: "New Chat",
      messages: [],
      createdAt: new Date().toISOString(),
    };
    setThreads((prevThreads) => [newThread, ...prevThreads]);
    setActiveThreadId(newThreadId);
  };

  const handleDeleteThread = (threadId: string) => {
    const nextThreads = threads.filter((thread) => thread.id !== threadId);
    setThreads(nextThreads);
    if (activeThreadId === threadId) {
      if (nextThreads.length > 0) {
        setActiveThreadId(nextThreads[0].id);
      } else {
        setActiveThreadId(null);
      }
    }
  };

  const handleUpdateMessages = useCallback(
    (updater: Message[] | ((prev: Message[]) => Message[])) => {
      setThreads((prevThreads) =>
        prevThreads.map((thread) => {
          if (thread.id !== activeThreadId) return thread;
          const newMsgs =
            typeof updater === "function" ? updater(thread.messages) : updater;

          let newTitle = thread.title;
          if (thread.title === "New Chat" && newMsgs.length > 0) {
            const firstUserMsg = newMsgs.find((m) => m.role === "user");
            if (firstUserMsg) {
              newTitle = firstUserMsg.content.substring(0, 30);
              if (firstUserMsg.content.length > 30) newTitle += "...";
            }
          }

          return {
            ...thread,
            messages: newMsgs,
            title: newTitle,
          };
        })
      );
    },
    [activeThreadId]
  );

  const activeThreadMessages =
    threads.find((thread) => thread.id === activeThreadId)?.messages || [];

  return (
    <div className="app-layout">
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />

      <DocumentsSidebar
        uploadedDocs={uploadedDocs}
        selectedDocIds={selectedDocIds}
        uploadError={uploadError}
        onClearUploadError={() => setUploadError(null)}
        onToggleDoc={handleToggleDoc}
        onFileChange={handleFileChange}
        onRemoveDoc={handleRemoveDoc}
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={handleSelectThread}
        onDeleteThread={handleDeleteThread}
        onNewChat={handleNewChat}
        messages={activeThreadMessages}
        isLoading={isLoading}
      />

      <ChatPanel
        uploadedDocs={uploadedDocs}
        selectedDocIds={selectedDocIds}
        showToast={showToast}
        messages={activeThreadMessages}
        setMessages={handleUpdateMessages}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
      />
    </div>
  );
}