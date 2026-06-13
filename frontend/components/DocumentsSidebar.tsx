import { memo, useState } from "react";
import type { UploadedDoc, Message, ChatThread } from "@/lib/types";
import { STATUS_STYLES } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface DocumentsSidebarProps {
  uploadedDocs: UploadedDoc[];
  selectedDocIds: string[];
  uploadError: string | null;
  onClearUploadError: () => void;
  onToggleDoc: (docId: string) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveDoc: (docId: string) => void;
  threads: ChatThread[];
  activeThreadId: string | null;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  onNewChat: () => void;
  messages: Message[];
  isLoading: boolean;
}

function DocumentsSidebarComponent({
  uploadedDocs,
  selectedDocIds,
  uploadError,
  onClearUploadError,
  onToggleDoc,
  onFileChange,
  onRemoveDoc,
  threads,
  activeThreadId,
  onSelectThread,
  onDeleteThread,
  onNewChat,
  messages,
  isLoading,
}: DocumentsSidebarProps) {
  const [isDocsExpanded, setIsDocsExpanded] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const [docSearch, setDocSearch] = useState("");
  const [docPage, setDocPage] = useState(0);
  const DOCS_PER_PAGE = 10;

  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const readyCount = uploadedDocs.filter((d) => d.status === "ready").length;
  const processingCount = uploadedDocs.filter(
    (d) => d.status === "uploading" || d.status === "processing"
  ).length;

  // Filter documents by search query
  const filteredDocs = uploadedDocs.filter((d) =>
    d.name.toLowerCase().includes(docSearch.toLowerCase())
  );

  // Paginate filtered documents
  const totalDocPages = Math.ceil(filteredDocs.length / DOCS_PER_PAGE);
  const paginatedDocs = filteredDocs.slice(
    docPage * DOCS_PER_PAGE,
    (docPage + 1) * DOCS_PER_PAGE
  );

  // Reset to page 0 when search changes
  if (docSearch) setDocPage(0);

  return (
    <aside className="glass-sidebar">
      <Link
        href="/"
        className="brand-home-link"
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          gap: "0.75rem",
          padding: "0.6rem 0.75rem",
          borderRadius: "0.75rem",
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
          textDecoration: "none",
          transition: "all 0.2s ease",
          marginBottom: "1rem",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span
          style={{
            fontSize: "0.95rem",
            fontWeight: "850",
            letterSpacing: "0.5px",
            background: "linear-gradient(to right, #60a5fa, #a78bfa)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          ChatWithDB
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.65rem",
            color: "rgba(255, 255, 255, 0.5)",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            padding: "2px 6px",
            borderRadius: "4px",
            fontWeight: "600",
          }}
        >
          Home
        </span>
      </Link>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          marginBottom: "0.5rem",
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "#3b82f6" }}
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <h2
          style={{
            fontSize: "1.05rem",
            fontWeight: "800",
            margin: 0,
            letterSpacing: "0.8px",
            background: "linear-gradient(to right, #fff, #9ca3af)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          DOCUMENTS
        </h2>
      </div>

      <label className="neon-upload-label">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
          }}
        >
          Upload File
        </div>
        <input
          type="file"
          accept=".pdf,.txt,.csv,.xlsx"
          multiple
          onChange={onFileChange}
          style={{ display: "none" }}
        />
      </label>
      <p
        style={{
          fontSize: "0.75rem",
          color: "var(--text-secondary)",
          margin: 0,
          textAlign: "center",
        }}
      >
        Supported: PDF, TXT, CSV, XLSX
      </p>

      {/* Scrollable list content container */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          marginRight: "-0.5rem",
          paddingRight: "0.5rem",
        }}
      >
        {uploadError && (
          <div
            style={{
              padding: "0.75rem 1rem",
              background: "rgba(248, 113, 113, 0.08)",
              color: "#f87171",
              borderRadius: "0.75rem",
              fontSize: "0.8rem",
              border: "1px solid rgba(248, 113, 113, 0.2)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.5rem",
              marginTop: "1rem",
              animation: "fadeInUp 0.3s ease",
            }}
          >
            <span style={{ wordBreak: "break-word" }}>{uploadError}</span>
            <button
              type="button"
              onClick={onClearUploadError}
              style={{
                background: "none",
                border: "none",
                color: "#f87171",
                cursor: "pointer",
                fontSize: "1.1rem",
                fontWeight: "700",
                padding: "0 4px",
              }}
            >
              ×
            </button>
          </div>
        )}

        {uploadedDocs.length > 0 && (
          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "0.75rem",
              fontSize: "0.8rem",
              marginTop: "1rem",
              background:
                selectedDocIds.length > 0
                  ? "rgba(59, 130, 246, 0.08)"
                  : readyCount > 0
                    ? "rgba(16, 185, 129, 0.08)"
                    : "rgba(245, 158, 11, 0.08)",
              color:
                selectedDocIds.length > 0
                  ? "#60a5fa"
                  : readyCount > 0
                    ? "#34d399"
                    : "#fbbf24",
              border:
                "1px solid " +
                (selectedDocIds.length > 0
                  ? "rgba(59, 130, 246, 0.2)"
                  : readyCount > 0
                    ? "rgba(16, 185, 129, 0.2)"
                    : "rgba(245, 158, 11, 0.2)"),
              lineHeight: "1.4",
            }}
          >
            {selectedDocIds.length > 0 ? (
              <span>
                Targeting:{" "}
                <strong style={{ color: "#fff" }}>
                  {selectedDocIds.length === 1
                    ? uploadedDocs.find((d) => d.id === selectedDocIds[0])?.name
                    : `${selectedDocIds.length} files selected`}
                </strong>
              </span>
            ) : readyCount > 0 ? (
              <span>
                Searching <strong>all {readyCount} ready</strong> files
              </span>
            ) : (
              <span>Processing {processingCount} file(s)…</span>
            )}
          </div>
        )}

        {uploadedDocs.length > 0 && readyCount > 0 && (
          <p
            style={{
              fontSize: "0.7rem",
              color: "var(--text-secondary)",
              margin: "0.4rem 0 0 0",
              textAlign: "center",
              opacity: 0.8,
              lineHeight: "1.35",
            }}
          >
            💡 Click a file below to select it. If none are selected, we search all files.
          </p>
        )}

        {/* Search documents */}
        <div style={{ position: "relative", marginTop: "0.75rem" }}>
          <input
            type="text"
            placeholder="Search documents..."
            value={docSearch}
            onChange={(e) => setDocSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              paddingLeft: "2rem",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "0.6rem",
              color: "#fff",
              fontSize: "0.8rem",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ position: "absolute", left: "0.6rem", top: "50%", transform: "translateY(-50%)" }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {docSearch && (
            <button
              type="button"
              onClick={() => setDocSearch("")}
              style={{
                position: "absolute",
                right: "0.5rem",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.4)",
                cursor: "pointer",
                fontSize: "1rem",
                padding: "0 4px",
              }}
            >
              ×
            </button>
          )}
        </div>

        <div
          onClick={() => setIsDocsExpanded(!isDocsExpanded)}
          className="accordion-header"
          style={{ marginTop: "1rem" }}
        >
                   <span>Library ({filteredDocs.length}{totalDocPages > 1 ? `, pg ${docPage + 1}/${totalDocPages}` : ""})</span>
          <span>{isDocsExpanded ? "▾" : "▸"}</span>
        </div>

        {isDocsExpanded && (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
            }}
          >
            {filteredDocs.length === 0 ? (
              <li
                style={{
                  padding: "1.5rem 1rem",
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                  textAlign: "center",
                  background: "rgba(255,255,255,0.01)",
                  borderRadius: "0.75rem",
                  border: "1px dashed var(--border-neon)",
                }}
              >
                {docSearch ? "No documents match your search." : "No files uploaded yet."}
              </li>
            ) : (
              paginatedDocs.map((doc) => {
                const s = STATUS_STYLES[doc.status];
                const isSelected = selectedDocIds.includes(doc.id);
                return (
                  <li
                    key={doc.id}
                    style={{ cursor: doc.status === "ready" ? "pointer" : "default" }}
                    onClick={() => {
                      if (doc.status === "ready") onToggleDoc(doc.id);
                    }}
                    className={`doc-card ${isSelected ? "selected" : ""}`}
                  >
                    <div className="doc-card-header">
                      {doc.status === "ready" && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          style={{
                            marginRight: "0.5rem",
                            cursor: "pointer",
                            accentColor: "#3b82f6",
                            width: "14px",
                            height: "14px",
                          }}
                        />
                      )}
                      <span className="doc-card-title" title={doc.name}>
                        {doc.name}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveDoc(doc.id);
                        }}
                        className="doc-delete-btn"
                        title="Delete permanently"
                      >
                        ✕
                      </button>
                    </div>
                    <span
                      style={{
                        display: "inline-flex",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "9999px",
                        background: s.bg,
                        color: s.color,
                        fontSize: "0.7rem",
                        fontWeight: "600",
                        border: `1px solid ${s.borderColor}`,
                      }}
                    >
                      {s.label}
                    </span>
                    {doc.status === "processing" &&
                      doc.totalChunks !== undefined &&
                      doc.totalChunks > 0 && (
                        <div style={{ marginTop: "0.6rem" }}>
                          <div
                            style={{
                              fontSize: "0.65rem",
                              color: "var(--text-secondary)",
                              marginBottom: "0.2rem",
                            }}
                          >
                            {doc.processedChunks || 0} / {doc.totalChunks} chunks
                          </div>
                          <div
                            style={{
                              width: "100%",
                              height: "4px",
                              background: "rgba(255,255,255,0.1)",
                              borderRadius: "2px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${Math.min(100, Math.max(0, ((doc.processedChunks || 0) / doc.totalChunks) * 100))}%`,
                                background: s.color,
                                transition: "width 0.5s ease",
                              }}
                            />
                          </div>
                        </div>
                      )}
                  </li>
                );
              })
            )}
          </ul>
        )}

        <div
          onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
          className="accordion-header"
          style={{ marginTop: "1rem" }}
        >
          <span>Chat History ({threads.length})</span>
          <span>{isHistoryExpanded ? "▾" : "▸"}</span>
        </div>

        {isHistoryExpanded && (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
            }}
          >
            {threads.length === 0 ? (
              <li
                style={{
                  padding: "1.5rem 1rem",
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                  textAlign: "center",
                  background: "rgba(255,255,255,0.01)",
                  borderRadius: "0.75rem",
                  border: "1px dashed var(--border-neon)",
                }}
              >
                No chats yet.
              </li>
            ) : (
              threads.map((thread) => {
                const isSelected = thread.id === activeThreadId;
                return (
                  <li
                    key={thread.id}
                    onClick={() => onSelectThread(thread.id)}
                    className={`doc-card ${isSelected ? "selected" : ""}`}
                  >
                    <div className="doc-card-header">
                      <span
                        className="doc-card-title"
                        title={thread.title}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.2rem",
                          fontSize: "0.9rem",
                          fontWeight: "600",
                          color: isSelected ? "#60a5fa" : "var(--text-secondary)",
                        }}
                      >
                        {thread.title.length > 20
                          ? `💬 ${thread.title.substring(0, 20)}...`
                          : `💬 ${thread.title}`}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingThreadId(thread.id);
                        }}
                        className="doc-delete-btn"
                        title="Delete chat thread"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="doc-card-footer">
                      <span
                        style={{
                          display: "inline-flex",
                          padding: "0.15rem 0.5rem",
                          borderRadius: "9999px",
                          background: isSelected ? "rgba(59, 130, 246, 0.1)" : "rgba(255,255,255,0.03)",
                          color: isSelected ? "#60a5fa" : "var(--text-secondary)",
                          fontSize: "0.7rem",
                          fontWeight: "600",
                          width: "fit-content",
                        }}
                      >
                        {thread.messages.length} message{thread.messages.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        )}

        {deletingThreadId !== null && (
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
                    Delete Chat Thread?
                  </h3>
                  <p
                    style={{
                      margin: "0.25rem 0 0",
                      fontSize: "0.82rem",
                      color: "var(--text-secondary)",
                      lineHeight: "1.45",
                    }}
                  >
                    This will remove all messages from this chat thread. Your uploaded
                    documents will not be affected.
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setDeletingThreadId(null)}
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
                  onClick={() => {
                    onDeleteThread(deletingThreadId);
                    setDeletingThreadId(null);
                  }}
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
                  Delete Thread
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar Control Buttons */}
      <div
        className="sidebar-chat-controls"
        style={{
          display: "flex",
          gap: "0.5rem",
          paddingTop: "1rem",
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          width: "100%",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onNewChat}
          disabled={false}
          style={{
            flex: 1,
            padding: "0.65rem 0.9rem",
            background: "rgba(59, 130, 246, 0.08)",
            border: "1px solid rgba(59, 130, 246, 0.25)",
            borderRadius: "0.75rem",
            color: "#60a5fa",
            opacity: 1,
            fontSize: "0.82rem",
            fontWeight: "600",
            cursor: "pointer",
            transition: "all 0.2s ease",
            textAlign: "center",
          }}
        >
          New Chat
        </button>
        <button
          type="button"
          onClick={() => {
            if (activeThreadId !== null) {
              setDeletingThreadId(activeThreadId);
            }
          }}
          disabled={messages.length === 0 || isLoading}
          style={{
            flex: 1,
            padding: "0.65rem 0.9rem",
            background: "rgba(248, 113, 113, 0.06)",
            border: "1px solid rgba(248, 113, 113, 0.2)",
            borderRadius: "0.75rem",
            color: "#f87171",
            opacity: messages.length === 0 || isLoading ? 0.4 : 1,
            fontSize: "0.82rem",
            fontWeight: "600",
            cursor: messages.length === 0 || isLoading ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            textAlign: "center",
          }}
        >
          Clear Chat
        </button>
        <button
          type="button"
          onClick={handleLogout}
          style={{
            flex: 1,
            padding: "0.65rem 0.9rem",
            background: "rgba(248, 113, 113, 0.06)",
            border: "1px solid rgba(248, 113, 113, 0.2)",
            borderRadius: "0.75rem",
            color: "#f87171",
            fontSize: "0.82rem",
            fontWeight: "600",
            cursor: "pointer",
            transition: "all 0.2s ease",
            textAlign: "center",
          }}
        >
          Logout
        </button>
      </div>
    </aside>
  );
}

export const DocumentsSidebar = memo(DocumentsSidebarComponent);