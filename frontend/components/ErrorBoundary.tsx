"use client";

import React, { type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || "Something went wrong.",
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("UI error boundary caught:", error, info);
    this.props.onError?.(error);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: "" });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            background: "#0b0f19",
            color: "#e5e7eb",
          }}
        >
          <div
            style={{
              maxWidth: "480px",
              width: "100%",
              padding: "2rem",
              borderRadius: "1rem",
              border: "1px solid rgba(248, 113, 113, 0.3)",
              background: "rgba(15, 20, 35, 0.95)",
              textAlign: "center",
            }}
          >
            <h1 style={{ margin: "0 0 0.75rem", fontSize: "1.25rem", color: "#fff" }}>
              Something went wrong
            </h1>
            <p style={{ margin: "0 0 1.25rem", color: "#9ca3af", lineHeight: 1.5 }}>
              The chat interface hit an unexpected error. Your documents are still safe —
              try reloading or starting a new chat.
            </p>
            <button
              type="button"
              onClick={this.handleRetry}
              style={{
                padding: "0.6rem 1.2rem",
                borderRadius: "0.6rem",
                border: "none",
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
