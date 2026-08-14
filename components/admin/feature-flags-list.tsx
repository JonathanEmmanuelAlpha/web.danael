"use client";

/**
 * §5.16 — Feature flags list with toggle switches + create dialog.
 *
 * Reads flags from the server on mount, then toggles locally via
 * `setFlagAction`. The create-flag dialog uses a TanStack Form
 * (key + description + enabled Switch) with Zod validation.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Flag, Plus } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  TextField,
  SwitchField,
  SubmitButton,
  FormErrorBanner,
} from "@/components/forms/tanstack-fields";
import { EmptyState } from "@/components/shared/empty-state";
import { PageLoader } from "@/components/shared/loading";
import {
  listFlagsAction,
  setFlagAction,
  createFlagAction,
} from "@/server/actions/feature-flags";
import type { FeatureFlag } from "@/server/db/schema/admin";

const createFlagSchema = z.object({
  key: z
    .string()
    .min(1, "La clé est requise")
    .regex(
      /^[a-z0-9]+(\.[a-z0-9]+)*$/i,
      "Format attendu : namespace.name (ex. competitions.enabled)",
    ),
  description: z.string().max(500).optional().or(z.literal("")),
  enabled: z.boolean(),
});

type CreateFlagValues = z.infer<typeof createFlagSchema>;

export function FeatureFlagsList() {
  const t = useTranslations("Admin");

  const [flags, setFlags] = useState<FeatureFlag[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const createForm = useForm({
    defaultValues: {
      key: "",
      description: "",
      enabled: false,
    } as CreateFlagValues,
    validators: { onChange: createFlagSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      const res = await createFlagAction({
        key: value.key.trim(),
        description: value.description?.trim() || undefined,
        enabled: value.enabled,
      });
      if (res.success) {
        toast.success(t("flagCreated"));
        setCreateOpen(false);
        createForm.reset({ key: "", description: "", enabled: false });
        fetchFlags();
      } else {
        setServerError(res.error?.message ?? t("createFailed"));
      }
    },
  });

  async function fetchFlags() {
    setLoading(true);
    try {
      const res = await listFlagsAction();
      if (res.success) setFlags(res.data);
      else toast.error(res.error?.message ?? t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFlags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleToggle(key: string, enabled: boolean) {
    setPendingKey(key);
    try {
      const res = await setFlagAction({ key, enabled });
      if (res.success) {
        toast.success(enabled ? t("flagEnabled") : t("flagDisabled"));
        setFlags((prev) =>
          prev
            ? prev.map((f) => (f.key === key ? { ...f, enabled } : f))
            : prev,
        );
      } else {
        toast.error(res.error?.message ?? t("toggleFailed"));
      }
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t("flagsHint")}</p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="brand" size="sm">
              <Plus className="size-4" />
              {t("newFlag")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("createFlag")}</DialogTitle>
              <DialogDescription>{t("createFlagHint")}</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void createForm.handleSubmit();
              }}
              className="space-y-3"
            >
              <createForm.Field name="key">
                {(field) => (
                  <TextField
                    field={field}
                    label={t("key")}
                    placeholder="e.g. competitions.enabled"
                    description={t("keyFormat")}
                    required
                    autoFocus
                  />
                )}
              </createForm.Field>
              <createForm.Field name="description">
                {(field) => (
                  <TextField
                    field={field}
                    label={t("description")}
                    placeholder={t("descriptionPlaceholder")}
                  />
                )}
              </createForm.Field>
              <createForm.Field name="enabled">
                {(field) => (
                  <SwitchField
                    field={field}
                    label={t("enabled")}
                    description={t("enabledHint")}
                    className="rounded-md border border-border p-3"
                  />
                )}
              </createForm.Field>

              <FormErrorBanner message={serverError} />

              <createForm.Subscribe
                selector={(state) =>
                  [state.canSubmit, state.isSubmitting] as const
                }
              >
                {([canSubmit, isSubmitting]) => (
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline" disabled={isSubmitting}>
                        {t("cancel")}
                      </Button>
                    </DialogClose>
                    <SubmitButton pending={isSubmitting} disabled={!canSubmit}>
                      {t("create")}
                    </SubmitButton>
                  </DialogFooter>
                )}
              </createForm.Subscribe>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading && !flags ? (
        <PageLoader />
      ) : !flags || flags.length === 0 ? (
        <EmptyState
          icon={Flag}
          title={t("noFlags")}
          description={t("noFlagsHint")}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {flags.map((f) => (
            <Card key={f.id} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-mono text-sm font-medium">
                    {f.key}
                  </p>
                  <Badge
                    variant={f.enabled ? "success" : "secondary"}
                    size="sm"
                  >
                    {f.enabled ? t("enabled") : t("disabled")}
                  </Badge>
                </div>
                {f.description && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {f.description}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("updatedAt")}:{" "}
                  {new Date(f.updatedAt).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <Switch
                checked={f.enabled}
                onCheckedChange={(checked) => handleToggle(f.key, checked)}
                disabled={pendingKey === f.key}
                aria-label={`${t("toggle")} ${f.key}`}
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
