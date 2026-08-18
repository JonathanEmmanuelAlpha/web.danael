"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateMentorRecommendationsAction } from "@/server/actions/talent";

export interface GenerateMentorRecosButtonProps {
  label?: string;
  variant?: "brand" | "outline" | "secondary" | "ghost";
  size?: "sm" | "default" | "lg";
  className?: string;
}

export function GenerateMentorRecosButton({
  label,
  variant = "brand",
  size = "default",
  className,
}: GenerateMentorRecosButtonProps) {
  const t = useTranslations("Navigation");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    const res = await generateMentorRecommendationsAction();
    setLoading(false);
    if (res.success) {
      toast.success(t("generateMentorRecos"));
      router.refresh();
    } else {
      toast.error(res.error?.message ?? "Could not generate recommendations");
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
      {label ?? t("generateMentorRecos")}
    </Button>
  );
}
