"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { MessageSquare, Send, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/shared/loading";
import { TextAreaField, SubmitButton } from "@/components/forms/tanstack-fields";
import { addNoteAction, listNotesAction } from "@/server/actions/contents";
import type { NoteWithAuthor } from "@/server/services/contents";

export interface ContentNotesProps {
  contentId: string;
  className?: string;
}

const notesSchema = z.object({
  body: z.string().max(5000),
});

type NotesFormValues = z.infer<typeof notesSchema>;

/**
 * Lists the current user's private notes on a content + lets them add new ones.
 */
export function ContentNotes({ contentId, className }: ContentNotesProps) {
  const t = useTranslations("Contents");
  const tCommon = useTranslations("Common");
  const [notes, setNotes] = useState<NoteWithAuthor[] | null>(null);

  const form = useForm({
    defaultValues: {
      body: "",
    } as NotesFormValues,
    validators: {
      onChange: notesSchema,
    },
    onSubmit: async ({ value }) => {
      if (!value.body.trim()) return;
      const res = await addNoteAction({ contentId, body: value.body.trim() });
      if (!res.success) {
        toast.error(res.error.message);
        return;
      }
      setNotes((prev) => [res.data, ...(prev ?? [])]);
      form.reset();
      toast.success(t("noteAdded"));
    },
  });

  useEffect(() => {
    let cancelled = false;
    listNotesAction(contentId).then((res) => {
      if (cancelled) return;
      setNotes(res.success ? res.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [contentId]);

  return (
    <div className={className}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="space-y-3"
      >
        <form.Field name="body">
          {(field) => (
            <TextAreaField
              field={field}
              label={t("addNote")}
              placeholder={t("addNotePlaceholder")}
              rows={3}
            />
          )}
        </form.Field>
        <div className="flex justify-end">
          <form.Subscribe
            selector={(state) =>
              [state.isSubmitting, state.values.body] as const
            }
          >
            {([isSubmitting, body]) => (
              <SubmitButton
                pending={isSubmitting}
                disabled={!body.trim()}
                variant="brand"
                size="sm"
              >
                <Send className="size-4" />
                {t("addNote")}
              </SubmitButton>
            )}
          </form.Subscribe>
        </div>
      </form>

      {notes === null ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : notes.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={MessageSquare}
            title={t("noNotes")}
            description={t("noNotesHint")}
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {notes.map((note) => (
            <li key={note.id}>
              <Card className="p-3">
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <StickyNote className="size-3.5" aria-hidden />
                    {note.author.firstName ?? note.author.email}
                  </span>
                  <time dateTime={note.createdAt.toISOString()}>
                    {note.createdAt.toLocaleDateString(undefined, {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                  {note.body}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        {tCommon("optional")} · {t("notesPrivate")}
      </p>
    </div>
  );
}
