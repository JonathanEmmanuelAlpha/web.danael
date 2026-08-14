"use client";

import { Paperclip, FileText, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MessageWithSender } from "@/server/services/messaging";

export interface MessageBubbleProps {
  message: MessageWithSender;
  isOwn: boolean;
  showSenderName?: boolean;
  showAvatar?: boolean;
}

function formatTime(date: Date): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * §5.11 — Single message bubble.
 *
 * - own messages: aligned right, brand-tinted background
 * - other messages: aligned left, muted background + avatar
 * - attachment shown as a chip with download link
 */
export function MessageBubble({
  message,
  isOwn,
  showSenderName,
  showAvatar,
}: MessageBubbleProps) {
  const senderName =
    [message.sender.firstName, message.sender.lastName]
      .filter(Boolean)
      .join(" ") || message.sender.id.slice(0, 6);
  const initials =
    (message.sender.firstName?.[0] ?? "") +
    (message.sender.lastName?.[0] ?? "");

  return (
    <div
      className={cn(
        "flex w-full items-end gap-2",
        isOwn ? "justify-end" : "justify-start",
      )}
      data-message-id={message.id}
    >
      {!isOwn && showAvatar && (
        <div
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-500/15 text-[10px] font-semibold text-primary-700 dark:text-primary-400"
          aria-hidden
        >
          {initials.toUpperCase() || "?"}
        </div>
      )}

      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-xs sm:max-w-[70%]",
          isOwn
            ? "rounded-br-md bg-primary-500 text-white"
            : "rounded-bl-md bg-muted text-foreground",
        )}
      >
        {!isOwn && showSenderName && (
          <div className="mb-0.5 text-[11px] font-semibold text-primary-700 dark:text-primary-300">
            {senderName}
          </div>
        )}
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        {message.attachment && (
          <a
            href={`/api/files/download-url?fileId=${message.attachment.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "mt-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition hover:bg-black/10",
              isOwn
                ? "bg-white/15 text-white"
                : "bg-background/60 text-foreground",
            )}
          >
            <Paperclip className="size-3.5" aria-hidden />
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <FileText className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{message.attachment.originalName}</span>
              <span className="text-[10px] opacity-70">
                ({formatBytes(message.attachment.size)})
              </span>
            </span>
            <Download className="size-3.5" aria-hidden />
          </a>
        )}
        <div
          className={cn(
            "mt-1 text-[10px] opacity-70",
            isOwn ? "text-right" : "text-left",
          )}
        >
          {formatTime(message.createdAt as unknown as Date)}
        </div>
      </div>
    </div>
  );
}
