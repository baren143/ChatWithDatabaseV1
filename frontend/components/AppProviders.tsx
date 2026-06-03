"use client";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastProvider, useToast } from "@/components/Toast";
import type { ReactNode } from "react";

function ErrorBoundaryWithToast({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  return (
    <ErrorBoundary
      onError={() =>
        showToast("The interface encountered an unexpected error.", "error")
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ErrorBoundaryWithToast>{children}</ErrorBoundaryWithToast>
    </ToastProvider>
  );
}
