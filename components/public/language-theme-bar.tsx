import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { cn } from "@/lib/utils";

/**
 * Combined language switcher + theme toggle bar for public pages.
 * Used in the public header and footer.
 */
export function LanguageThemeBar({
  variant = "ghost",
  className,
}: {
  variant?: "ghost" | "outline";
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <LanguageSwitcher variant={variant} />
      <ThemeToggle variant={variant} />
    </div>
  );
}
