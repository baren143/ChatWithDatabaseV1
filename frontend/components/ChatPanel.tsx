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
import { useAuth } from "@/context/AuthContext";

interface ChatPanelProps {
  uploadedDocs: UploadedDoc[];
  selectedDocIds: string[];
  showToast: (message: string, type?: ToastType) => void;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  onGenerateReport?: () => void;
  onToggleSidebar: () => void;
}

function ChatPanelComponent({
  uploadedDocs,
  selectedDocIds,
  showToast,
  messages,
  setMessages,
  isLoading,
  setIsLoading,
  onGenerateReport,
  onToggleSidebar,
}: ChatPanelProps) {
  const { token } = useAuth();
  const [input, setInput] = useState("");
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
  }, [setMessages]);

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
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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


      
      <div style={{display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"0.5rem"}}>
        <button type="button" onClick={onToggleSidebar} className="mobile-menu-btn" aria-label="Toggle menu" style={{position:"sticky",top:0,zIndex:50}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div><div
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
            paddingTop: "1.5rem",
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

          {messages.length > 0 && onGenerateReport && (
            <div style={{ display: "flex", justifyContent: "flex-start", padding: "0 0.5rem" }}>
              <button
                type="button"
                onClick={onGenerateReport}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.4rem 0.9rem",
                  background: "rgba(59,130,246,0.1)",
                  border: "1px solid rgba(59,130,246,0.25)",
                  borderRadius: "0.6rem",
                  color: "#60a5fa",
                  fontSize: "0.8rem",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                📊 Generate Report
              </button>
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
