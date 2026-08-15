// src/components/forms/submit-button.tsx
"use client";

import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";
import { useFormContext } from "./form-context";

type ButtonProps = ComponentProps<typeof Button>;

export interface SubmitButtonProps extends Omit<
  ButtonProps,
  "type" | "onClick"
> {
  idleLabel?: ReactNode;
  pendingLabel?: ReactNode;
  disabledExtra?: boolean;
  variant?: ButtonProps["variant"];
  children?: ReactNode;
}

/**
 * Submit button that uses the form context.
 * No need to pass `form` as a prop !
 */
export function SubmitButton({
  idleLabel = "Submit",
  pendingLabel = "Submitting...",
  disabledExtra,
  children,
  variant = "brand",
  ...props
}: SubmitButtonProps) {
  // Récupère le formulaire depuis le contexte !
  const form = useFormContext();

  return (
    <form.Subscribe
      selector={(state: any) => ({
        canSubmit: state.canSubmit,
        isSubmitting: state.isSubmitting,
      })}
    >
      {(state: { canSubmit: boolean; isSubmitting: boolean }) => {
        const { canSubmit, isSubmitting } = state;
        const disabled = !canSubmit || isSubmitting || disabledExtra;
        return (
          <Button
            type="submit"
            variant={variant}
            disabled={disabled}
            {...props}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {pendingLabel}
              </>
            ) : (
              (children ?? idleLabel)
            )}
          </Button>
        );
      }}
    </form.Subscribe>
  );
}
