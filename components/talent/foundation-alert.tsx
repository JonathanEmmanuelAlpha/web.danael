"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, X, ShieldAlert, TrendingDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface FloorAlertData {
  skillId: string;
  skillName?: string;
  mastery: number;
  breachCount: number;
}

export interface FoundationAlertProps {
  alerts: FloorAlertData[];
  onDismiss?: () => void;
}

export function FoundationAlert({ alerts, onDismiss }: FoundationAlertProps) {
  const t = useTranslations("Talent");

  if (alerts.length === 0) return null;

  const isPaused = alerts.length >= 3;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
      >
        <Card
          className={`relative overflow-hidden border-0 p-5 ${
            isPaused
              ? "bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-transparent"
              : "bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                isPaused
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              }`}
            >
              {isPaused ? <ShieldAlert className="size-5" /> : <AlertTriangle className="size-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-semibold text-foreground">
                  {isPaused ? t("talentTrackPaused") : t("foundationAlert")}
                </h3>
                {isPaused && (
                  <Badge variant="destructive" className="text-[10px]">
                    {t("paused")}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {isPaused
                  ? t("talentTrackPausedDesc", { count: alerts.length })
                  : t("foundationAlertDesc", { count: alerts.length })}
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {alerts.map((alert) => (
                  <Badge
                    key={alert.skillId}
                    variant="outline"
                    className="gap-1 border-rose-500/30 bg-rose-500/5"
                  >
                    <TrendingDown className="size-3" />
                    {alert.skillName ?? t("unknownSkill")}: {Math.round(alert.mastery)}%
                  </Badge>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href="/student/learning">
                    {t("reviewFoundation")}
                  </a>
                </Button>
                {onDismiss && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDismiss}
                    className="text-muted-foreground"
                  >
                    <X className="size-3.5" />
                    {t("dismiss")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
