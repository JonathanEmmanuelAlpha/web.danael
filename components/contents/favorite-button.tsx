"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toggleFavoriteAction } from "@/server/actions/contents";

export interface FavoriteButtonProps {
  contentId: string;
  initialFavorited?: boolean;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "brand" | "brand-outline";
  showLabel?: boolean;
  className?: string;
}

/**
 * Toggle a favorite on/off for the current user.
 */
export function FavoriteButton({
  contentId,
  initialFavorited = false,
  size = "default",
  variant = "outline",
  showLabel = true,
  className,
}: FavoriteButtonProps) {
  const t = useTranslations("Contents");
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, setPending] = useState(false);

  async function handleToggle() {
    setPending(true);
    const res = await toggleFavoriteAction(contentId);
    setPending(false);
    if (!res.success) {
      toast.error(res.error?.message ?? t("favoriteError"));
      return;
    }
    setFavorited(res.data.favorited);
    toast.success(
      res.data.favorited ? t("favoriteAdded") : t("favoriteRemoved"),
    );
  }

  return (
    <Button
      type="button"
      variant={favorited ? "brand" : variant}
      size={size}
      onClick={handleToggle}
      disabled={pending}
      aria-pressed={favorited}
      aria-label={favorited ? t("removeFavorite") : t("addFavorite")}
      className={cn(className)}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Heart
          className={cn("size-4", favorited && "fill-current")}
          aria-hidden
        />
      )}
      {showLabel && (favorited ? t("removeFavorite") : t("addFavorite"))}
    </Button>
  );
}
