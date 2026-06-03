"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ToastType = "error" | "info" | "success";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_STYLES: Record<ToastType, { bg: string; border: string; color: string }> = {
  error: {
    bg: "rgba(248, 113, 113, 0.12)",
    border: "rgba(248, 113, 113, 0.35)",
    color: "#fca5a5",
  },
  info: {
    bg: "rgba(59, 130, 246, 0.12)",
    border: "rgba(59, 130, 246, 0.35)",
    color: "#93c5fd",
  },
  success: {
    bg: "rgba(52, 211, 153, 0.12)",
    border: "rgba(52, 211, 153, 0.35)",
    color: "#6ee7b7",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "error") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          top: "1rem",
          right: "1rem",
          zIndex: 200,
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          maxWidth: "min(420px, calc(100vw - 2rem))",
          pointerEvents: "none",
        }}
      >
        {toasts.map((toast) => {
          const style = TOAST_STYLES[toast.type];
          return (
            <div
              key={toast.id}
              role="alert"
              style={{
                pointerEvents: "auto",
                padding: "0.85rem 1rem",
                borderRadius: "0.75rem",
                background: style.bg,
                border: `1px solid ${style.border}`,
                color: style.color,
                fontSize: "0.85rem",
                lineHeight: 1.45,
                boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
                backdropFilter: "blur(8px)",
                animation: "fadeInUp 0.25s ease",
              }}
            >
              {toast.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
