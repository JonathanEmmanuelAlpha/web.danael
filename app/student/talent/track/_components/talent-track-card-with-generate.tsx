"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  TalentTrackCard,
  type TalentTrackCardProps,
} from "@/components/talent/talent-track-card";
import { generateWeeklyTalentTrackAction } from "@/server/actions/talent";

type Track = NonNullable<TalentTrackCardProps["track"]>;

export interface TalentTrackCardWithGenerateProps {
  track: Track | null;
  /** Force regenerate (default: false, useful for "regenerate" CTAs). */
  force?: boolean;
}

/**
 * Client wrapper around `TalentTrackCard` that wires the `onGenerate`
 * callback to `generateWeeklyTalentTrackAction({ force })`. Used so the
 * empty-state "Generate track" button inside the card actually works.
 */
export function TalentTrackCardWithGenerate({
  track,
  force = false,
}: TalentTrackCardWithGenerateProps) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    const res = await generateWeeklyTalentTrackAction({ force });
    setGenerating(false);
    if (res.success) {
      toast.success("Track generated");
      router.refresh();
    } else {
      toast.error(res.error?.message ?? "Could not generate track");
    }
  }

  return <TalentTrackCard track={track} onGenerate={handleGenerate} generating={generating} />;
}
