"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { KeyRound, Plus, Copy, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  NumberField,
  SelectField,
  SubmitButton,
} from "@/components/forms/tanstack-fields";
import { createAccessCodeAction } from "@/server/actions/school-access";

interface GenerateAccessCodeDialogProps {
  trigger?: React.ReactNode;
}

const generateSchema = z.object({
  maxUsages: z
    .number()
    .int("Entier requis")
    .min(1, "Doit être ≥ 1")
    .max(1000, "Maximum 1000")
    .optional()
    .or(z.literal("")),
  expiry: z.enum(["1d", "7d", "30d", "never"]),
});

type GenerateValues = z.infer<typeof generateSchema>;

const EXPIRY_SECONDS: Record<GenerateValues["expiry"], number | null> = {
  "1d": 60 * 60 * 24,
  "7d": 60 * 60 * 24 * 7,
  "30d": 60 * 60 * 24 * 30,
  never: null,
};

/**
 * Dialog to generate a new access code.
 *
 * On success the dialog shows the generated code prominently with a
 * "Copy" button. The user can close the dialog or generate another.
 */
export function GenerateAccessCodeDialog({
  trigger,
}: GenerateAccessCodeDialogProps) {
  const t = useTranslations("Schools");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useForm({
    defaultValues: {
      maxUsages: "" as unknown as number | "",
      expiry: "never" as GenerateValues["expiry"],
    } as GenerateValues,
    validators: {
      onChange: generateSchema,
    },
    onSubmit: async ({ value }) => {
      const maxUsages =
        typeof value.maxUsages === "number" ? value.maxUsages : null;
      const expiresInSeconds = EXPIRY_SECONDS[value.expiry];

      const result = await createAccessCodeAction({
        maxUsages,
        expiresInSeconds,
      });
      if (!result.success) {
        toast.error(result.error?.message ?? t("generateAccessCode"));
        return;
      }
      if (!result.data) {
        toast.error(t("generateAccessCode"));
        return;
      }
      toast.success(t("codeGenerated"));
      setGeneratedCode(result.data.accessCode);
      router.refresh();
    },
  });

  function handleClose(open: boolean) {
    setOpen(open);
    if (!open) {
      // Reset state when closing
      setGeneratedCode(null);
      setCopied(false);
      form.reset();
    }
  }

  async function handleCopy() {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      toast.success(t("copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="brand">
            <Plus className="size-4" />
            {t("generateAccessCode")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary-400" />
            {t("generateAccessCode")}
          </DialogTitle>
          <DialogDescription>
            {t("generateAccessCodeDescription")}
          </DialogDescription>
        </DialogHeader>

        {generatedCode ? (
          // ── Success state: show the generated code prominently ──
          <div className="space-y-4">
            <div className="glass-card glow-primary flex flex-col items-center gap-3 rounded-2xl px-5 py-7 text-center">
              <div className="glass flex size-12 items-center justify-center rounded-xl text-primary-400 glow-primary-sm">
                <Sparkles className="size-6" />
              </div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {t("accessCode")}
              </p>
              <p className="font-mono text-2xl font-bold tracking-[0.3em] text-foreground">
                {generatedCode}
              </p>
              <Button
                type="button"
                variant="brand-outline"
                size="sm"
                className="mt-1"
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check className="size-4" />
                    {t("copied")}
                  </>
                ) : (
                  <>
                    <Copy className="size-4" />
                    {t("copyCode")}
                  </>
                )}
              </Button>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleClose(false)}
              >
                {tCommon("close")}
              </Button>
              <Button
                type="button"
                variant="brand"
                onClick={() => {
                  setGeneratedCode(null);
                  form.reset();
                }}
              >
                <Plus className="size-4" />
                {t("generateAccessCode")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          // ── Form state ──
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
            className="space-y-4"
          >
            <form.Field name="maxUsages">
              {(field) => (
                <NumberField
                  field={field}
                  label={t("maxUsages")}
                  description={t("maxUsagesHint")}
                  placeholder="5"
                  min={1}
                  max={1000}
                />
              )}
            </form.Field>

            <form.Field name="expiry">
              {(field) => (
                <SelectField
                  field={field}
                  label={t("expiry")}
                  options={[
                    { value: "1d", label: t("expiry1Day") },
                    { value: "7d", label: t("expiry7Days") },
                    { value: "30d", label: t("expiry30Days") },
                    { value: "never", label: t("expiryNever") },
                  ]}
                />
              )}
            </form.Field>

            <form.Subscribe
              selector={(state) =>
                [state.canSubmit, state.isSubmitting] as const
              }
            >
              {([canSubmit, isSubmitting]) => (
                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleClose(false)}
                    disabled={isSubmitting}
                  >
                    {tCommon("cancel")}
                  </Button>
                  <SubmitButton pending={isSubmitting} disabled={!canSubmit}>
                    <KeyRound className="size-4" />
                    {t("generateAccessCode")}
                  </SubmitButton>
                </DialogFooter>
              )}
            </form.Subscribe>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
