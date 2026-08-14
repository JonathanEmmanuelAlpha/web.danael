"use client";

import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AuthHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  size?: "default" | "compact";
}

/**
 * Centered header for auth pages (title + subtitle + optional icon).
 */
export function AuthHeader({ title, subtitle, icon, className, size = "default" }: AuthHeaderProps) {
  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      {icon && (
        <div className="mb-4 flex size-16 items-center justify-center rounded-2xl border border-primary-500/30 bg-primary-500/10 text-primary-500">
          {icon}
        </div>
      )}
      <h1
        className={cn(
          "font-display font-bold leading-tight text-white",
          size === "default" ? "text-3xl sm:text-[34px]" : "text-2xl",
        )}
      >
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 text-sm text-white/60">{subtitle}</p>
      )}
    </div>
  );
}

export function AuthSecureFooter({ className }: { className?: string }) {
  const t = useTranslations("Auth");
  return (
    <p className={cn("mt-5 flex items-center justify-center gap-2 text-xs text-white/40", className)}>
      <ShieldCheck className="size-4 text-primary-500" />
      {t("footer.secure")}
    </p>
  );
}
