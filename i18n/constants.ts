/**
 * Shared i18n constants (safe for both client and server imports).
 *
 * The `request.ts` file uses `next/headers` (server-only), so client code
 * must import from here instead.
 */

export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

export const LOCALE_LABELS: Record<Locale, { label: string; flag: string }> = {
  fr: { label: "Français", flag: "🇫🇷" },
  en: { label: "English", flag: "🇬🇧" },
};
