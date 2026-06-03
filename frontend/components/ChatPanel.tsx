"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { Message, UploadedDoc } from "@/lib/types";
import type { ToastType } from "@/components/Toast";
import { ChatMessage } from "@/components/ChatMessage";

interface ChatPanelProps {
  uploadedDocs: UploadedDoc[];
  selectedDocIds: string[];
  showToast: (message: string, type?: ToastType) => void;
}

function ChatPanelComponent({
  uploadedDocs,
  selectedDocIds,
  showToast,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isMutedRef = useRef(true);
  const streamRafRef = useRef<number | null>(null);
  const pendingStreamRef = useRef<{ id: string; content: string } | null>(null);

  const readyCount = uploadedDocs.filter((d) => d.status === "ready").length;
  const processingCount = uploadedDocs.filter(
    (d) => d.status === "uploading" || d.status === "processing"
  ).length;

  useEffect(() => {
    isMutedRef.current = isMuted;
    if (isMuted && typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [isMuted]);

  useEffect(() => {
    let recognition: SpeechRecognition | null = null;
    if (typeof window !== "undefined") {
      const SpeechRecognitionCtor =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionCtor) {
        recognition = new SpeechRecognitionCtor();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results[event.resultIndex][0].transcript;
          if (transcript) {
            setInput((prev) => {
              const cleanedPrev = prev.trim();
              return cleanedPrev ? `${cleanedPrev} ${transcript}` : transcript;
            });
          }
        };
        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          setIsListening(false);
          if (event.error === "not-allowed") {
            showToast(
              "Microphone access denied. Allow mic access in your browser settings.",
              "error"
            );
          } else if (event.error === "no-speech") {
            showToast("No speech detected. Check your microphone and try again.", "info");
          } else if (event.error === "network") {
            showToast("Voice input requires an active internet connection.", "error");
          } else if (event.error !== "aborted") {
            showToast(`Voice recognition error: ${event.error}`, "error");
          }
        };
        recognition.onend = () => setIsListening(false);
        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognition) {
        try {
          recognition.abort();
        } catch {
          // already stopped
        }
      }
      if (streamRafRef.current !== null) {
        cancelAnimationFrame(streamRafRef.current);
      }
    };
  }, [showToast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isLoading]);

  const flushStreamingUpdate = useCallback(() => {
    streamRafRef.current = null;
    const pending = pendingStreamRef.current;
    if (!pending) return;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === pending.id ? { ...m, content: pending.content } : m
      )
    );
  }, []);

  const scheduleStreamingUpdate = useCallback(
    (assistantId: string, content: string) => {
      pendingStreamRef.current = { id: assistantId, content };
      if (streamRafRef.current === null) {
        streamRafRef.current = requestAnimationFrame(flushStreamingUpdate);
      }
    },
    [flushStreamingUpdate]
  );

  const speakText = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    if (isMutedRef.current) return;

    const cleanText = text
      .replace(/[*_`#|]/g, "")
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
      .replace(/https?:\/\/\S+/g, "link")
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "en-US";

    const voices = window.speechSynthesis.getVoices();
    const premiumVoice =
      voices.find(
        (v) =>
          v.name.includes("Google US English") ||
          v.name.includes("Natural") ||
          (v.lang === "en-US" && v.name.includes("Microsoft Zira")) ||
          (v.lang === "en-US" && v.name.includes("Samantha"))
      ) || voices.find((v) => v.lang.startsWith("en"));

    if (premiumVoice) utterance.voice = premiumVoice;
    window.speechSynthesis.speak(utterance);
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      showToast(
        "Speech recognition is not supported in this browser. Try Chrome or Edge.",
        "info"
      );
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      window.speechSynthesis?.cancel();
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
      }
    }
  }, [isListening, showToast]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setInput("");
    window.speechSynthesis?.cancel();
  }, []);

  const handleClearHistory = useCallback(() => {
    setMessages([]);
    setInput("");
    setShowClearConfirm(false);
    window.speechSynthesis?.cancel();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    window.speechSynthesis?.cancel();
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    const historySnapshot = messages.slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const readyDocIds = uploadedDocs.filter((d) => d.status === "ready").map((d) => d.id);
    let targetDocIds: string[] | undefined;

    if (selectedDocIds.length > 0) {
      const unreadyDocs = uploadedDocs.filter(
        (d) => selectedDocIds.includes(d.id) && d.status !== "ready"
      );
      if (unreadyDocs.length > 0) {
        const names = unreadyDocs.map((d) => `"${d.name}"`).join(", ");
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `⏳ Some of the selected documents (${names}) are still being processed. Please wait until they show "Ready" before asking questions.`,
          },
        ]);
        setIsLoading(false);
        return;
      }
      targetDocIds = selectedDocIds;
    } else {
      targetDocIds = readyDocIds.length > 0 ? readyDocIds : undefined;
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          document_ids: targetDocIds,
          history: historySnapshot,
        }),
      });

      if (response.ok && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";
        const assistantId = (Date.now() + 1).toString();

        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "" },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assistantContent += decoder.decode(value, { stream: true });
          scheduleStreamingUpdate(assistantId, assistantContent);
        }

        if (streamRafRef.current !== null) {
          cancelAnimationFrame(streamRafRef.current);
          streamRafRef.current = null;
        }
        pendingStreamRef.current = { id: assistantId, content: assistantContent };
        flushStreamingUpdate();

        speakText(assistantContent);
      } else {
        const errText = await response.text();
        const message =
          response.status >= 500
            ? "Server error while generating a response. Please try again."
            : errText || "Chat request failed. Is the backend running?";
        showToast(message, "error");
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `⚠️ ${message}`,
          },
        ]);
      }
    } catch (err) {
      const message = `Network error: ${String(err)}`;
      showToast(message, "error");
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `⚠️ ${message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="main-chat-view">
      {showClearConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "fadeInUp 0.2s ease",
          }}
        >
          <div
            style={{
              background: "rgba(15,20,35,0.95)",
              border: "1px solid rgba(248,113,113,0.3)",
              borderRadius: "1.25rem",
              padding: "2rem 2.25rem",
              maxWidth: "380px",
              width: "90%",
              boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "rgba(248,113,113,0.1)",
                  border: "1px solid rgba(248,113,113,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#f87171"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: "700", color: "#fff" }}>
                  Clear Chat History?
                </h3>
                <p
                  style={{
                    margin: "0.25rem 0 0",
                    fontSize: "0.82rem",
                    color: "var(--text-secondary)",
                    lineHeight: "1.45",
                  }}
                >
                  This will remove all {messages.length} messages from this conversation. Your
                  uploaded documents will not be affected.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                style={{
                  padding: "0.55rem 1.1rem",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "0.6rem",
                  color: "var(--text-secondary)",
                  fontSize: "0.85rem",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearHistory}
                style={{
                  padding: "0.55rem 1.1rem",
                  background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                  border: "none",
                  borderRadius: "0.6rem",
                  color: "white",
                  fontSize: "0.85rem",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={handleNewChat}
          disabled={messages.length === 0 || isLoading}
          style={{
            padding: "0.5rem 0.9rem",
            background: "rgba(59, 130, 246, 0.08)",
            border: "1px solid rgba(59, 130, 246, 0.25)",
            borderRadius: "0.75rem",
            color: "#60a5fa",
            opacity: messages.length === 0 || isLoading ? 0.4 : 1,
            fontSize: "0.82rem",
            fontWeight: "600",
            cursor: messages.length === 0 || isLoading ? "not-allowed" : "pointer",
          }}
        >
          New Chat
        </button>
        <button
          type="button"
          onClick={() => setShowClearConfirm(true)}
          disabled={messages.length === 0 || isLoading}
          style={{
            padding: "0.5rem 0.9rem",
            background: "rgba(248, 113, 113, 0.06)",
            border: "1px solid rgba(248, 113, 113, 0.2)",
            borderRadius: "0.75rem",
            color: "#f87171",
            opacity: messages.length === 0 || isLoading ? 0.4 : 1,
            fontSize: "0.82rem",
            fontWeight: "600",
            cursor: messages.length === 0 || isLoading ? "not-allowed" : "pointer",
          }}
        >
          Clear History
        </button>
      </div>

      <div
        style={{
          flex: 1,
          position: "relative",
          width: "100%",
          minHeight: 0,
          marginBottom: "1.25rem",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            paddingRight: "0.5rem",
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)",
                textAlign: "center",
                padding: "2rem",
              }}
            >
              <div
                style={{
                  maxWidth: "420px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "1.25rem",
                }}
              >
                <div
                  style={{
                    width: "72px",
                    height: "72px",
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)",
                    border: "1px solid var(--border-neon)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 8px 30px rgba(59, 130, 246, 0.15)",
                    animation: "floatAmbient 5s infinite ease-in-out",
                  }}
                >
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: "#3b82f6" }}
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "1.35rem",
                      fontWeight: "800",
                      color: "#fff",
                      letterSpacing: "0.3px",
                    }}
                  >
                    Cognitive Document Workspace
                  </h3>
                  <p
                    style={{
                      margin: "0.5rem 0 0",
                      fontSize: "0.875rem",
                      color: "var(--text-secondary)",
                      lineHeight: "1.5",
                    }}
                  >
                    Upload files to your library, select them to target queries, or search
                    everything at once.
                  </p>
                </div>
              </div>
            </div>
          )}

          {messages.map((m) => (
            <ChatMessage key={m.id} message={m} />
          ))}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div
                className="msg-bubble msg-bubble-assistant"
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "#3b82f6",
                    animation: "pulseGlow 1s infinite",
                  }}
                />
                <span>Thinking…</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="chat-input-bar">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="chat-text-input"
          placeholder={
            readyCount > 0
              ? `Ask about ${selectedDocIds.length > 0 ? `${selectedDocIds.length} targeted database(s)` : `${readyCount} database(s)`}…`
              : processingCount > 0
                ? "Waiting for processing to complete…"
                : "Upload a document first to start chatting…"
          }
          disabled={isLoading}
        />

        <button
          type="button"
          onClick={() => setIsMuted(!isMuted)}
          className={`voice-btn ${!isMuted ? "active-speaker" : ""}`}
          title={isMuted ? "Unmute voice feedback" : "Mute voice feedback"}
        >
          {isMuted ? "🔇" : "🔊"}
        </button>

        <button
          type="button"
          onClick={toggleListening}
          className={`voice-btn ${isListening ? "active-mic" : ""}`}
          title={isListening ? "Stop listening" : "Start voice input"}
        >
          {isListening ? "⏹" : "🎤"}
        </button>

        <button type="submit" disabled={isLoading || !input.trim()} className="chat-send-btn">
          {isLoading ? "…" : "Send"}
        </button>
      </form>
    </main>
  );
}

export const ChatPanel = memo(ChatPanelComponent);
