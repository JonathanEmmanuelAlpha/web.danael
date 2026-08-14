"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import {
  TextField,
  SubmitButton,
} from "@/components/forms/tanstack-fields";
import {
  IconBrandFacebook,
  IconBrandTwitter,
  IconBrandInstagram,
  IconBrandLinkedin,
  IconSend,
} from "@tabler/icons-react";

interface Column {
  titleKey: string;
  links: { labelKey: string; href: string }[];
}

const COLUMNS: Column[] = [
  {
    titleKey: "footer.columns.product",
    links: [
      { labelKey: "footer.links.features", href: "/#features" },
      { labelKey: "footer.links.pricing", href: "/pricing" },
      { labelKey: "footer.links.howItWorks", href: "/how-it-works" },
      { labelKey: "footer.links.testimonials", href: "/testimonials" },
    ],
  },
  {
    titleKey: "footer.columns.company",
    links: [
      { labelKey: "footer.links.about", href: "/contact" },
      { labelKey: "footer.links.contact", href: "/contact" },
      { labelKey: "footer.links.schools", href: "/schools" },
    ],
  },
  {
    titleKey: "footer.columns.resources",
    links: [
      { labelKey: "footer.links.help", href: "/contact" },
      { labelKey: "footer.links.faq", href: "/faq" },
    ],
  },
  {
    titleKey: "footer.columns.legal",
    links: [
      { labelKey: "footer.links.terms", href: "/legal" },
      { labelKey: "footer.links.privacy", href: "/legal/privacy" },
      { labelKey: "footer.links.cookies", href: "/legal/cookies" },
    ],
  },
];

const SOCIALS = [
  { icon: IconBrandFacebook, href: "https://facebook.com", label: "Facebook" },
  { icon: IconBrandTwitter, href: "https://twitter.com", label: "Twitter" },
  {
    icon: IconBrandInstagram,
    href: "https://instagram.com",
    label: "Instagram",
  },
  { icon: IconBrandLinkedin, href: "https://linkedin.com", label: "LinkedIn" },
];

const newsletterSchema = z.object({
  email: z
    .string()
    .min(1, "Email requis")
    .email("Adresse email invalide"),
});

type NewsletterValues = z.infer<typeof newsletterSchema>;

interface FooterProps {
  variant?: "default" | "inverted";
  className?: string;
}

/**
 * Rich footer (§5.1 — Liens, social, légal).
 * Contains link columns + social + newsletter form (TanStack Form + Zod).
 */
export function Footer({ variant = "default", className }: FooterProps) {
  const t = useTranslations("Public");
  const [subscribed, setSubscribed] = React.useState(false);

  const newsletterForm = useForm({
    defaultValues: { email: "" } as NewsletterValues,
    validators: { onChange: newsletterSchema },
    onSubmit: async () => {
      setSubscribed(true);
      newsletterForm.reset({ email: "" });
      // Reset the success message after 4s
      setTimeout(() => setSubscribed(false), 4000);
    },
  });

  const isInverted = variant === "inverted";

  return (
    <footer
      className={cn(
        "mt-auto border-t",
        isInverted
          ? "border-white/5 bg-secondary-900 text-white"
          : "border-border bg-card text-foreground",
        className,
      )}
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Brand + newsletter */}
          <div className="lg:col-span-4">
            <Logo variant={isInverted ? "light" : "default"} />
            <p
              className={cn(
                "mt-4 max-w-sm text-sm leading-relaxed",
                isInverted ? "text-white/60" : "text-muted-foreground",
              )}
            >
              {t("footer.tagline")}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void newsletterForm.handleSubmit();
              }}
              className="mt-6 max-w-sm"
            >
              <p
                className={cn(
                  "text-xs font-semibold uppercase tracking-wide",
                  isInverted ? "text-white/40" : "text-muted-foreground",
                )}
              >
                {t("footer.newsletter.title")}
              </p>
              <p
                className={cn(
                  "mt-1 text-xs",
                  isInverted ? "text-white/50" : "text-muted-foreground",
                )}
              >
                {t("footer.newsletter.subtitle")}
              </p>
              <div className="mt-3 flex gap-2">
                <newsletterForm.Field name="email">
                  {(field) => (
                    <TextField
                      field={field}
                      type="email"
                      required
                      label={
                        <span className="sr-only">
                          {t("footer.newsletter.placeholder")}
                        </span>
                      }
                      placeholder={t("footer.newsletter.placeholder")}
                      className="flex-1"
                      inputClassName={isInverted ? "danael-input" : undefined}
                    />
                  )}
                </newsletterForm.Field>
                <newsletterForm.Subscribe
                  selector={(state) =>
                    [state.canSubmit, state.isSubmitting] as const
                  }
                >
                  {([canSubmit, isSubmitting]) => (
                    <SubmitButton
                      pending={isSubmitting}
                      disabled={!canSubmit}
                      variant="brand"
                      size="icon"
                      aria-label={t("footer.newsletter.cta")}
                    >
                      <IconSend className="size-4" />
                    </SubmitButton>
                  )}
                </newsletterForm.Subscribe>
              </div>
              {subscribed && (
                <p
                  className="mt-2 text-xs text-primary-600 dark:text-primary-400"
                  role="status"
                >
                  {t("footer.newsletter.success")}
                </p>
              )}
            </form>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8">
            {COLUMNS.map((col) => (
              <div key={col.titleKey}>
                <h3
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wide",
                    isInverted ? "text-white/40" : "text-muted-foreground",
                  )}
                >
                  {t(col.titleKey as never)}
                </h3>
                <ul className="mt-3 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.labelKey}>
                      <Link
                        href={link.href}
                        className={cn(
                          "text-sm transition-colors hover:text-primary-600 dark:hover:text-primary-400",
                          isInverted ? "text-white/70" : "text-foreground/80",
                        )}
                      >
                        {t(link.labelKey as never)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div
          className={cn(
            "mt-10 flex flex-col items-start justify-between gap-4 border-t pt-6 sm:flex-row sm:items-center",
            isInverted ? "border-white/5" : "border-border",
          )}
        >
          <p
            className={cn(
              "text-xs",
              isInverted ? "text-white/40" : "text-muted-foreground",
            )}
          >
            © {new Date().getFullYear()} Danaël · {t("footer.rights")} ·{" "}
            {t("footer.madeIn")} 🇨🇲
          </p>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-xs",
                isInverted ? "text-white/40" : "text-muted-foreground",
              )}
            >
              {t("footer.social")}
            </span>
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg transition-all hover:scale-110",
                  isInverted
                    ? "bg-white/[0.04] text-white/60 hover:bg-primary-500 hover:text-white"
                    : "bg-muted text-muted-foreground hover:bg-primary-500 hover:text-primary-foreground",
                )}
              >
                <s.icon className="size-4" aria-hidden />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
