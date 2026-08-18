"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Send, CheckCircle2, Clock } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

import {
  startChallengeAction,
  submitChallengeAction,
} from "@/server/actions/talent";

export interface ChallengeSubmissionFormProps {
  challengeId: string;
  challengeTitle: string;
  /** Estimated minutes — used as the default for the time-spent input. */
  estimatedMinutes?: number;
}

/**
 * Submission form for a Talent challenge.
 *
 * 1. On mount, calls `startChallengeAction` to get (or create) the
 *    student's in-progress submission for this challenge.
 * 2. If a submission already exists with status `submitted`/`reviewed`,
 *    shows a "submitted" state.
 * 3. Otherwise renders a textarea + time-spent + rating form, then
 *    calls `submitChallengeAction` on submit.
 */
export function ChallengeSubmissionForm({
  challengeId,
  challengeTitle,
  estimatedMinutes = 30,
}: ChallengeSubmissionFormProps) {
  const t = useTranslations("Talent");
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<
    "in_progress" | "submitted" | "reviewed" | "rejected" | null
  >(null);
  const [existingSubmission, setExistingSubmission] = useState<string | null>(
    null,
  );

  const [submission, setSubmission] = useState("");
  const [timeSpentMinutes, setTimeSpentMinutes] = useState(
    String(estimatedMinutes),
  );
  const [rating, setRating] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await startChallengeAction({ challengeId });
      if (cancelled) return;
      setLoading(false);
      if (res.success) {
        setSubmissionId(res.data.id);
        setSubmissionStatus(res.data.status as never);
        if (res.data.submission) {
          setExistingSubmission(res.data.submission);
        }
      } else {
        toast.error(res.error?.message ?? "Could not start challenge");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [challengeId]);

  async function handleSubmit() {
    if (!submissionId) return;
    if (!submission.trim()) {
      toast.error("Submission cannot be empty");
      return;
    }
    setSubmitting(true);
    const minutes = Number(timeSpentMinutes) || 0;
    const res = await submitChallengeAction({
      submissionId,
      submission: submission.trim(),
      fileIds: [],
      timeSpentMinutes: minutes,
      rating: rating > 0 ? rating : undefined,
    });
    setSubmitting(false);
    if (res.success) {
      setSubmissionStatus(res.data.status as never);
      setExistingSubmission(res.data.submission);
      toast.success("Challenge submitted");
      router.refresh();
    } else {
      toast.error(res.error?.message ?? "Could not submit challenge");
    }
  }

  if (loading) {
    return (
      <Card className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {t("processing")}
      </Card>
    );
  }

  const isAlreadySubmitted =
    submissionStatus === "submitted" || submissionStatus === "reviewed";

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">
            {challengeTitle}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("type.problem_set")}
          </p>
        </div>
        {submissionStatus && (
          <Badge variant="outline" className="capitalize">
            {submissionStatus.replace("_", " ")}
          </Badge>
        )}
      </div>

      {isAlreadySubmitted && existingSubmission ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-4" />
            <span>{t("completed")}</span>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              {t("description")}
            </Label>
            <p className="mt-1 whitespace-pre-wrap rounded-lg border border-border/50 bg-muted/30 p-3 text-sm">
              {existingSubmission}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="submission">{t("description")}</Label>
            <Textarea
              id="submission"
              value={submission}
              onChange={(e) => setSubmission(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              rows={8}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="time" className="flex items-center gap-1 text-xs">
                <Clock className="size-3" />
                {t("type.problem_set")}
              </Label>
              <Input
                id="time"
                type="number"
                min={0}
                max={480}
                value={timeSpentMinutes}
                onChange={(e) => setTimeSpentMinutes(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("engagement")}</Label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className={`p-1 transition-transform hover:scale-110 ${
                      star <= rating
                        ? "text-amber-500"
                        : "text-muted-foreground"
                    }`}
                    aria-label={`${star}`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="size-5"
                    >
                      <path d="M12 2l2.94 6.36 6.95.6-5.27 4.55 1.6 6.78L12 17.27 5.78 20.5l1.6-6.78L2.1 9l6.95-.6z" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button
            variant="brand"
            onClick={handleSubmit}
            disabled={submitting || !submission.trim()}
            className="w-full"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {t("saveShowcase")}
          </Button>
        </div>
      )}
    </Card>
  );
}
