"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trophy, EyeOff } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge as UIBadge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeaderboardEntry } from "@/server/services/gamification";
import { ApiError } from "@/lib/api-response";

const RANK_STYLES = [
  "bg-amber-400/15 text-amber-600 dark:text-amber-400",
  "bg-slate-400/15 text-slate-600 dark:text-slate-300",
  "bg-orange-700/15 text-orange-700 dark:text-orange-400",
];

export function LeaderboardTable({
  data,
  error,
  currentUserId,
}: {
  error: ApiError | null;
  data: LeaderboardEntry[] | null;
  currentUserId?: string;
}) {
  const t = useTranslations("Gamification");
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(data);

  if (error) {
    return (
      <EmptyState
        icon={Trophy}
        title={t("loadFailed")}
        description={t("loadFailedHint")}
      />
    );
  }

  if (!entries) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title={t("emptyLeaderboard")}
        description={t("emptyLeaderboardHint")}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 text-center">{t("rank")}</TableHead>
            <TableHead>{t("student")}</TableHead>
            <TableHead className="text-right">{t("level")}</TableHead>
            <TableHead className="text-right">{t("xp")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const isMe = entry.userId === currentUserId;
            const initials = entry.displayName
              .split(" ")
              .slice(0, 2)
              .map((s) => s[0])
              .join("")
              .toUpperCase();
            return (
              <TableRow
                key={entry.userId}
                className={isMe ? "bg-primary-500/5" : undefined}
              >
                <TableCell className="text-center">
                  <span
                    className={
                      entry.rank <= 3
                        ? `inline-flex size-8 items-center justify-center rounded-full text-sm font-bold ${RANK_STYLES[entry.rank - 1]}`
                        : "text-sm font-medium text-muted-foreground"
                    }
                  >
                    {entry.rank}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-7">
                      {entry.avatarUrl ? (
                        <AvatarImage
                          src={entry.avatarUrl}
                          alt={entry.displayName}
                        />
                      ) : null}
                      <AvatarFallback className="text-[10px]">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="line-clamp-1 text-sm font-medium text-foreground">
                      {entry.displayName}
                    </span>
                    {entry.isHidden ? (
                      <UIBadge variant="outline" size="sm">
                        <EyeOff className="size-3" />
                        {t("anonymous")}
                      </UIBadge>
                    ) : null}
                    {isMe ? (
                      <UIBadge variant="brand" size="sm">
                        {t("you")}
                      </UIBadge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm font-medium">
                  {entry.level}
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">
                  {entry.totalXp.toLocaleString()}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
