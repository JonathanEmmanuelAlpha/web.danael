"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Theme switcher (light / dark / system) — §6.7.
 */
export function ThemeToggle({ variant = "ghost" }: { variant?: "ghost" | "outline" }) {
  const t = useTranslations("Common");
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="icon" aria-label={t("theme")} title={t("theme")}>
          <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className={cn("cursor-pointer", theme === "light" && "bg-accent")}
        >
          <Sun className="size-4" />
          {t("light")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className={cn("cursor-pointer", theme === "dark" && "bg-accent")}
        >
          <Moon className="size-4" />
          {t("dark")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className={cn("cursor-pointer", theme === "system" && "bg-accent")}
        >
          <Monitor className="size-4" />
          {t("system")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
