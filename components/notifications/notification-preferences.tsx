"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Save, Bell } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  SelectField,
  TimeField,
  SubmitButton,
} from "@/components/forms/tanstack-fields";
import {
  getPreferencesAction,
  updatePreferencesAction,
} from "@/server/actions/notifications";
import type { NotificationPreferencesShape } from "@/server/services/notifications";
import type {
  ChannelValue,
  FrequencyValue,
  CategoryValue,
} from "@/server/validators/notifications";

const ALL_CHANNELS: { value: ChannelValue; labelKey: string }[] = [
  { value: "in_app", labelKey: "inApp" },
  { value: "email", labelKey: "email" },
  { value: "sms", labelKey: "sms" },
  { value: "push", labelKey: "push" },
];

const ALL_CATEGORIES: { value: CategoryValue; labelKey: string }[] = [
  { value: "assignments", labelKey: "catAssignments" },
  { value: "grades", labelKey: "catGrades" },
  { value: "announcements", labelKey: "catAnnouncements" },
  { value: "messages", labelKey: "catMessages" },
  { value: "reminders", labelKey: "catReminders" },
  { value: "social", labelKey: "catSocial" },
  { value: "system", labelKey: "catSystem" },
  { value: "billing", labelKey: "catBilling" },
];

const FREQUENCIES: { value: FrequencyValue; labelKey: string }[] = [
  { value: "immediate", labelKey: "immediate" },
  { value: "daily", labelKey: "daily" },
  { value: "weekly", labelKey: "weekly" },
];

const preferencesSchema = z.object({
  channels: z.array(
    z.enum(["in_app", "email", "sms", "push"]),
  ),
  frequency: z.enum(["immediate", "daily", "weekly"]),
  categories: z.array(
    z.enum([
      "assignments",
      "grades",
      "announcements",
      "messages",
      "reminders",
      "social",
      "system",
      "billing",
    ]),
  ),
  quietHoursStart: z.string().nullable(),
  quietHoursEnd: z.string().nullable(),
});

type PreferencesValues = z.infer<typeof preferencesSchema>;

const DEFAULT_VALUES: PreferencesValues = {
  channels: [],
  frequency: "immediate",
  categories: [],
  quietHoursStart: null,
  quietHoursEnd: null,
};

/**
 * §5.12 — Notification preferences form.
 *
 * - Channels (multi-select via toggles)
 * - Frequency (immediate / daily / weekly)
 * - Categories (multi-select via toggles)
 * - Quiet hours window (HH:mm start/end)
 *
 * IMPROVED: Uses TanStack Form + Zod + shadcn wrappers (SelectField for the
 * frequency, TimeField for quiet-hours start/end). Channels[] and
 * categories[] use TanStack array fields rendered with shadcn Switch toggles.
 */
export function NotificationPreferences() {
  const t = useTranslations("Notifications");
  const tCommon = useTranslations("Common");
  const [prefs, setPrefs] = useState<NotificationPreferencesShape | null>(null);

  const form = useForm({
    defaultValues: DEFAULT_VALUES,
    validators: {
      onChange: preferencesSchema,
    },
    onSubmit: async ({ value }) => {
      const res = await updatePreferencesAction({
        channels: value.channels as ChannelValue[],
        frequency: value.frequency as FrequencyValue,
        categories: value.categories as CategoryValue[],
        quietHoursStart: value.quietHoursStart,
        quietHoursEnd: value.quietHoursEnd,
      });
      if (!res.success) {
        toast.error(res.error?.message ?? t("saveFailed"));
        return;
      }
      toast.success(t("saved"));
    },
  });

  useEffect(() => {
    getPreferencesAction().then((res) => {
      if (res.success) setPrefs(res.data);
    });
  }, []);

  // Once the saved prefs arrive, hydrate the form (only once).
  useEffect(() => {
    if (!prefs) return;
    form.reset({
      channels: (prefs.channels ?? []) as PreferencesValues["channels"],
      frequency: (prefs.frequency ?? "immediate") as PreferencesValues["frequency"],
      categories: (prefs.categories ?? []) as PreferencesValues["categories"],
      quietHoursStart: (prefs.quietHoursStart ?? null) as PreferencesValues["quietHoursStart"],
      quietHoursEnd: (prefs.quietHoursEnd ?? null) as PreferencesValues["quietHoursEnd"],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs]);

  if (!prefs) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className="space-y-6"
    >
      {/* Channels */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {t("channels")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("channelsHint")}</p>
        </div>
        <form.Field name="channels">
          {(field) => {
            const selected = (field.state.value as PreferencesValues["channels"]) ?? [];
            const toggle = (value: ChannelValue) => {
              const has = selected.includes(value);
              field.handleChange(
                (has
                  ? selected.filter((c) => c !== value)
                  : [...selected, value]) as never,
              );
            };
            return (
              <div className="grid gap-3 sm:grid-cols-2">
                {ALL_CHANNELS.map((c) => (
                  <label
                    key={c.value}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 transition hover:border-primary-500/30"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {t(c.labelKey)}
                      </p>
                    </div>
                    <Switch
                      checked={selected.includes(c.value)}
                      onCheckedChange={() => toggle(c.value)}
                      aria-label={t(c.labelKey)}
                    />
                  </label>
                ))}
              </div>
            );
          }}
        </form.Field>
      </section>

      {/* Frequency */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {t("frequency")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("frequencyHint")}</p>
        </div>
        <form.Field name="frequency">
          {(field) => (
            <SelectField
              field={field}
              className="w-full sm:w-64"
              options={FREQUENCIES.map((f) => ({
                value: f.value,
                label: t(f.labelKey),
              }))}
            />
          )}
        </form.Field>
      </section>

      {/* Categories */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {t("categories")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("categoriesHint")}</p>
        </div>
        <form.Field name="categories">
          {(field) => {
            const selected = (field.state.value as PreferencesValues["categories"]) ?? [];
            const toggle = (value: CategoryValue) => {
              const has = selected.includes(value);
              field.handleChange(
                (has
                  ? selected.filter((c) => c !== value)
                  : [...selected, value]) as never,
              );
            };
            return (
              <div className="grid gap-3 sm:grid-cols-2">
                {ALL_CATEGORIES.map((c) => (
                  <label
                    key={c.value}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 transition hover:border-primary-500/30"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {t(c.labelKey)}
                    </p>
                    <Switch
                      checked={selected.includes(c.value)}
                      onCheckedChange={() => toggle(c.value)}
                      aria-label={t(c.labelKey)}
                    />
                  </label>
                ))}
              </div>
            );
          }}
        </form.Field>
      </section>

      {/* Quiet hours */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {t("quietHours")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("quietHoursHint")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <form.Field name="quietHoursStart">
            {(field) => (
              <TimeField
                field={field}
                label={t("start")}
              />
            )}
          </form.Field>
          <form.Field name="quietHoursEnd">
            {(field) => (
              <TimeField
                field={field}
                label={t("end")}
              />
            )}
          </form.Field>
        </div>
        <form.Subscribe
          selector={(state) =>
            [state.values.quietHoursStart, state.values.quietHoursEnd] as const
          }
        >
          {([start, end]) =>
            start || end ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => {
                  form.setFieldValue("quietHoursStart", null as never);
                  form.setFieldValue("quietHoursEnd", null as never);
                }}
              >
                {t("disableQuietHours")}
              </Button>
            ) : null
          }
        </form.Subscribe>
      </section>

      <div className="flex justify-end">
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <SubmitButton pending={isSubmitting} disabled={!canSubmit}>
              <Save className="size-4" />
              {tCommon("save")}
            </SubmitButton>
          )}
        </form.Subscribe>
      </div>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Bell className="size-3.5" aria-hidden />
        {t("footerHint")}
      </p>
    </form>
  );
}
