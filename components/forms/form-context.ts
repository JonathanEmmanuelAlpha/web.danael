import { createFormHookContexts } from "@tanstack/react-form";

// Exporte les contextes et les hooks pour les utiliser dans vos composants
export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();
