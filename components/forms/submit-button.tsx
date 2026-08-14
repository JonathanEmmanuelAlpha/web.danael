"use client";

import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<typeof Button>;

export interface SubmitButtonProps extends Omit<
  ButtonProps,
  "type" | "onClick"
> {
  /** TanStack Form instance (from useForm()). */
  form: any; // Le typage exact est trop complexe, on utilise any
  /** Label shown when idle. */
  idleLabel: ReactNode;
  /** Label shown when submitting (default: idleLabel). */
  pendingLabel?: ReactNode;
  /** Extra disable condition (e.g. Clerk not loaded). */
  disabledExtra?: boolean;
  /** Button variant. */
  variant?: ButtonProps["variant"];
}

/**
 * Submit button bound to a TanStack Form instance via form.useStore.
 * Renders a native <button type="submit"> that's disabled while submitting
 * or when the form can't be submitted (validation errors).
 */
export function SubmitButton({
  form,
  idleLabel,
  pendingLabel,
  disabledExtra,
  children,
  variant = "brand",
  ...props
}: SubmitButtonProps) {
  // Utilisation de form.useStore (non déprécié)
  const canSubmit = form.useStore((state: any) => state.canSubmit);
  const isSubmitting = form.useStore((state: any) => state.isSubmitting);

  const disabled = !canSubmit || isSubmitting || disabledExtra;

  return (
    <Button type="submit" variant={variant} disabled={disabled} {...props}>
      {isSubmitting ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {pendingLabel ?? idleLabel}
        </>
      ) : (
        (children ?? idleLabel)
      )}
    </Button>
  );
}

export interface SubmitButtonRawProps extends Omit<
  ButtonProps,
  "type" | "onClick"
> {
  isSubmitting: boolean;
  canSubmit?: boolean;
  idleLabel: ReactNode;
  pendingLabel?: ReactNode;
  disabledExtra?: boolean;
  variant?: ButtonProps["variant"];
}

/**
 * Raw submit button that does NOT require a form instance.
 * Use when you manage submission state manually.
 */
export function SubmitButtonRaw({
  isSubmitting,
  canSubmit = true,
  disabledExtra,
  idleLabel,
  pendingLabel,
  variant = "brand",
  ...props
}: SubmitButtonRawProps) {
  const disabled = !canSubmit || isSubmitting || disabledExtra;
  return (
    <Button type="submit" variant={variant} disabled={disabled} {...props}>
      {isSubmitting ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {pendingLabel ?? idleLabel}
        </>
      ) : (
        idleLabel
      )}
    </Button>
  );
}
