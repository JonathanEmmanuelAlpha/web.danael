"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateWeeklyTalentTrackAction } from "@/server/actions/talent";

export interface GenerateTrackButtonProps {
  /** Force regenerate even if a track already exists. */
  force?: boolean;
  /** Optional label override (defaults to Navigation.generateTrack). */
  label?: string;
  variant?: "brand" | "outline" | "secondary" | "ghost";
  size?: "sm" | "default" | "lg";
  className?: string;
}

/**
 * Triggers `generateWeeklyTalentTrackAction({ force })` and refreshes
 * the page on success so the new track appears.
 */
export function GenerateTrackButton({
  force = false,
  label,
  variant = "brand",
  size = "default",
  className,
}: GenerateTrackButtonProps) {
  const t = useTranslations("Navigation");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    const res = await generateWeeklyTalentTrackAction({ force });
    setLoading(false);
    if (res.success) {
      toast.success(t("generateTrack"));
      router.refresh();
    } else {
      toast.error(res.error?.message ?? "Could not generate track");
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleGenerate}
      disabled={loading}
      className={className}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Sparkles className="size-4" />
      )}
      {label ?? t("generateTrack")}
    </Button>
  );
}
