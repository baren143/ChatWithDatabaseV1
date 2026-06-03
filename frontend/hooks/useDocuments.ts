"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DocStatus, UploadedDoc } from "@/lib/types";
import type { ToastType } from "@/components/Toast";

type ShowToast = (message: string, type?: ToastType) => void;

function mapDocFromApi(d: {
  id: string;
  file_name: string;
  status: string;
  total_chunks?: number;
  processed_chunks?: number;
}): UploadedDoc {
  return {
    id: d.id,
    name: d.file_name,
    status: d.status as DocStatus,
    totalChunks: d.total_chunks,
    processedChunks: d.processed_chunks,
  };
}

export function useDocuments(showToast: ShowToast) {
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const pollingRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const stopPolling = useCallback((docId: string) => {
    if (pollingRef.current[docId]) {
      clearInterval(pollingRef.current[docId]);
      delete pollingRef.current[docId];
    }
  }, []);

  const startPolling = useCallback(
    (docId: string) => {
      stopPolling(docId);

      pollingRef.current[docId] = setInterval(async () => {
        try {
          const res = await fetch(`/api/documents/${docId}`);
          if (!res.ok) return;

          const data = await res.json();
          const status: DocStatus =
            data.status === "ready"
              ? "ready"
              : data.status === "error"
                ? "error"
                : "processing";

          setUploadedDocs((prev) =>
            prev.map((d) =>
              d.id === docId
                ? {
                    ...d,
                    status,
                    totalChunks: data.total_chunks,
                    processedChunks: data.processed_chunks,
                  }
                : d
            )
          );

          if (status === "ready" || status === "error") {
            stopPolling(docId);
            if (status === "error") {
              showToast(`Processing failed for one of your documents.`, "error");
            }
          }
        } catch {
          // Ignore transient network errors during polling
        }
      }, 3000);
    },
    [showToast, stopPolling]
  );

  useEffect(() => {
    const abortController = new AbortController();

    async function fetchDocs() {
      try {
        const res = await fetch("/api/documents", { signal: abortController.signal });
        if (!res.ok) {
          showToast(
            `Could not load documents (${res.status}). Check that the backend is running.`,
            "error"
          );
          return;
        }

        const data = await res.json();
        if (abortController.signal.aborted) return;

        const docs = data.map(mapDocFromApi);
        setUploadedDocs(docs);

        docs.forEach((doc: UploadedDoc) => {
          if (doc.status === "processing" || doc.status === "uploading") {
            startPolling(doc.id);
          }
        });
      } catch (err) {
        if (abortController.signal.aborted) return;
        console.error("Failed to load documents:", err);
        showToast("Could not reach the document service. Please try again.", "error");
      }
    }

    fetchDocs();

    return () => {
      abortController.abort();
      Object.values(pollingRef.current).forEach(clearInterval);
      pollingRef.current = {};
    };
  }, [showToast, startPolling]);

  const handleToggleDoc = useCallback((docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;
      setUploadError(null);
      const fileList = Array.from(e.target.files);

      fileList.forEach(async (file) => {
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
            setUploadedDocs((prev) =>
              prev.map((d) =>
                d.id === tempId
                  ? { id: data.id, name: file.name, status: "processing" }
                  : d
              )
            );
            startPolling(data.id);
            showToast(`"${file.name}" uploaded — processing started.`, "success");
          } else {
            const err = await res.text();
            const message =
              res.status >= 500
                ? "Upload failed: server error. Please try again shortly."
                : `Upload failed: ${err || res.statusText}`;
            setUploadError(message);
            showToast(message, "error");
            setUploadedDocs((prev) => prev.filter((d) => d.id !== tempId));
          }
        } catch (err) {
          const message = `Upload error: ${String(err)}`;
          setUploadError(message);
          showToast(message, "error");
          setUploadedDocs((prev) => prev.filter((d) => d.id !== tempId));
        }
      });

      e.target.value = "";
    },
    [showToast, startPolling]
  );

  const handleRemoveDoc = useCallback(
    async (docId: string) => {
      stopPolling(docId);
      setSelectedDocIds((prev) => prev.filter((id) => id !== docId));
      setUploadedDocs((prev) => prev.filter((d) => d.id !== docId));

      try {
        const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
        if (!res.ok) {
          showToast(`Failed to delete document (${res.status}).`, "error");
        }
      } catch (err) {
        console.error("Failed to delete document permanently:", err);
        showToast("Could not delete the document. Please try again.", "error");
      }
    },
    [showToast, stopPolling]
  );

  return {
    uploadedDocs,
    selectedDocIds,
    uploadError,
    setUploadError,
    handleToggleDoc,
    handleFileChange,
    handleRemoveDoc,
  };
}
