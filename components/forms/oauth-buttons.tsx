"use client";

import { Loader2 } from "lucide-react";
import { IconBrandApple, IconBrandFacebook } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "./google-icon";
import { useTranslations } from "next-intl";
import type { OAuthStrategy } from "@/types";

export interface OAuthButtonsProps {
  /** Called when an OAuth button is clicked. */
  onOAuth: (strategy: OAuthStrategy) => void | Promise<void>;
  /** Which strategy is currently pending (disables all buttons). */
  pendingStrategy?: OAuthStrategy | null;
  /** Disable all buttons (e.g. while Clerk is loading). */
  disabled?: boolean;
  /** Layout: "grid" (3 cols) or "stack" (vertical). */
  layout?: "grid" | "stack";
  className?: string;
}

const STRATEGIES: Array<{
  strategy: OAuthStrategy;
  key: "google" | "apple" | "facebook";
  Icon: typeof IconBrandApple;
  brandClass: string;
}> = [
  { strategy: "oauth_google", key: "google", Icon: GoogleIcon, brandClass: "" },
  {
    strategy: "oauth_apple",
    key: "apple",
    Icon: IconBrandApple,
    brandClass: "fill-foreground stroke-transparent",
  },
  {
    strategy: "oauth_facebook",
    key: "facebook",
    Icon: IconBrandFacebook,
    brandClass: "fill-[#1877F2] stroke-transparent",
  },
];

/**
 * OAuth buttons row (Google, Apple, Facebook) — §5.2.
 * Extracted & shared by sign-in + sign-up pages.
 */
export function OAuthButtons({
  onOAuth,
  pendingStrategy,
  disabled,
  layout = "grid",
  className,
}: OAuthButtonsProps) {
  const t = useTranslations("Auth");

  return (
    <div
      className={
        layout === "grid"
          ? `grid grid-cols-3 gap-3 ${className ?? ""}`
          : `flex flex-col gap-3 ${className ?? ""}`
      }
    >
      {STRATEGIES.map(({ strategy, key, Icon, brandClass }) => {
        const isPending = pendingStrategy === strategy;
        return (
          <Button
            key={strategy}
            type="button"
            variant="outline"
            onClick={() => onOAuth(strategy)}
            disabled={disabled || isPending}
            className="danael-btn-outline flex-1 gap-2.5 font-medium"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Icon className={`size-5 ${brandClass}`} />
            )}
            {t(`oauth.${key}`)}
          </Button>
        );
      })}
    </div>
  );
}
