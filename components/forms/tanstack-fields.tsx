/**
 * TanStack Form field wrappers built on top of shadcn/ui components.
 *
 * Usage:
 *   const form = useForm({
 *     defaultValues: { name: "" },
 *     validators: { onChange: z.object({ name: z.string().min(1) }) },
 *   });
 *
 *   <form.Field name="name">
 *     {(field) => (
 *       <TextField field={field} label="Nom" placeholder="Votre nom" />
 *     )}
 *   </form.Field>
 *
 * These wrappers ensure every form in the app uses shadcn/ui inputs (not native
 * HTML inputs) and TanStack Form (not useState).
 */

"use client";

import * as React from "react";
import {
  useStore,
  type FieldApi,
  type ValidationError,
} from "@tanstack/react-form";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/forms/date-picker";
import type { AnyFieldApi } from "@tanstack/react-form";

/* -- Shared bits ------------------------------------------------ */

interface FieldShellProps {
  label?: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  error?: string | undefined;
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

function FieldShell({
  label,
  htmlFor,
  required,
  error,
  description,
  className,
  children,
}: FieldShellProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
      )}
      {children}
      {description && !error && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {error && (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function useFieldError<TData>(field: AnyFieldApi): string | undefined {
  return useStore(field.store, (state) => {
    const meta = state.meta;
    if (!meta.isTouched) return undefined;
    const errs: ValidationError[] = meta.errors ?? [];
    if (errs.length === 0) return undefined;
    const first = errs[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "message" in first) {
      return String((first as { message: unknown }).message);
    }
    return undefined;
  });
}

/* -- Text field ------------------------------------------------ */

interface TextFieldProps<TData> {
  field: AnyFieldApi;
  label?: React.ReactNode;
  description?: React.ReactNode;
  placeholder?: string;
  required?: boolean;
  type?: React.HTMLInputTypeAttribute;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  inputClassName?: string;
  /** Render a button/icon inside the input on the left. */
  leading?: React.ReactNode;
  /** Render a button/icon inside the input on the right. */
  trailing?: React.ReactNode;
}

export function TextField<TData>({
  field,
  label,
  description,
  placeholder,
  required,
  type = "text",
  disabled,
  autoFocus,
  className,
  inputClassName,
  leading,
  trailing,
}: TextFieldProps<TData>) {
  const error = useFieldError(field);
  const fieldId = `field-${field.name}`;
  const isInvalid = Boolean(error);

  return (
    <FieldShell
      label={label}
      htmlFor={fieldId}
      required={required}
      error={error}
      description={description}
      className={className}
    >
      <div className="relative">
        {leading && (
          <div className="pointer-events-none absolute z-10 left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {leading}
          </div>
        )}
        <Input
          id={fieldId}
          name={field.name}
          type={type}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={isInvalid}
          value={(field.state.value as string | undefined) ?? ""}
          onChange={(e) => field.handleChange(e.target.value as never)}
          onBlur={field.handleBlur}
          className={cn(leading && "pl-9", trailing && "pr-9", inputClassName)}
        />
        {trailing && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {trailing}
          </div>
        )}
      </div>
    </FieldShell>
  );
}

/* -- Textarea field -------------------------------------------- */

interface TextAreaFieldProps<TData> {
  field: AnyFieldApi;
  label?: React.ReactNode;
  description?: React.ReactNode;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  className?: string;
  inputClassName?: string;
}

export function TextAreaField<TData>({
  field,
  label,
  description,
  placeholder,
  required,
  disabled,
  rows = 4,
  className,
  inputClassName,
}: TextAreaFieldProps<TData>) {
  const error = useFieldError(field);
  const fieldId = `field-${field.name}`;
  return (
    <FieldShell
      label={label}
      htmlFor={fieldId}
      required={required}
      error={error}
      description={description}
      className={className}
    >
      <Textarea
        id={fieldId}
        name={field.name}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        rows={rows}
        aria-invalid={Boolean(error)}
        className={inputClassName}
        value={(field.state.value as string | undefined) ?? ""}
        onChange={(e) => field.handleChange(e.target.value as never)}
        onBlur={field.handleBlur}
      />
    </FieldShell>
  );
}

/* -- Select field ---------------------------------------------- */

interface SelectFieldProps<TData> {
  field: AnyFieldApi;
  label?: React.ReactNode;
  description?: React.ReactNode;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  options: Array<{ value: string; label: React.ReactNode }>;
}

export function SelectField<TData>({
  field,
  label,
  description,
  placeholder,
  required,
  disabled,
  className,
  triggerClassName,
  options,
}: SelectFieldProps<TData>) {
  const error = useFieldError(field);
  const fieldId = `field-${field.name}`;
  const value = (field.state.value as string | undefined) ?? "";

  return (
    <FieldShell
      label={label}
      htmlFor={fieldId}
      required={required}
      error={error}
      description={description}
      className={className}
    >
      <Select
        value={value}
        onValueChange={(v) => field.handleChange(v as never)}
        disabled={disabled}
      >
        <SelectTrigger
          id={fieldId}
          className={cn("w-full", triggerClassName)}
          aria-invalid={Boolean(error)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}

/* -- Date field ------------------------------------------------ */

interface DateFieldProps<TData> {
  field: AnyFieldApi;
  label?: React.ReactNode;
  description?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function DateField<TData>({
  field,
  label,
  description,
  required,
  disabled,
  className,
  placeholder,
}: DateFieldProps<TData>) {
  const error = useFieldError(field);
  const fieldId = `field-${field.name}`;
  const value = field.state.value as Date | undefined | null;

  return (
    <FieldShell
      label={label}
      htmlFor={fieldId}
      required={required}
      error={error}
      description={description}
      className={className}
    >
      <DatePicker
        value={value ?? undefined}
        onChange={(d) => field.handleChange((d ?? null) as never)}
        placeholder={placeholder}
      />
    </FieldShell>
  );
}

/* -- Checkbox field -------------------------------------------- */

interface CheckboxFieldProps<TData> {
  field: AnyFieldApi;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export function CheckboxField<TData>({
  field,
  label,
  description,
  disabled,
  className,
}: CheckboxFieldProps<TData>) {
  const error = useFieldError(field);
  const fieldId = `field-${field.name}`;
  const checked = Boolean(field.state.value);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-start gap-2.5">
        <Checkbox
          id={fieldId}
          checked={checked}
          onCheckedChange={(v) => field.handleChange(Boolean(v) as never)}
          disabled={disabled}
          aria-invalid={Boolean(error)}
        />
        {label && (
          <div className="space-y-0.5">
            <Label
              htmlFor={fieldId}
              className="text-sm font-medium cursor-pointer"
            >
              {label}
            </Label>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/* -- Switch field ---------------------------------------------- */

interface SwitchFieldProps<TData> {
  field: AnyFieldApi;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export function SwitchField<TData>({
  field,
  label,
  description,
  disabled,
  className,
}: SwitchFieldProps<TData>) {
  const error = useFieldError(field);
  const fieldId = `field-${field.name}`;
  const checked = Boolean(field.state.value);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          {label && (
            <Label
              htmlFor={fieldId}
              className="text-sm font-medium cursor-pointer"
            >
              {label}
            </Label>
          )}
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <Switch
          id={fieldId}
          checked={checked}
          onCheckedChange={(v) => field.handleChange(Boolean(v) as never)}
          disabled={disabled}
          aria-invalid={Boolean(error)}
        />
      </div>
      {error && (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/* -- Radio group field ----------------------------------------- */

interface RadioGroupFieldProps<TData> {
  field: AnyFieldApi;
  label?: React.ReactNode;
  description?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  options: Array<{
    value: string;
    label: React.ReactNode;
    description?: React.ReactNode;
  }>;
}

export function RadioGroupField<TData>({
  field,
  label,
  description,
  required,
  disabled,
  className,
  options,
}: RadioGroupFieldProps<TData>) {
  const error = useFieldError(field);
  const value = (field.state.value as string | undefined) ?? "";

  return (
    <FieldShell
      label={label}
      required={required}
      error={error}
      description={description}
      className={className}
    >
      <RadioGroup
        value={value}
        onValueChange={(v) => field.handleChange(v as never)}
        disabled={disabled}
        className="gap-2"
      >
        {options.map((opt) => (
          <div
            key={opt.value}
            className="flex items-start gap-2.5 rounded-lg border border-border p-3 hover:bg-accent/40"
          >
            <RadioGroupItem
              value={opt.value}
              id={`${field.name}-${opt.value}`}
            />
            <div className="space-y-0.5">
              <Label
                htmlFor={`${field.name}-${opt.value}`}
                className="text-sm font-medium cursor-pointer"
              >
                {opt.label}
              </Label>
              {opt.description && (
                <p className="text-xs text-muted-foreground">
                  {opt.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </RadioGroup>
    </FieldShell>
  );
}

/* -- Number field ---------------------------------------------- */

interface NumberFieldProps<TData> {
  field: AnyFieldApi;
  label?: React.ReactNode;
  description?: React.ReactNode;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  min?: number;
  max?: number;
  step?: number;
}

export function NumberField<TData>({
  field,
  label,
  description,
  placeholder,
  required,
  disabled,
  className,
  inputClassName,
  min,
  max,
  step,
}: NumberFieldProps<TData>) {
  const error = useFieldError(field);
  const fieldId = `field-${field.name}`;
  const isInvalid = Boolean(error);
  const value = field.state.value as number | undefined | null;

  return (
    <FieldShell
      label={label}
      htmlFor={fieldId}
      required={required}
      error={error}
      description={description}
      className={className}
    >
      <Input
        id={fieldId}
        name={field.name}
        type="number"
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        aria-invalid={isInvalid}
        className={inputClassName}
        value={value === null || value === undefined ? "" : String(value)}
        onChange={(e) =>
          field.handleChange(
            (e.target.value === ""
              ? undefined
              : Number(e.target.value)) as never,
          )
        }
        onBlur={field.handleBlur}
      />
    </FieldShell>
  );
}

/* -- Search field (live search, no submit) --------------------- */

interface SearchFieldProps<TData> {
  field: AnyFieldApi;
  placeholder?: string;
  className?: string;
  onChange?: (value: string) => void;
}

export function SearchField<TData>({
  field,
  placeholder,
  className,
  onChange,
}: SearchFieldProps<TData>) {
  const fieldId = `field-${field.name}`;
  return (
    <div className={cn("relative", className)}>
      <Input
        id={fieldId}
        type="search"
        placeholder={placeholder}
        value={(field.state.value as string | undefined) ?? ""}
        onChange={(e) => {
          field.handleChange(e.target.value as never);
          onChange?.(e.target.value);
        }}
        onBlur={field.handleBlur}
        className="pl-9"
      />
    </div>
  );
}

/* -- Time field ------------------------------------------------ */

interface TimeFieldProps<TData> {
  field: AnyFieldApi;
  label?: React.ReactNode;
  description?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function TimeField<TData>({
  field,
  label,
  description,
  required,
  disabled,
  className,
}: TimeFieldProps<TData>) {
  const error = useFieldError(field);
  const fieldId = `field-${field.name}`;
  return (
    <FieldShell
      label={label}
      htmlFor={fieldId}
      required={required}
      error={error}
      description={description}
      className={className}
    >
      <Input
        id={fieldId}
        type="time"
        required={required}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        value={(field.state.value as string | undefined) ?? ""}
        onChange={(e) => field.handleChange(e.target.value as never)}
        onBlur={field.handleBlur}
      />
    </FieldShell>
  );
}

/* -- Submit button --------------------------------------------- */

interface SubmitButtonProps {
  pending?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  variant?:
    | "default"
    | "brand"
    | "brand-outline"
    | "ghost"
    | "outline"
    | "destructive";
  size?: "sm" | "default" | "lg" | "icon";
}

export function SubmitButton({
  pending,
  disabled,
  children,
  className,
  variant = "brand",
  size = "default",
}: SubmitButtonProps) {
  // Importing Button lazily to avoid circular imports in some edge cases
  const { Button } = require("@/components/ui/button") as {
    Button: React.ComponentType<{
      variant?: string;
      size?: string;
      type?: "submit" | "button" | "reset";
      disabled?: boolean;
      className?: string;
      children: React.ReactNode;
    }>;
  };

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={pending || disabled}
      className={className}
    >
      {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
      {children}
    </Button>
  );
}

/* -- Form error (top-level) ------------------------------------ */

export function FormErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </div>
  );
}
