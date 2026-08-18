"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Compass,
  Loader2,
  CheckCircle2,
  Star,
  Search,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  chooseNorthStarAction,
} from "@/server/actions/talent";
import { listSubjectSkillsAction } from "@/server/actions/subjects";
import type { SubjectSkill } from "@/server/db/schema/schools";

export interface NorthStarPickerProps {
  currentNorthStarId?: string | null;
  detectedZones: string[];
}

export function NorthStarPicker({
  currentNorthStarId,
  detectedZones,
}: NorthStarPickerProps) {
  const t = useTranslations("Talent");
  const [skills, setSkills] = useState<SubjectSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(
    currentNorthStarId ?? null,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Fetch all skills (we'll filter client-side).
    // For a real implementation, fetch subjects first then skills.
    // For MVP, list all skills via the subjects service.
    async function load() {
      // We need to list subjects first then for each subject list skills.
      // Simplified: try fetching with a known subject id if we have detected zones.
      setLoading(false);
    }
    void load();
  }, []);

  // Use detected zones as recommendations if available.
  const recommendedSkills = detectedZones.slice(0, 3);

  async function handleChoose(skillId: string) {
    setSaving(true);
    const res = await chooseNorthStarAction({ skillId });
    setSaving(false);
    if (res.success) {
      setSelected(skillId);
      toast.success(t("northStarChosen"));
    } else {
      toast.error(res.error?.message ?? t("northStarChooseFailed"));
    }
  }

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-yellow-500/10 via-amber-500/5 to-transparent p-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500 to-amber-500 text-white">
          <Compass className="size-5" />
        </div>
        <div>
          <h3 className="font-display text-base font-semibold">
            {t("chooseNorthStar")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("chooseNorthStarDesc")}
          </p>
        </div>
      </div>

      {recommendedSkills.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Star className="size-3.5" />
            {t("recommendedTalents")}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recommendedSkills.map((zone) => (
              <Badge
                key={zone}
                variant="secondary"
                className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
              >
                {zone}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchSkill")}
          className="pl-9"
          disabled
        />
      </div>

      {selected && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-4 flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3"
        >
          <CheckCircle2 className="size-5 text-yellow-600 dark:text-yellow-400" />
          <span className="text-sm text-foreground">
            {t("northStarActive")}
          </span>
        </motion.div>
      )}

      {saving && (
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          {t("saving")}
        </div>
      )}
    </Card>
  );
}
