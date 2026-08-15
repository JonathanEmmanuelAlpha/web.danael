"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { useForm, useSelector } from "@tanstack/react-form";
import { z } from "zod";
import { Label } from "@/components/ui/label";
import {
  TextAreaField,
  SubmitButton,
} from "@/components/forms/tanstack-fields";
import { createReviewAction } from "@/server/actions/tutoring";

interface TutorReviewFormProps {
  bookingId: string;
  onSubmitted?: () => void;
}

const reviewSchema = z.object({
  rating: z.number().int().min(1, "Note requise").max(5, "Note invalide"),
  comment: z
    .string()
    .max(2000)
    .refine(
      (v) => v.trim() === "" || v.trim().length >= 10,
      "Le commentaire doit comporter au moins 10 caractères",
    ),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

/**
 * §5.15 — Submit a review for a completed tutoring session.
 *
 * Uses TanStack Form + Zod for validation. The star rating UI is kept
 * as a custom control that writes to the form via `form.setFieldValue`.
 */
export function TutorReviewForm({
  bookingId,
  onSubmitted,
}: TutorReviewFormProps) {
  const t = useTranslations("Tutoring");
  const [hovered, setHovered] = useState<number | null>(null);

  const form = useForm({
    defaultValues: {
      rating: 5,
      comment: "",
    } as ReviewFormValues,
    validators: { onChange: reviewSchema },
    onSubmit: async ({ value }) => {
      const result = await createReviewAction({
        bookingId,
        rating: value.rating,
        comment: value.comment.trim() || undefined,
      });
      if (!result.success) {
        toast.error(result.error?.message ?? t("reviewFailed"));
        return;
      }
      toast.success(t("reviewSubmitted"));
      form.reset();
      onSubmitted?.();
    },
  });

  const rating = useSelector(form.store, (s) => s.values.rating);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label>{t("yourRating")}</Label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => form.setFieldValue("rating", n)}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(null)}
              className="rounded-md p-1 transition hover:bg-accent"
              aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
            >
              <Star
                className={
                  (hovered ?? rating) >= n
                    ? "size-7 fill-amber-400 text-amber-400"
                    : "size-7 text-muted-foreground"
                }
              />
            </button>
          ))}
          <span className="ml-2 text-sm font-medium text-foreground">
            {rating} / 5
          </span>
        </div>
      </div>

      <form.Field name="comment">
        {(field) => (
          <TextAreaField
            field={field}
            label={t("comment")}
            placeholder={t("commentPlaceholder")}
            rows={4}
            description={t("commentOptional", {
              count: ((field.state.value as string) ?? "").length,
            })}
          />
        )}
      </form.Field>

      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting] as const}
      >
        {([canSubmit, isSubmitting]) => (
          <div className="flex justify-end">
            <SubmitButton pending={isSubmitting} disabled={!canSubmit}>
              {t("submitReview")}
            </SubmitButton>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
