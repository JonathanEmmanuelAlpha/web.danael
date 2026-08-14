"use client";

import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { ReactNode } from "react";

/* ─────────────────────────────────────────────────────────────
   FormField helpers — bind TanStack Form fields to styled controls.
   Supports Zod v4 / v3.24+ Standard Schema (no adapter needed).
   ───────────────────────────────────────────────────────────── */

interface FieldMeta {
  isTouched: boolean;
  errors: Array<{ message?: string } | string | undefined>;
}

export interface FieldApiLike<TValue> {
  state: {
    value: TValue;
    meta: FieldMeta;
  };
  handleBlur: () => void;
  handleChange: (value: TValue) => void;
}

function extractError(raw: unknown): string | undefined {
  if (typeof raw === "object" && raw !== null && "message" in raw) {
    const msg = (raw as { message?: string }).message;
    if (msg) return msg;
  }
  if (typeof raw === "string") return raw;
  return undefined;
}

export function hasFieldError<TValue>(
  field: FieldApiLike<TValue>,
): { hasError: boolean; errorMessage?: string } {
  const hasError = field.state.meta.isTouched && field.state.meta.errors.length > 0;
  const errorMessage = extractError(field.state.meta.errors[0]);
  return { hasError, errorMessage };
}

export interface TextFieldProps {
  field: FieldApiLike<string>;
  label?: string;
  hideLabel?: boolean;
  hint?: string;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "url";
  leftIcon?: ReactNode;
  className?: string;
  inputClassName?: string;
  autoComplete?: string;
}

/**
 * Text/email input bound to a TanStack Form field, with label + error.
 */
export function TextField({
  field,
  label,
  hideLabel,
  hint,
  placeholder,
  type = "text",
  leftIcon,
  className,
  inputClassName,
  autoComplete,
}: TextFieldProps) {
  const t = useTranslations("Common");
  const { hasError, errorMessage } = hasFieldError(field);
  const fieldId = `field-${label ?? placeholder ?? "input"}`;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={fieldId} className={cn(hideLabel && "sr-only")}>
          {label}
        </Label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            {leftIcon}
          </span>
        )}
        <Input
          id={fieldId}
          type={type}
          inputMode={type === "email" ? "email" : type === "tel" ? "tel" : undefined}
          autoComplete={autoComplete ?? (type === "email" ? "email" : type === "tel" ? "tel" : "off")}
          placeholder={placeholder}
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={(e) => field.handleChange(e.target.value)}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${fieldId}-error` : undefined}
          className={cn(
            "h-12 rounded-xl",
            leftIcon && "pl-11",
            hasError && "border-destructive/60 focus:border-destructive focus:ring-destructive/25",
            inputClassName,
          )}
        />
      </div>
      {hasError ? (
        <p id={`${fieldId}-error`} className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          {errorMessage ?? t("error")}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export interface FormErrorProps {
  message?: string | null;
  className?: string;
}

/**
 * Global form error alert (shown above a form when submit fails).
 */
export function FormError({ message, className }: FormErrorProps) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive",
        className,
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export interface DividerProps {
  label?: string;
  className?: string;
}

/**
 * Divider with optional centered label ("or continue with").
 */
export function Divider({ label, className }: DividerProps) {
  if (!label) {
    return <div className={cn("h-px bg-border", className)} />;
  }
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
