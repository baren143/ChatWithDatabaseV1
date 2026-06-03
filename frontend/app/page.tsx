"use client";

import { ChatPanel } from "@/components/ChatPanel";
import { DocumentsSidebar } from "@/components/DocumentsSidebar";
import { useToast } from "@/components/Toast";
import { useDocuments } from "@/hooks/useDocuments";

export default function Home() {
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
      />

      <ChatPanel
        uploadedDocs={uploadedDocs}
        selectedDocIds={selectedDocIds}
        showToast={showToast}
      />
    </div>
  );
}
