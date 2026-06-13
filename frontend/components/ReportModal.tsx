"use client";

import { memo, useState, useCallback } from "react";
import type { UploadedDoc } from "@/lib/types";

interface ReportModalProps {
  uploadedDocs: UploadedDoc[];
  onClose: () => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

const STATUS_STYLES: Record<string, { color: string; bg: string; borderColor: string; label: string }> = {
  ready: { color: "#34d399", bg: "rgba(16, 185, 129, 0.1)", borderColor: "rgba(16, 185, 129, 0.3)", label: "Ready" },
  processing: { color: "#fbbf24", bg: "rgba(245, 158, 11, 0.1)", borderColor: "rgba(245, 158, 11, 0.3)", label: "Processing" },
  uploading: { color: "#60a5fa", bg: "rgba(59, 130, 246, 0.1)", borderColor: "rgba(59, 130, 246, 0.3)", label: "Uploading" },
  error: { color: "#f87171", bg: "rgba(248, 113, 113, 0.1)", borderColor: "rgba(248, 113, 113, 0.3)", label: "Error" },
};

function ReportModalComponent({ uploadedDocs, onClose, showToast }: ReportModalProps) {
  const readyDocs = uploadedDocs.filter((d) => d.status === "ready");

  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [reportTitle, setReportTitle] = useState("My Data Report");
  const [outputFormat, setOutputFormat] = useState<"csv" | "excel" | "pdf">("excel");
  const [groupBy, setGroupBy] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const toggleDoc = useCallback((id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  }, []);

  const handleGenerate = async () => {
    if (selectedDocIds.length === 0) {
      showToast("Please select at least one document", "error");
      return;
    }

    setIsGenerating(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          document_ids: selectedDocIds,
          filters: [],
          group_by: groupBy || null,
          output_format: outputFormat,
          report_title: reportTitle,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(err);
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportTitle.replace(/\s+/g, "_")}.${outputFormat === "excel" ? "xlsx" : outputFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast("Report generated successfully!", "success");
      onClose();
    } catch (err) {
      showToast(`Failed to generate report: ${err}`, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "fadeInUp 0.25s ease",
      }}
    >
      <div
        style={{
          background: "rgba(15,20,35,0.97)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "1.25rem",
          padding: "2rem",
          maxWidth: "560px",
          width: "92%",
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
 }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "800", color: "#fff" }}>
              📊 Generate Report
            </h2>
            <p style={{ margin: "0.3rem 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              Export your data as PDF, Excel, or CSV
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "0.5rem",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "1.2rem",
              padding: "0.4rem 0.8rem",
            }}
          >
            ×
          </button>
        </div>

        {/* Report Title */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "0.4rem" }}>
            Report Title
          </label>
          <input
            type="text"
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            style={{
              width: "100%",
              padding: "0.6rem 0.9rem",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "0.6rem",
              color: "#fff",
              fontSize: "0.9rem",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Document Selection */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
            Select Documents ({selectedDocIds.length} selected)
          </label>
          {readyDocs.length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", textAlign: "center", padding: "1rem", background: "rgba(255,255,255,0.02)", borderRadius: "0.6rem", border: "1px dashed rgba(255,255,255,0.1)" }}>
              No ready documents available. Upload and process a file first.
            </p>
          ) : (
            <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {readyDocs.map((doc) => {
                const isSelected = selectedDocIds.includes(doc.id);
                return (
                  <div
                    key={doc.id}
                    onClick={() => toggleDoc(doc.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.6rem",
                      padding: "0.5rem 0.75rem",
                      background: isSelected ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${isSelected ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: "0.6rem",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      style={{ accentColor: "#3b82f6", width: "15px", height: "15px" }}
                    />
                    <span style={{ flex: 1, fontSize: "0.85rem", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {doc.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Group By */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "0.4rem" }}>
            Group By (optional)
          </label>
          <input
            type="text"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            placeholder="e.g., Region, Status, City"
            style={{
              width: "100%",
              padding: "0.6rem 0.9rem",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "0.6rem",
              color: "#fff",
              fontSize: "0.9rem",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <p style={{ margin: "0.3rem 0 0", fontSize: "0.7rem", color: "var(--text-secondary)" }}>
            Leave empty to export all data without grouping
          </p>
        </div>

        {/* Output Format */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
            Output Format
          </label>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            {(["csv", "excel", "pdf"] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setOutputFormat(fmt)}
                style={{
                  flex: 1,
                  padding: "0.6rem",
                  background: outputFormat === fmt ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${outputFormat === fmt ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: "0.6rem",
                  color: outputFormat === fmt ? "#60a5fa" : "var(--text-secondary)",
                  fontSize: "0.85rem",
                  fontWeight: "600",
                  cursor: "pointer",
                  textTransform: "uppercase",
                }}
              >
                {fmt === "csv" ? "📄 CSV" : fmt === "excel" ? "📊 Excel" : "📑 PDF"}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "0.65rem 1.25rem",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "0.6rem",
              color: "var(--text-secondary)",
              fontSize: "0.9rem",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || selectedDocIds.length === 0}
            style={{
              padding: "0.65rem 1.5rem",
              background: isGenerating || selectedDocIds.length === 0
                ? "rgba(59,130,246,0.3)"
                : "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
              border: "none",
              borderRadius: "0.6rem",
              color: "#fff",
              fontSize: "0.9rem",
              fontWeight: "700",
              cursor: isGenerating || selectedDocIds.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            {isGenerating ? "Generating..." : "Generate Report"}
          </button>
        </div>
      </div>
    </div>
  );
}

export const ReportModal = memo(ReportModalComponent);
