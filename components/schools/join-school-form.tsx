"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { KeyRound, ArrowRight, CheckCircle2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import {
  TextField,
  SubmitButton,
  FormErrorBanner,
} from "@/components/forms/tanstack-fields";
import { Button } from "@/components/ui/button";
import { joinSchoolManagementAction } from "@/server/actions/school-access";

const joinSchema = z.object({
  accessCode: z
    .string()
    .min(6, "Le code doit comporter au moins 6 caractères")
    .max(20, "Le code est trop long")
    .regex(/^[A-Z0-9]+$/, "Caractères autorisés: A-Z et 0-9"),
});

type JoinValues = z.infer<typeof joinSchema>;

interface JoinSchoolFormProps {
  onJoined: (requestId: string, schoolId: string) => void;
}

/**
 * School onboarding — "Join" tab.
 *
 * Lets a school_admin request access to co-manage an existing school by
 * entering the access code shared by the school creator.
 *
 * After submit:
 *  - On success → show "Demande envoyée" success state with a button to
 *    continue to the dashboard.
 *  - The user is NOT yet a member — they are "waiting" for the school
 *    creator to approve their request.
 */
export function JoinSchoolForm({ onJoined }: JoinSchoolFormProps) {
  const t = useTranslations("Schools");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{
    schoolName?: string;
  } | null>(null);

  const form = useForm({
    defaultValues: {
      accessCode: "",
    } as JoinValues,
    validators: {
      onChange: joinSchema,
    },
    onSubmit: async ({ value }) => {
      setServerError(null);
      const result = await joinSchoolManagementAction({
        accessCode: value.accessCode.trim().toUpperCase(),
      });
      if (!result.success) {
        const msg = result.error?.message ?? t("joinSchool");
        setServerError(msg);
        toast.error(msg);
        return;
      }
      if (!result.data) {
        const msg = t("joinSchool");
        setServerError(msg);
        toast.error(msg);
        return;
      }
      toast.success(t("joinRequestSent"));
      onJoined(result.data.requestId, result.data.schoolId);
      setSubmitted({ schoolName: result.data.schoolName });
    },
  });

  // Success state — show "Demande envoyée" panel
  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader
          title={t("joinRequestSent")}
          description={t("joinRequestSentHint")}
          icon={<CheckCircle2 className="size-6" />}
        />
        <SectionCard className="mt-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="glass flex size-16 items-center justify-center rounded-2xl text-primary-400 glow-primary-sm">
              <CheckCircle2 className="size-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-display text-lg font-semibold text-foreground">
                {t("joinRequestSent")}
              </h3>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                {t("joinRequestSentHint")}
              </p>
              {submitted.schoolName && (
                <p className="text-xs text-muted-foreground">
                  {submitted.schoolName}
                </p>
              )}
            </div>
            <Button
              variant="brand"
              size="lg"
              className="mt-2 w-full max-w-xs"
              onClick={() => router.push("/dashboard")}
            >
              {tCommon("continue")}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={t("joinASchool")}
        description={t("joinSchoolDescription")}
        icon={<KeyRound className="size-6" />}
      />
      <SectionCard className="mt-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
          className="space-y-5"
        >
          <form.Field name="accessCode">
            {(field) => (
              <TextField
                field={field}
                label={t("accessCode")}
                placeholder={t("accessCodePlaceholder")}
                description={t("accessCodeHint")}
                required
                autoFocus
                inputClassName="font-mono text-lg uppercase tracking-[0.2em] text-center"
                leading={<KeyRound className="size-4" />}
              />
            )}
          </form.Field>

          {serverError && <FormErrorBanner message={serverError} />}

          <form.Subscribe
            selector={(state) =>
              [state.canSubmit, state.isSubmitting, state.errors] as const
            }
          >
            {([canSubmit, isSubmitting, errors]) => (
              <>
                {errors.length > 0 && (
                  <FormErrorBanner message="Veuillez saisir un code d'accès valide" />
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.back()}
                    disabled={isSubmitting}
                  >
                    {tCommon("back")}
                  </Button>
                  <SubmitButton
                    pending={isSubmitting}
                    disabled={!canSubmit}
                    size="lg"
                  >
                    <LogIn className="size-4" />
                    {t("joinSchool")}
                  </SubmitButton>
                </div>
              </>
            )}
          </form.Subscribe>
        </form>
      </SectionCard>
    </div>
  );
}
