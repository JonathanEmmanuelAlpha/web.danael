"use client";

import { useTranslations } from "next-intl";
import { Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocaleSwitch } from "@/hooks/use-locale-switch";
import { cn } from "@/lib/utils";
import { LOCALE_LABELS, type Locale } from "@/i18n/constants";

/**
 * Language switcher dropdown (FR / EN) — §22.
 * Sets the `NEXT_LOCALE` cookie and refreshes.
 */
export function LanguageSwitcher({ variant = "ghost" }: { variant?: "ghost" | "outline" }) {
  const t = useTranslations("Common");
  const { activeLocale, switchLocale, isPending } = useLocaleSwitch();
  const current = LOCALE_LABELS[activeLocale];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size="icon"
          disabled={isPending}
          aria-label={t("language")}
          title={current.label}
        >
          <Globe className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {(Object.keys(LOCALE_LABELS) as Locale[]).map((loc) => {
          const meta = LOCALE_LABELS[loc];
          const isActive = loc === activeLocale;
          return (
            <DropdownMenuItem
              key={loc}
              onClick={() => switchLocale(loc)}
              className={cn("cursor-pointer", isActive && "bg-accent")}
            >
              <span className="text-base">{meta.flag}</span>
              <span className="flex-1">{meta.label}</span>
              {isActive && <Check className="size-4 text-primary-600 dark:text-primary-400" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
