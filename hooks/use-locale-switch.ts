"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useTransition } from "react";
import { locales, type Locale } from "@/i18n/constants";

/**
 * Client hook to switch the active locale (without URL routing).
 * Sets the `NEXT_LOCALE` cookie and refreshes the page.
 */
export function useLocaleSwitch() {
  const router = useRouter();
  const activeLocale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();

  function switchLocale(next: Locale) {
    if (next === activeLocale) return;
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  return { activeLocale, locales, switchLocale, isPending };
}
