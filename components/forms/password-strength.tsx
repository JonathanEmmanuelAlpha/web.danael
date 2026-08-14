"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

function score(pwd: string): 0 | 1 | 2 | 3 {
  if (!pwd) return 0;
  let s = 0;
  if (pwd.length >= 8) s++;
  if (pwd.length >= 12 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s++;
  if (/\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) s++;
  return Math.min(s, 3) as 0 | 1 | 2 | 3;
}

/**
 * 3-segment animated password strength meter (§5.2 reset-password / sign-up).
 * Extracted from original reset-password page (DRY).
 */
export function PasswordStrength({ password }: { password: string }) {
  const t = useTranslations("Auth");
  const s = score(password);
  const label =
    s <= 1
      ? t("resetPassword.strength.weak")
      : s === 2
        ? t("resetPassword.strength.medium")
        : t("resetPassword.strength.strong");
  const color = s <= 1 ? "bg-destructive" : s === 2 ? "bg-warning" : "bg-primary-500";

  return (
    <div className="mt-2 space-y-1.5" aria-live="polite">
      <div className="flex gap-1.5">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-300",
              s >= i ? color : "bg-muted",
            )}
          />
        ))}
      </div>
      {password && <p className="text-xs text-muted-foreground">{label}</p>}
    </div>
  );
}
