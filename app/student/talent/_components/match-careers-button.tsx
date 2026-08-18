"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Compass, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { matchCareersAction } from "@/server/actions/talent";

export interface MatchCareersButtonProps {
  label?: string;
  variant?: "brand" | "outline" | "secondary" | "ghost";
  size?: "sm" | "default" | "lg";
  className?: string;
}

export function MatchCareersButton({
  label,
  variant = "brand",
  size = "default",
  className,
}: MatchCareersButtonProps) {
  const t = useTranslations("Navigation");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleMatch() {
    setLoading(true);
    const res = await matchCareersAction();
    setLoading(false);
    if (res.success) {
      toast.success(t("matchCareers"));
      router.refresh();
    } else {
      toast.error(res.error?.message ?? "Could not match careers");
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleMatch}
      disabled={loading}
      className={className}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Compass className="size-4" />
      )}
      {label ?? t("matchCareers")}
    </Button>
  );
}
