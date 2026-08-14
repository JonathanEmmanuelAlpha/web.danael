"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Target } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge as UIBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import {
  SelectField,
  NumberField,
  SubmitButton,
} from "@/components/forms/tanstack-fields";
import { createGoalAction } from "@/server/actions/gamification";
import type { GoalWithProgress } from "@/server/services/gamification";
import { GOAL_TYPE_VALUES, GOAL_PERIOD_VALUES } from "@/server/db/schema/enums";
import { ApiError } from "@/lib/api-response";

export function WeeklyGoals({
  data,
  error,
}: {
  error: ApiError | null;
  data: GoalWithProgress[] | null;
}) {
  const t = useTranslations("Gamification");
  const tCommon = useTranslations("Common");

  const [goals, setGoals] = useState<GoalWithProgress[] | null>(data);
  const [showForm, setShowForm] = useState(false);

  const schema = z.object({
    type: z.enum(GOAL_TYPE_VALUES),
    period: z.enum(GOAL_PERIOD_VALUES),
    targetValue: z.number().int().min(1, t("targetInvalid")),
  });
  type GoalFormValues = z.infer<typeof schema>;

  const form = useForm({
    defaultValues: {
      type: "contents_viewed",
      period: "weekly",
      targetValue: 5,
    } as GoalFormValues,
    validators: { onChange: schema },
    onSubmit: async ({ value }) => {
      const res = await createGoalAction({
        type: value.type,
        period: value.period,
        targetValue: value.targetValue,
      });
      if (res.success) {
        setGoals((prev) => [...(prev ?? []), res.data]);
        toast.success(t("goalCreated"));
        setShowForm(false);
        // Reset only the target — keep the user's last type/period selection.
        form.setFieldValue("targetValue", 5);
      } else {
        toast.error(res.error.message ?? tCommon("error"));
      }
    },
  });

  if (error) {
    return (
      <EmptyState
        icon={Target}
        title={t("loadFailed")}
        description={t("loadFailedHint")}
      />
    );
  }

  if (!goals) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title={t("noGoals")}
          description={t("noGoalsHint")}
          action={{
            label: t("createGoal"),
            onClick: () => setShowForm(true),
          }}
        />
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => (
            <li
              key={g.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-sm font-semibold text-foreground">
                      {t(`goalTypes.${g.type}`)}
                    </span>
                    <UIBadge variant="outline" size="sm">
                      {t(`periods.${g.period}`)}
                    </UIBadge>
                    {g.isCompleted ? (
                      <UIBadge variant="success" size="sm">
                        {t("completed")}
                      </UIBadge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("progress")} :{" "}
                    <span className="font-medium text-foreground">
                      {g.currentValue} / {g.targetValue}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-display text-lg font-bold text-foreground">
                    {g.progressPercent}%
                  </span>
                </div>
              </div>
              <Progress
                value={g.progressPercent}
                className="mt-3 h-2"
                aria-label={t("progress")}
              />
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
          className="rounded-xl border border-border bg-muted/30 p-4"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <form.Field name="type">
              {(field) => (
                <SelectField
                  field={field}
                  label={t("goalType")}
                  options={GOAL_TYPE_VALUES.map((g) => ({
                    value: g,
                    label: t(`goalTypes.${g}`),
                  }))}
                />
              )}
            </form.Field>
            <form.Field name="period">
              {(field) => (
                <SelectField
                  field={field}
                  label={t("period")}
                  options={GOAL_PERIOD_VALUES.map((p) => ({
                    value: p,
                    label: t(`periods.${p}`),
                  }))}
                />
              )}
            </form.Field>
            <form.Field name="targetValue">
              {(field) => (
                <NumberField
                  field={field}
                  label={t("target")}
                  min={1}
                  max={1000}
                />
              )}
            </form.Field>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <form.Subscribe
              selector={(state) =>
                [state.canSubmit, state.isSubmitting] as const
              }
            >
              {([canSubmit, isSubmitting]) => (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowForm(false)}
                    disabled={isSubmitting}
                  >
                    {tCommon("cancel")}
                  </Button>
                  <SubmitButton
                    pending={isSubmitting}
                    disabled={!canSubmit}
                    size="sm"
                  >
                    <Plus className="size-4" />
                    {tCommon("create")}
                  </SubmitButton>
                </>
              )}
            </form.Subscribe>
          </div>
        </form>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setShowForm(true)}
        >
          <Plus className="size-4" />
          {t("createGoal")}
        </Button>
      )}
    </div>
  );
}
