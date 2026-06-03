export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export type DocStatus = "uploading" | "processing" | "ready" | "error";

export interface UploadedDoc {
  id: string;
  name: string;
  status: DocStatus;
  totalChunks?: number;
  processedChunks?: number;
}

export const STATUS_STYLES: Record<
  DocStatus,
  { bg: string; color: string; label: string; borderColor: string }
> = {
  uploading: {
    bg: "rgba(59, 130, 246, 0.1)",
    color: "#60a5fa",
    label: "Uploading",
    borderColor: "rgba(59, 130, 246, 0.25)",
  },
  processing: {
    bg: "rgba(139, 92, 246, 0.1)",
    color: "#c084fc",
    label: "Processing",
    borderColor: "rgba(139, 92, 246, 0.25)",
  },
  ready: {
    bg: "rgba(52, 211, 153, 0.1)",
    color: "#34d399",
    label: "Ready",
    borderColor: "rgba(52, 211, 153, 0.25)",
  },
  error: {
    bg: "rgba(248, 113, 113, 0.1)",
    color: "#f87171",
    label: "Error",
    borderColor: "rgba(248, 113, 113, 0.25)",
  },
};
