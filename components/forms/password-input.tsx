"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type PasswordInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Show the lock icon on the left (default: true). */
  showLockIcon?: boolean;
};

/**
 * Password input with show/hide toggle and optional lock icon.
 * Extracted from the original sign-in page (DRY).
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showLockIcon = true, ...props }, ref) => {
    const t = useTranslations("Auth");
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        {showLockIcon && (
          <Lock className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn(
            "danael-input h-12 rounded-xl py-3",
            showLockIcon ? "pl-11 pr-12" : "px-4 pr-12",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("fields.hidePassword") : t("fields.showPassword")}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
        >
          {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
