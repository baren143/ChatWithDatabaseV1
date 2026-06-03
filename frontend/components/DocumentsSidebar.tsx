"use client";

import { memo, useState } from "react";
import type { UploadedDoc } from "@/lib/types";
import { STATUS_STYLES } from "@/lib/types";

interface DocumentsSidebarProps {
  uploadedDocs: UploadedDoc[];
  selectedDocIds: string[];
  uploadError: string | null;
  onClearUploadError: () => void;
  onToggleDoc: (docId: string) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveDoc: (docId: string) => void;
}

function DocumentsSidebarComponent({
  uploadedDocs,
  selectedDocIds,
  uploadError,
  onClearUploadError,
  onToggleDoc,
  onFileChange,
  onRemoveDoc,
}: DocumentsSidebarProps) {
  const [isDocsExpanded, setIsDocsExpanded] = useState(false);

  const readyCount = uploadedDocs.filter((d) => d.status === "ready").length;
  const processingCount = uploadedDocs.filter(
    (d) => d.status === "uploading" || d.status === "processing"
  ).length;

  return (
    <aside className="glass-sidebar">
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

      <div
        onClick={() => setIsDocsExpanded(!isDocsExpanded)}
        className="accordion-header"
        style={{ marginTop: "1rem" }}
      >
        <span>Library ({uploadedDocs.length})</span>
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
            overflowY: "auto",
            maxHeight: "calc(100vh - 280px)",
          }}
        >
          {uploadedDocs.length === 0 ? (
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
                    if (doc.status === "ready") onToggleDoc(doc.id);
                  }}
                  className={`doc-card ${isSelected ? "selected" : ""}`}
                >
                  <div className="doc-card-header">
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
    </aside>
  );
}

export const DocumentsSidebar = memo(DocumentsSidebarComponent);
