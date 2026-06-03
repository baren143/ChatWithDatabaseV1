"use client";

import { memo } from "react";
import type { Message } from "@/lib/types";
import { renderContent } from "@/lib/markdown";

interface ChatMessageProps {
  message: Message;
}

function ChatMessageComponent({ message }: ChatMessageProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: message.role === "assistant" ? "flex-start" : "flex-end",
      }}
    >
      <div
        className={`msg-bubble ${
          message.role === "assistant" ? "msg-bubble-assistant" : "msg-bubble-user"
        }`}
      >
        {message.role === "assistant" ? (
          message.content ? (
            <div
              className="md-body"
              dangerouslySetInnerHTML={{ __html: renderContent(message.content) }}
            />
          ) : (
            <span style={{ opacity: 0.4 }}>▋</span>
          )
        ) : (
          message.content
        )}
      </div>
    </div>
  );
}

export const ChatMessage = memo(
  ChatMessageComponent,
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.role === next.message.role
);
