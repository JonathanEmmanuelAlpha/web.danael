"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Send, Paperclip, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useForm, useStore } from "@tanstack/react-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendMessageAction } from "@/server/actions/messaging";
import type { MessageWithSender } from "@/server/services/messaging";
import type { ApiResponse } from "@/lib/api-response";

export interface MessageInputProps {
  threadId: string;
  onSent?: (message: MessageWithSender) => void;
}

interface UploadedAttachment {
  id: string;
  name: string;
  size: number;
  contentType: string;
}

const messageSchema = z.object({
  body: z.string(),
});

type MessageFormValues = z.infer<typeof messageSchema>;

/**
 * §5.11 — Message composer (textarea + send button + attachment uploader).
 *
 * - Send on Enter, newline on Shift+Enter.
 * - Attachment uploads via the presigned URL flow (POST /api/files/upload-url
 *   → PUT object → POST /api/files/confirm-upload).
 *
 * IMPROVED: Uses TanStack Form + Zod + shadcn Textarea (not useState + native inputs).
 * The hidden `<input type="file">` is kept as a separate React-controlled upload
 * trigger — it is NOT a form field (the attachment id lives in component state
 * until submission).
 */
export function MessageInput({ threadId, onSent }: MessageInputProps) {
  const t = useTranslations("Messaging");
  const tCommon = useTranslations("Common");
  const [uploading, setUploading] = useState(false);
  const [attachment, setAttachment] = useState<UploadedAttachment | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm({
    defaultValues: { body: "" } as MessageFormValues,
    validators: {
      onChange: messageSchema,
    },
    onSubmit: async ({ value }) => {
      const trimmed = value.body.trim();
      if (!trimmed && !attachment?.id) return;
      const result = await sendMessageAction({
        threadId,
        body: trimmed || "📎",
        attachmentFileId: attachment?.id,
      });
      if (!result.success) {
        toast.error(result.error?.message ?? t("sendFailed"));
        return;
      }
      onSent?.(result.data);
      form.reset({ body: "" });
      setAttachment(null);
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  async function handleFileSelected(file: File): Promise<void> {
    if (file.size > 10 * 1024 * 1024) {
      toast.error(`"${file.name}" dépasse la taille maximale (10MB)`);
      return;
    }
    setUploading(true);
    try {
      // 1. Request presigned URL.
      const res = await fetch(
        `/api/files/upload-url?category=document&contentType=${encodeURIComponent(file.type)}&size=${file.size}`,
        { method: "POST" },
      );
      const json = (await res.json()) as ApiResponse<{
        method: "PUT" | "POST";
        uploadUrl: string;
        headers: Record<string, string>;
        key: string;
      }>;
      if (!json.success) {
        toast.error(json.error.message);
        return;
      }
      const { method, uploadUrl, headers, key } = json.data;

      // 2. Upload to the presigned URL.
      const uploadRes = await fetch(uploadUrl, { method, body: file, headers });
      if (!uploadRes.ok) {
        toast.error(`Upload failed for "${file.name}"`);
        return;
      }

      // 3. Confirm the upload → create the `files` row in DB (returns fileId).
      const confirmRes = await fetch("/api/files/confirm-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          originalName: file.name,
          contentType: file.type,
          size: file.size,
          category: "document",
        }),
      });
      const confirmJson = (await confirmRes.json()) as ApiResponse<{
        id: string;
      }>;
      if (!confirmJson.success) {
        toast.error(confirmJson.error.message);
        return;
      }
      setAttachment({
        id: confirmJson.data.id,
        name: file.name,
        size: file.size,
        contentType: file.type,
      });
    } catch {
      toast.error(`Erreur lors de l'upload de "${file.name}"`);
    } finally {
      setUploading(false);
    }
  }

  function handleRemoveAttachment() {
    setAttachment(null);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isSubmitting) void form.handleSubmit();
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className="border-t border-border bg-background/95 p-3 backdrop-blur-md sm:p-4"
    >
      {attachment && (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs">
          <Paperclip className="size-3.5 text-muted-foreground" aria-hidden />
          <span className="flex-1 truncate">{attachment.name}</span>
          <button
            type="button"
            onClick={handleRemoveAttachment}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={tCommon("delete")}
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFileSelected(f);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || isSubmitting}
          aria-label={t("attachment")}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Paperclip className="size-4" />
          )}
        </Button>
        <div className="flex-1">
          <form.Field name="body">
            {(field) => (
              <Textarea
                ref={textareaRef}
                value={field.state.value as string}
                onChange={(e) => field.handleChange(e.target.value as never)}
                onKeyDown={handleKeyDown}
                placeholder={t("typeMessage")}
                rows={1}
                className="min-h-11 resize-none"
                disabled={isSubmitting}
                aria-label={t("typeMessage")}
              />
            )}
          </form.Field>
        </div>
        <form.Subscribe
          selector={(state) =>
            [state.isSubmitting, state.values.body] as const
          }
        >
          {([submitting, bodyValue]) => (
            <Button
              type="submit"
              variant="brand"
              size="icon"
              disabled={
                submitting ||
                uploading ||
                (!bodyValue.trim() && !attachment?.id)
              }
              aria-label={t("send")}
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}
