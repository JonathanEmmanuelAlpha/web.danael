"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { EyeOff, Trophy } from "lucide-react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge as UIBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import {
  NumberField,
  SubmitButton,
} from "@/components/forms/tanstack-fields";
import {
  getLeaderboardAction,
  submitScoreAction,
} from "@/server/actions/competitions";
import type { RankedParticipant } from "@/server/services/competitions";
import { toast } from "sonner";

const RANK_STYLES = [
  "bg-amber-400/15 text-amber-600 dark:text-amber-400",
  "bg-slate-400/15 text-slate-600 dark:text-slate-300",
  "bg-orange-700/15 text-orange-700 dark:text-orange-400",
];

export interface CompetitionLeaderboardProps {
  competitionId: string;
  /** Set to true to show the score submission form (student view). */
  allowSubmission?: boolean;
  /** Set to true if the current user is the organizer (teacher). */
  isOrganizer?: boolean;
}

export function CompetitionLeaderboard({
  competitionId,
  allowSubmission = false,
  isOrganizer = false,
}: CompetitionLeaderboardProps) {
  const t = useTranslations("Competitions");
  const [entries, setEntries] = useState<RankedParticipant[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getLeaderboardAction(competitionId)
      .then((res) => {
        if (cancelled) return;
        if (res.success) setEntries(res.data);
        else setError(true);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [competitionId]);

  const schema = z.object({
    score: z.number().int().min(0, t("scoreInvalid")).max(1_000_000),
  });
  type ScoreFormValues = z.infer<typeof schema>;

  const form = useForm({
    defaultValues: { score: undefined } as unknown as ScoreFormValues,
    validators: { onChange: schema },
    onSubmit: async ({ value }) => {
      const res = await submitScoreAction({
        competitionId,
        score: value.score,
      });
      if (res.success) {
        toast.success(t("scoreSubmitted"));
        form.reset();
        // Refetch the leaderboard.
        const refreshed = await getLeaderboardAction(competitionId);
        if (refreshed.success) setEntries(refreshed.data);
      } else {
        toast.error(res.error.message ?? t("submitFailed"));
      }
    },
  });

  if (error) {
    return (
      <EmptyState
        icon={Trophy}
        title={t("loadFailed")}
        description={t("loadFailedHint")}
      />
    );
  }

  if (!entries) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {allowSubmission ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
          className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-end"
        >
          <form.Field name="score">
            {(field) => (
              <NumberField
                field={field}
                label={t("submitScore")}
                placeholder="0"
                min={0}
                max={1_000_000}
                className="flex-1"
              />
            )}
          </form.Field>
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <SubmitButton
                pending={isSubmitting}
                disabled={!canSubmit}
                size="sm"
                className="h-9"
              >
                {t("submit")}
              </SubmitButton>
            )}
          </form.Subscribe>
        </form>
      ) : null}

      {entries.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title={t("noParticipants")}
          description={t("noParticipantsHint")}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">{t("rank")}</TableHead>
                <TableHead>{t("participant")}</TableHead>
                <TableHead className="text-right">{t("score")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((p) => {
                const initials = p.displayName
                  .split(" ")
                  .slice(0, 2)
                  .map((s) => s[0])
                  .join("")
                  .toUpperCase();
                const isAnonymous = p.isAnonymous;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-center">
                      <span
                        className={
                          p.rank <= 3
                            ? `inline-flex size-8 items-center justify-center rounded-full text-sm font-bold ${RANK_STYLES[p.rank - 1]}`
                            : "text-sm font-medium text-muted-foreground"
                        }
                      >
                        {p.rank}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          {!isAnonymous && p.user.avatarUrl ? (
                            <AvatarImage
                              src={p.user.avatarUrl}
                              alt={p.displayName}
                            />
                          ) : null}
                          <AvatarFallback className="text-[10px]">
                            {isAnonymous ? "?" : initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="line-clamp-1 text-sm font-medium text-foreground">
                          {p.displayName}
                        </span>
                        {isAnonymous ? (
                          <UIBadge variant="outline" size="sm">
                            <EyeOff className="size-3" />
                            {t("anonymous")}
                          </UIBadge>
                        ) : null}
                        {isOrganizer && p.rank ? (
                          <UIBadge variant="outline" size="sm">
                            #{p.rank}
                          </UIBadge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">
                      {p.score.toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
