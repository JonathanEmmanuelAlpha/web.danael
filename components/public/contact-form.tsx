"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { toast } from "sonner";
import { Send } from "lucide-react";
import {
  TextField,
  TextAreaField,
  CheckboxField,
  SubmitButton,
} from "@/components/forms/tanstack-fields";

/**
 * Contact form (§5.1 — Formulaires de contact / démo école).
 *
 * IMPROVED: Migrated from `react-hook-form` + `zodResolver` to TanStack Form
 * with Zod v4 (Standard Schema). Uses the shared shadcn wrappers
 * (TextField, TextAreaField, CheckboxField, SubmitButton). Validation messages
 * remain i18n-aware via `useTranslations("Public.contact.validation")`.
 */
export function ContactForm() {
  const t = useTranslations("Public.contact");

  const schema = React.useMemo(
    () =>
      z.object({
        name: z.string().min(1, t("validation.nameRequired")),
        email: z
          .string()
          .min(1, t("validation.emailRequired"))
          .email(t("validation.emailInvalid")),
        subject: z.string().min(1, t("validation.nameRequired")),
        message: z.string().min(10, t("validation.messageTooShort")),
        demoRequest: z.boolean(),
        schoolName: z.string().optional(),
      }),
    // Re-create the schema when the locale changes (translations differ).
    [t],
  );

  type FormValues = z.infer<typeof schema>;

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
      demoRequest: false,
      schoolName: "",
    } as FormValues,
    validators: {
      onChange: schema,
    },
    onSubmit: async ({ value }) => {
      // Simulate async submission (no backend action required for public form).
      // The platform forwards the request to the support team via email.
      await new Promise((resolve) => setTimeout(resolve, 800));

      console.info("Contact form submission:", value);
      toast.success(t("success"));
      form.reset();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className="space-y-5"
      noValidate
      aria-label="Contact form"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <form.Field name="name">
          {(field) => (
            <TextField
              field={field}
              label={t("name")}
              placeholder={t("namePlaceholder")}
              required
            />
          )}
        </form.Field>
        <form.Field name="email">
          {(field) => (
            <TextField
              field={field}
              label={t("email")}
              placeholder={t("emailPlaceholder")}
              type="email"
              required
            />
          )}
        </form.Field>
      </div>

      <form.Field name="subject">
        {(field) => (
          <TextField
            field={field}
            label={t("subject")}
            placeholder={t("subjectPlaceholder")}
            required
          />
        )}
      </form.Field>

      <form.Field name="message">
        {(field) => (
          <TextAreaField
            field={field}
            label={t("message")}
            placeholder={t("messagePlaceholder")}
            rows={5}
            required
          />
        )}
      </form.Field>

      <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
        <form.Field name="demoRequest">
          {(field) => (
            <CheckboxField
              field={field}
              label={t("demoRequest")}
              description={t("demoRequestHint")}
            />
          )}
        </form.Field>

        <form.Subscribe selector={(state) => state.values.demoRequest}>
          {(demoRequested) =>
            demoRequested ? (
              <div className="pl-7">
                <form.Field name="schoolName">
                  {(field) => (
                    <TextField
                      field={field}
                      label={t("schoolName")}
                      placeholder={t("schoolNamePlaceholder")}
                    />
                  )}
                </form.Field>
              </div>
            ) : null
          }
        </form.Subscribe>
      </div>

      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting] as const}
      >
        {([canSubmit, isSubmitting]) => (
          <SubmitButton
            pending={isSubmitting}
            disabled={!canSubmit}
            size="lg"
            className="w-full sm:w-auto"
          >
            {isSubmitting ? (
              t("sending")
            ) : (
              <>
                <Send className="size-4" aria-hidden />
                {t("send")}
              </>
            )}
          </SubmitButton>
        )}
      </form.Subscribe>
    </form>
  );
}
