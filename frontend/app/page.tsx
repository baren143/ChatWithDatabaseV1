"use client";
import { useState, useEffect, useRef } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

type DocStatus = "uploading" | "processing" | "ready" | "error";

interface UploadedDoc {
  id: string;
  name: string;
  status: DocStatus;
  totalChunks?: number;
  processedChunks?: number;
}

const STATUS_STYLES: Record<DocStatus, { bg: string; color: string; label: string; borderColor: string }> = {
  uploading:   { bg: "rgba(59, 130, 246, 0.1)", color: "#60a5fa", label: "Uploading", borderColor: "rgba(59, 130, 246, 0.25)" },
  processing:  { bg: "rgba(139, 92, 246, 0.1)", color: "#c084fc", label: "Processing", borderColor: "rgba(139, 92, 246, 0.25)" },
  ready:       { bg: "rgba(52, 211, 153, 0.1)", color: "#34d399", label: "Ready", borderColor: "rgba(52, 211, 153, 0.25)" },
  error:       { bg: "rgba(248, 113, 113, 0.1)", color: "#f87171", label: "Error", borderColor: "rgba(248, 113, 113, 0.25)" },
};

// ── Markdown renderer ────────────────────────────────────────────────────────
// Converts LLM markdown output (numbered lists, tables, bold) into HTML.
function renderContent(text: string): string {
  const lines = text.split("\n");
  const output: string[] = [];
  let inTable = false;
  let tableHeaderDone = false;
  let inList = false;

  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const renderInline = (s: string) =>
    escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");

  const isTableRow = (l: string) => l.trim().startsWith("|") && l.trim().endsWith("|");
  const isSeparator = (l: string) => /^\|[\s|:-]+\|$/.test(l.trim());

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    if (isTableRow(line)) {
      if (isSeparator(line)) {
        // This is the header/separator divider line — skip it
        tableHeaderDone = true;
        continue;
      }
      if (!inTable) {
        // Close any open list first
        if (inList) { output.push("</ol>"); inList = false; }
        output.push('<div style="overflow-x:auto;margin:0.6rem 0"><table class="md-table"><thead><tr>');
        inTable = true;
        tableHeaderDone = false;
        // First table row = header
        const cells = line.split("|").slice(1, -1);
        cells.forEach(c => output.push(`<th>${renderInline(c.trim())}</th>`));
        output.push("</tr></thead><tbody>");
      } else if (tableHeaderDone) {
        // Data row
        output.push("<tr>");
        const cells = line.split("|").slice(1, -1);
        cells.forEach(c => output.push(`<td>${renderInline(c.trim())}</td>`));
        output.push("</tr>");
      }
      continue;
    }

    // Close table if we leave it
    if (inTable) {
      output.push("</tbody></table></div>");
      inTable = false;
      tableHeaderDone = false;
    }

    // Numbered list item: "1. text"
    const numMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      if (!inList) { output.push('<ol class="md-list">'); inList = true; }
      output.push(`<li>${renderInline(numMatch[2])}</li>`);
      continue;
    }

    // Close list if non-list line
    if (inList) { output.push("</ol>"); inList = false; }

    // Blank line
    if (!line) { output.push("<br/>"); continue; }

    // Heading: ## text
    if (line.startsWith("### ")) { output.push(`<h4 class="md-h4">${renderInline(line.slice(4))}</h4>`); continue; }
    if (line.startsWith("## "))  { output.push(`<h3 class="md-h3">${renderInline(line.slice(3))}</h3>`); continue; }
    if (line.startsWith("# "))   { output.push(`<h2 class="md-h2">${renderInline(line.slice(2))}</h2>`); continue; }

    // Plain paragraph
    output.push(`<p class="md-p">${renderInline(line)}</p>`);
  }

  if (inTable)  output.push("</tbody></table></div>");
  if (inList)   output.push("</ol>");

  return output.join("");
}

export default function Home() {
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  const handleToggleDoc = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };
  const [isDocsExpanded, setIsDocsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const pollingRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice Chat States & Refs
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const recognitionRef = useRef<any>(null);
  const isMutedRef = useRef(true);

  // Sync isMuted state with its Ref and stop any ongoing speech if muted
  useEffect(() => {
    isMutedRef.current = isMuted;
    if (isMuted && typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [isMuted]);

  // Speech Recognition (Speech-to-Text) Setup
  useEffect(() => {
    let recognition: any = null;
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onstart = () => {
          setIsListening(true);
          setUploadError(null); // Clear any previous errors
        };

        recognition.onresult = (event: any) => {
          const transcript = event.results[event.resultIndex][0].transcript;
          if (transcript) {
            setInput((prev) => {
              const cleanedPrev = prev.trim();
              return cleanedPrev ? `${cleanedPrev} ${transcript}` : transcript;
            });
          }
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
          
          if (event.error === "not-allowed") {
            setUploadError("Microphone access denied. Please click the camera/mic icon in your browser address bar and choose 'Allow'.");
          } else if (event.error === "no-speech") {
            setUploadError("No speech detected. Please check your microphone connection and try again.");
          } else if (event.error === "network") {
            setUploadError("Network connection error. Speech recognition requires an active internet connection.");
          } else if (event.error === "aborted") {
            // Dictation was stopped manually, no need to show error banner
          } else {
            setUploadError(`Voice recognition error: ${event.error}`);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }

    // Cleanup on component unmount to prevent multiple active instances
    return () => {
      if (recognition) {
        try {
          recognition.abort();
        } catch (e) {
          // ignore already stopped instances
        }
      }
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please try Chrome, Edge, or Safari.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      // Cancel active speech synthesis when starting to speak/record
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
      }
    }
  };

  // Speech Synthesis (Text-to-Speech) helper
  const speakText = (text: string) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();

      if (isMutedRef.current) return;

      // Strip out markdown tags and URLs so they are not read aloud
      const cleanText = text
        .replace(/[*_`#|]/g, "") // markdown tags
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1") // link text
        .replace(/https?:\/\/\S+/g, "link") // replace urls with "link"
        .trim();

      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = "en-US";

      // Dynamically select a natural-sounding voice if available
      const voices = window.speechSynthesis.getVoices();
      const premiumVoice = voices.find(
        (v) =>
          v.name.includes("Google US English") ||
          v.name.includes("Natural") ||
          (v.lang === "en-US" && v.name.includes("Microsoft Zira")) ||
          (v.lang === "en-US" && v.name.includes("Samantha"))
      ) || voices.find((v) => v.lang.startsWith("en"));

      if (premiumVoice) {
        utterance.voice = premiumVoice;
      }

      window.speechSynthesis.speak(utterance);
    }
  };

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Cleanup all polling intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(pollingRef.current).forEach(clearInterval);
    };
  }, []);

  // Fetch existing documents on mount and start polling if any are processing
  useEffect(() => {
    async function fetchDocs() {
      try {
        const res = await fetch("/api/documents");
        if (res.ok) {
          const data = await res.json();
          const docs: UploadedDoc[] = data.map((d: any) => ({
            id: d.id,
            name: d.file_name,
            status: d.status as DocStatus,
            totalChunks: d.total_chunks,
            processedChunks: d.processed_chunks,
          }));
          setUploadedDocs(docs);

          // Poll for any doc still processing/uploading
          docs.forEach((doc) => {
            if (doc.status === "processing" || doc.status === "uploading") {
              startPolling(doc.id);
            }
          });
        }
      } catch (err) {
        console.error("Failed to load documents:", err);
      }
    }
    fetchDocs();
  }, []);

  /** Poll /api/documents/{id} every 3 s until status is no longer "processing". */
  function startPolling(docId: string) {
    // Clear any existing interval for this doc
    if (pollingRef.current[docId]) clearInterval(pollingRef.current[docId]);

    pollingRef.current[docId] = setInterval(async () => {
      try {
        const res = await fetch(`/api/documents/${docId}`);
        if (!res.ok) return;
        const data = await res.json();
        const status: DocStatus = data.status === "ready"
          ? "ready"
          : data.status === "error"
          ? "error"
          : "processing";

        setUploadedDocs((prev) =>
          prev.map((d) => (d.id === docId ? { 
            ...d, 
            status,
            totalChunks: data.total_chunks,
            processedChunks: data.processed_chunks
          } : d))
        );

        // Stop polling once terminal state reached
        if (status === "ready" || status === "error") {
          clearInterval(pollingRef.current[docId]);
          delete pollingRef.current[docId];
        }
      } catch {
        // Ignore transient network errors during polling
      }
    }, 3000);
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setUploadError(null);
    const fileList = Array.from(e.target.files);

    fileList.forEach(async (file) => {
      // Immediately add the doc with "uploading" status for instant feedback
      const tempId = `temp-${Date.now()}-${file.name}`;
      setUploadedDocs((prev) => [
        ...prev,
        { id: tempId, name: file.name, status: "uploading" },
      ]);

      const form = new FormData();
      form.append("file", file);

      try {
        const res = await fetch("/api/upload", { method: "POST", body: form });

        if (res.ok) {
          const data = await res.json();
          // Replace temp entry with real doc id, set to "processing"
          setUploadedDocs((prev) =>
            prev.map((d) =>
              d.id === tempId
                ? { id: data.id, name: file.name, status: "processing" }
                : d
            )
          );
          // Start polling until it becomes "ready" or "error"
          startPolling(data.id);
        } else {
          const err = await res.text();
          setUploadError(`Upload failed: ${err}`);
          // Remove the temp entry on failure
          setUploadedDocs((prev) => prev.filter((d) => d.id !== tempId));
        }
      } catch (err) {
        setUploadError(`Upload error: ${String(err)}`);
        setUploadedDocs((prev) => prev.filter((d) => d.id !== tempId));
      }
    });

    // Reset input so the same file can be re-uploaded if needed
    e.target.value = "";
  };

  const handleRemoveDoc = async (docId: string) => {
    // Stop polling for this doc before removing
    if (pollingRef.current[docId]) {
      clearInterval(pollingRef.current[docId]);
      delete pollingRef.current[docId];
    }

    // Remove from selection checklist if active
    setSelectedDocIds((prev) => prev.filter((id) => id !== docId));

    // Immediately drop from UI state for instant feedback
    setUploadedDocs((prev) => prev.filter((d) => d.id !== docId));

    try {
      await fetch(`/api/documents/${docId}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to delete document permanently:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Cancel active voice playback/recording on new query submit
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const readyDocIds = uploadedDocs
      .filter((d) => d.status === "ready")
      .map((d) => d.id);

    // If specific documents are selected in the checklist, target them strictly.
    // Otherwise, search across all ready documents.
    let targetDocIds: string[] | undefined = undefined;

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
          // Send last 10 messages (excluding the new one just added) as conversation history
          history: messages
            .slice(-10)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (response.ok && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";

        // Add a placeholder message and stream into it
        const assistantId = (Date.now() + 1).toString();
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "" },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assistantContent += decoder.decode(value, { stream: true });
          // Update the streaming message in real-time
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: assistantContent } : m
            )
          );
        }

        // Play voice readout when streaming concludes
        speakText(assistantContent);
      } else {
        const errText = await response.text();
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `⚠️ Error: ${errText || "Chat request failed. Is the backend running?"}`,
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `⚠️ Network error: ${String(err)}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  /** Start a brand-new conversation — clears messages but keeps documents. */
  const handleNewChat = () => {
    setMessages([]);
    setInput("");
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  /** Clear all chat history with confirmation. */
  const handleClearHistory = () => {
    setMessages([]);
    setInput("");
    setShowClearConfirm(false);
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const readyCount = uploadedDocs.filter((d) => d.status === "ready").length;
  const processingCount = uploadedDocs.filter(
    (d) => d.status === "uploading" || d.status === "processing"
  ).length;

  return (
    <div className="app-layout">
      {/* Background ambient glows */}
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />

      {/* ── Sidebar ── */}
      <aside className="glass-sidebar">
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#3b82f6" }}>
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <h2 style={{ fontSize: "1.05rem", fontWeight: "800", margin: 0, letterSpacing: "0.8px", background: "linear-gradient(to right, #fff, #9ca3af)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            DOCUMENTS
          </h2>
        </div>

        {/* Upload button */}
        <label className="neon-upload-label">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload File
          </div>
          <input
            type="file"
            accept=".pdf,.txt,.csv,.xlsx"
            multiple
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </label>
        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: 0, textAlign: "center" }}>
          Supported: PDF, TXT, CSV, XLSX
        </p>

        {/* ── Chat Actions ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}>
          <button
            id="new-chat-btn"
            onClick={handleNewChat}
            disabled={messages.length === 0 || isLoading}
            title="Start a new conversation"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
              padding: "0.6rem 1rem",
              background: "rgba(59, 130, 246, 0.08)",
              border: "1px solid rgba(59, 130, 246, 0.25)",
              borderRadius: "0.75rem",
              color: "#60a5fa",
              opacity: messages.length === 0 || isLoading ? 0.4 : 1,
              fontSize: "0.85rem",
              fontWeight: "600",
              cursor: messages.length === 0 || isLoading ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              if (messages.length > 0 && !isLoading) {
                e.currentTarget.style.background = "rgba(59,130,246,0.18)";
                e.currentTarget.style.borderColor = "rgba(59,130,246,0.5)";
                e.currentTarget.style.boxShadow = "0 0 12px rgba(59,130,246,0.2)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(59,130,246,0.08)";
              e.currentTarget.style.borderColor = "rgba(59,130,246,0.25)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            New Chat
          </button>

          <button
            id="clear-history-btn"
            onClick={() => setShowClearConfirm(true)}
            disabled={messages.length === 0 || isLoading}
            title="Clear all chat history"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
              padding: "0.6rem 1rem",
              background: "rgba(248, 113, 113, 0.06)",
              border: "1px solid rgba(248, 113, 113, 0.2)",
              borderRadius: "0.75rem",
              color: "#f87171",
              opacity: messages.length === 0 || isLoading ? 0.4 : 1,
              fontSize: "0.85rem",
              fontWeight: "600",
              cursor: messages.length === 0 || isLoading ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              if (messages.length > 0 && !isLoading) {
                e.currentTarget.style.background = "rgba(248,113,113,0.14)";
                e.currentTarget.style.borderColor = "rgba(248,113,113,0.45)";
                e.currentTarget.style.boxShadow = "0 0 12px rgba(248,113,113,0.2)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(248,113,113,0.06)";
              e.currentTarget.style.borderColor = "rgba(248,113,113,0.2)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2v2"/>
            </svg>
            Clear History
          </button>
        </div>

        {/* Upload error banner */}
        {uploadError && (
          <div style={{
            padding: "0.75rem 1rem", background: "rgba(248, 113, 113, 0.08)", color: "#f87171",
            borderRadius: "0.75rem", fontSize: "0.8rem", border: "1px solid rgba(248, 113, 113, 0.2)",
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem",
            animation: "fadeInUp 0.3s ease"
          }}>
            <span style={{ wordBreak: "break-word" }}>{uploadError}</span>
            <button
              onClick={() => setUploadError(null)}
              style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "1.1rem", fontWeight: "700", padding: "0 4px" }}
            >×</button>
          </div>
        )}

        {/* Context status summary */}
        {uploadedDocs.length > 0 && (
          <div style={{
            padding: "0.75rem 1rem", borderRadius: "0.75rem", fontSize: "0.8rem",
            background: selectedDocIds.length > 0 
              ? "rgba(59, 130, 246, 0.08)" 
              : (readyCount > 0 ? "rgba(16, 185, 129, 0.08)" : "rgba(245, 158, 11, 0.08)"),
            color: selectedDocIds.length > 0 
              ? "#60a5fa" 
              : (readyCount > 0 ? "#34d399" : "#fbbf24"),
            border: "1px solid " + (selectedDocIds.length > 0 
              ? "rgba(59, 130, 246, 0.2)" 
              : (readyCount > 0 ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)")),
            transition: "all 0.3s ease",
            lineHeight: "1.4"
          }}>
            {selectedDocIds.length > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <span style={{ fontSize: "1rem" }}>🎯</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  Targeting: <strong style={{ color: "#fff" }}>
                    {selectedDocIds.length === 1 
                      ? uploadedDocs.find(d => d.id === selectedDocIds[0])?.name
                      : `${selectedDocIds.length} files selected`
                    }
                  </strong>
                </span>
              </div>
            ) : readyCount > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <span style={{ fontSize: "1rem" }}>🚀</span>
                <span>Searching <strong>all {readyCount} ready</strong> files</span>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <span style={{ display: "inline-block", fontSize: "1rem", animation: "spin 2s linear infinite" }}>⏳</span>
                <span>Processing {processingCount} file(s)…</span>
              </div>
            )}
          </div>
        )}

        {/* Collapsible Documents Option */}
        <div
          onClick={() => setIsDocsExpanded(!isDocsExpanded)}
          className="accordion-header"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span>Library ({uploadedDocs.length})</span>
          </div>
          <svg 
            width="12" 
            height="12" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="3" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            style={{
              transform: isDocsExpanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
            }}
          >
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>

        {isDocsExpanded && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.6rem", overflowY: "auto", maxHeight: "calc(100vh - 280px)" }}>
            {uploadedDocs.length === 0 ? (
              <li style={{ padding: "1.5rem 1rem", fontSize: "0.8rem", color: "var(--text-secondary)", textAlign: "center", background: "rgba(255,255,255,0.01)", borderRadius: "0.75rem", border: "1px dashed var(--border-neon)" }}>
                No files uploaded yet.
              </li>
            ) : (
              uploadedDocs.map((doc) => {
                const s = STATUS_STYLES[doc.status];
                const isSelected = selectedDocIds.includes(doc.id);
                return (
                  <li
                    key={doc.id}
                    onClick={() => {
                      if (doc.status === "ready") {
                        handleToggleDoc(doc.id);
                      }
                    }}
                    className={`doc-card ${isSelected ? "selected" : ""}`}
                  >
                    {/* File name & Delete */}
                    <div className="doc-card-header">
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", overflow: "hidden", flex: 1 }}>
                        {/* Checkbox indicator */}
                        {doc.status === "ready" && (
                          <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minWidth: "16px",
                            width: "16px",
                            height: "16px",
                            borderRadius: "4px",
                            border: `1.5px solid ${isSelected ? "var(--accent-blue)" : "rgba(255,255,255,0.2)"}`,
                            background: isSelected ? "var(--accent-blue)" : "transparent",
                            transition: "all 0.2s ease"
                          }}>
                            {isSelected && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            )}
                          </div>
                        )}
                        <span className="doc-card-title" title={doc.name}>
                          {doc.name}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveDoc(doc.id);
                        }}
                        className="doc-delete-btn"
                        title="Delete permanently"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          <line x1="10" y1="11" x2="10" y2="17"/>
                          <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                      </button>
                    </div>
                    {/* Status indicator */}
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "9999px",
                        background: s.bg,
                        color: s.color,
                        fontSize: "0.7rem",
                        fontWeight: "600",
                        border: `1px solid ${s.borderColor}`,
                        lineHeight: "1"
                      }}>
                        {/* Status dot indicator */}
                        {(doc.status === "uploading" || doc.status === "processing") && (
                          <span style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: s.color,
                            display: "inline-block",
                            animation: "pulseGlow 1.5s infinite"
                          }} />
                        )}
                        {s.label}
                      </span>
                    </div>

                    {/* Progress Bar & ETA */}
                    {doc.status === "processing" && doc.totalChunks !== undefined && doc.totalChunks > 0 && (
                      <div style={{ marginTop: "0.6rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--text-secondary)", marginBottom: "0.2rem" }}>
                          <span>{doc.processedChunks || 0} / {doc.totalChunks} chunks</span>
                          {doc.totalChunks > 300 && (
                            <span>~{Math.ceil(Math.max(0, (doc.totalChunks - (doc.processedChunks || 0)) * 0.2) / 60)} min left</span>
                          )}
                        </div>
                        <div style={{ width: "100%", height: "4px", background: "rgba(255,255,255,0.1)", borderRadius: "2px", overflow: "hidden" }}>
                          <div style={{ 
                            height: "100%", 
                            width: `${Math.min(100, Math.max(0, ((doc.processedChunks || 0) / doc.totalChunks) * 100))}%`, 
                            background: s.color,
                            transition: "width 0.5s ease"
                          }} />
                        </div>
                        {doc.totalChunks > 300 && (
                          <div style={{ fontSize: "0.65rem", color: "#fbbf24", marginTop: "0.3rem", fontStyle: "italic", lineHeight: "1.2" }}>
                            Large file processing (approx {Math.ceil((doc.totalChunks * 0.2) / 60)} mins total)
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        )}
      </aside>

      {/* ── Main chat area ── */}
      <main className="main-chat-view">



        {/* ── Clear History Confirmation Dialog ── */}
        {showClearConfirm && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "fadeInUp 0.2s ease",
          }}>
            <div style={{
              background: "rgba(15,20,35,0.95)",
              border: "1px solid rgba(248,113,113,0.3)",
              borderRadius: "1.25rem",
              padding: "2rem 2.25rem",
              maxWidth: "380px",
              width: "90%",
              boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
              display: "flex", flexDirection: "column", gap: "1.25rem",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{
                  width: "40px", height: "40px", borderRadius: "50%",
                  background: "rgba(248,113,113,0.1)",
                  border: "1px solid rgba(248,113,113,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: "700", color: "#fff" }}>Clear Chat History?</h3>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: "1.45" }}>
                    This will remove all {messages.length} messages from this conversation. Your uploaded documents will not be affected.
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
                <button
                  id="cancel-clear-btn"
                  onClick={() => setShowClearConfirm(false)}
                  style={{
                    padding: "0.55rem 1.1rem",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "0.6rem",
                    color: "var(--text-secondary)",
                    fontSize: "0.85rem", fontWeight: "600", cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                >
                  Cancel
                </button>
                <button
                  id="confirm-clear-btn"
                  onClick={handleClearHistory}
                  style={{
                    padding: "0.55rem 1.1rem",
                    background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                    border: "none",
                    borderRadius: "0.6rem",
                    color: "white",
                    fontSize: "0.85rem", fontWeight: "700", cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(220,38,38,0.3)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  Clear History
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Messages Scroll Wrapper */}
        <div style={{ flex: 1, position: "relative", width: "100%", minHeight: 0, marginBottom: "1.25rem" }}>
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            paddingRight: "0.5rem"
          }}>
            {messages.length === 0 && (
              <div style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--text-secondary)", textAlign: "center", padding: "2rem",
              }}>
                <div style={{ maxWidth: "420px", display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem" }}>
                  <div style={{
                    width: "72px", height: "72px", borderRadius: "50%", 
                    background: "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)",
                    border: "1px solid var(--border-neon)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 8px 30px rgba(59, 130, 246, 0.15)",
                    animation: "floatAmbient 5s infinite ease-in-out"
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#3b82f6" }}>
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.35rem", fontWeight: "800", color: "#fff", letterSpacing: "0.3px" }}>
                      Cognitive Document Workspace
                    </h3>
                    <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                      Upload files to your library, select them to target queries, or search everything at once.
                    </p>
                  </div>
                  
                  {readyCount > 0 && (
                    <div style={{
                      display: "grid", gridTemplateColumns: "1fr", gap: "0.5rem", width: "100%", marginTop: "0.5rem",
                      animation: "fadeInUp 0.5s ease"
                    }}>
                      <div 
                        onClick={() => setInput("What are the key highlights of the uploaded documents?")}
                        style={{
                          padding: "0.75rem 1rem", background: "rgba(255, 255, 255, 0.02)",
                          border: "1px solid var(--border-neon)", borderRadius: "0.75rem",
                          fontSize: "0.8rem", cursor: "pointer", transition: "all 0.2s ease",
                          textAlign: "left", display: "flex", alignItems: "center", gap: "0.5rem"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "var(--border-neon-hover)";
                          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "var(--border-neon)";
                          e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                        }}
                      >
                        <span>✨</span>
                        <span style={{ color: "var(--text-primary)" }}>Summarize key highlights</span>
                      </div>
                      <div 
                        onClick={() => setInput("Compare the data models and details across files.")}
                        style={{
                          padding: "0.75rem 1rem", background: "rgba(255, 255, 255, 0.02)",
                          border: "1px solid var(--border-neon)", borderRadius: "0.75rem",
                          fontSize: "0.8rem", cursor: "pointer", transition: "all 0.2s ease",
                          textAlign: "left", display: "flex", alignItems: "center", gap: "0.5rem"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "var(--border-neon-hover)";
                          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "var(--border-neon)";
                          e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                        }}
                      >
                        <span>📊</span>
                        <span style={{ color: "var(--text-primary)" }}>Compare structures and metrics</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} style={{ display: "flex", justifyContent: m.role === "assistant" ? "flex-start" : "flex-end" }}>
                <div className={`msg-bubble ${m.role === "assistant" ? "msg-bubble-assistant" : "msg-bubble-user"}`}>
                  {m.role === "assistant" ? (
                    m.content
                      ? <div className="md-body" dangerouslySetInnerHTML={{ __html: renderContent(m.content) }} />
                      : <span style={{ opacity: 0.4 }}>▋</span>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div className="msg-bubble msg-bubble-assistant" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{
                    display: "inline-block",
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "#3b82f6",
                    animation: "pulseGlow 1s infinite"
                  }} />
                  <span>Thinking…</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input bar */}
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

          {/* Speaker Mute/Unmute Toggle */}
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className={`voice-btn ${!isMuted ? "active-speaker" : ""}`}
            title={isMuted ? "Unmute voice feedback" : "Mute voice feedback"}
          >
            {isMuted ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23"/>
                <path d="M9 9v6a3 3 0 0 0 3 3h1.586l4.707 4.707A1 1 0 0 0 20 18V4a1 1 0 0 0-1.707-.707L13.586 8H12a3 3 0 0 0-3 1z"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
              </svg>
            )}
          </button>

          {/* Microphone Dictation Toggle */}
          <button
            type="button"
            onClick={toggleListening}
            className={`voice-btn ${isListening ? "active-mic" : ""}`}
            title={isListening ? "Stop listening" : "Start voice input"}
          >
            {isListening ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23"/>
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 5.48 1.68"/>
                <path d="M19 10v1a7.92 7.92 0 0 1-.95 3.78"/>
                <path d="M12 18.75V22"/>
                <line x1="9" y1="22" x2="15" y2="22"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v1a7 7 0 0 1-14 0v-1"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            )}
          </button>

          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="chat-send-btn"
          >
            {isLoading ? (
              <svg style={{ animation: "spin 1s linear infinite" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            ) : (
              <>
                <span>Send</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
