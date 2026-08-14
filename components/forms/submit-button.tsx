"use client";

import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

/* ─────────────────────────────────────────────────────────────
   SubmitButton — ergonomic submit button bound to TanStack Form.
   
   Two usage patterns:
   
   1) Inside a <form.Field> subtree, pass the `form` instance:
      const form = useForm({ ... });
      <SubmitButton form={form} idleLabel="Sign in" pendingLabel="Signing in…" />
   
   2) Outside a form context (raw):
      <SubmitButtonRaw isSubmitting={isSubmitting} idleLabel="Submit" />
   ───────────────────────────────────────────────────────────── */

// Minimal form instance shape we need (avoids coupling to TanStack internals).
interface FormSubscribeLike {
  Subscribe: (props: {
    selector: (s: { canSubmit: boolean; isSubmitting: boolean }) => unknown;
    children: (state: { canSubmit: boolean; isSubmitting: boolean }) => ReactNode;
  }) => ReactNode;
}

export interface SubmitButtonProps extends Omit<ButtonProps, "type" | "onClick"> {
  /** TanStack Form instance (from useForm()). */
  form: FormSubscribeLike;
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
 * Submit button bound to a TanStack Form instance via form.Subscribe.
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
  return (
    <form.Subscribe
      selector={(s) => ({
        canSubmit: s.canSubmit,
        isSubmitting: s.isSubmitting,
      })}
    >
      {({ canSubmit, isSubmitting }) => {
        const disabled = !canSubmit || isSubmitting || disabledExtra;
        return (
          <Button type="submit" variant={variant} disabled={disabled} {...props}>
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {pendingLabel ?? idleLabel}
              </>
            ) : (
              children ?? idleLabel
            )}
          </Button>
        );
      }}
    </form.Subscribe>
  );
}

export interface SubmitButtonRawProps extends Omit<ButtonProps, "type" | "onClick"> {
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
