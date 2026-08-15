import { createFormHook } from "@tanstack/react-form";
import { fieldContext, formContext } from "./form-context";
import { SubmitButton } from "@/components/forms/submit-button";

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {},
  formComponents: {
    SubmitButton,
  },
});

// Optionnel : exporter le type pour une utilisation ultérieure
export type UseAppForm = ReturnType<typeof useAppForm>;
