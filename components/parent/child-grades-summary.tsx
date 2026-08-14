"use client";

import { useTranslations } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { BarChart3 } from "lucide-react";
import type { ChildGradesSummary } from "@/server/services/parent";

interface ChildGradesSummaryProps {
  data: ChildGradesSummary;
}

/**
 * §5.14 — Grades by subject + recent grades table.
 */
export function ChildGradesSummary({ data }: ChildGradesSummaryProps) {
  const t = useTranslations("Parent");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("averageGrade")}
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">
            {data.averageScore.toFixed(2)}
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              / {data.averageMax.toFixed(2)}
            </span>
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("averagePercent")}
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">
            {data.averagePercent.toFixed(1)} %
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("subjectCount")}
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">
            {data.subjectAverages.length}
          </p>
        </div>
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          <BarChart3 className="size-4 text-primary-600" />
          {t("gradesBySubject")}
        </h3>
        {data.subjectAverages.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title={t("noGrades")}
            description={t("noGradesHint")}
            className="py-6"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("subject")}</TableHead>
                <TableHead className="text-right">{t("average")}</TableHead>
                <TableHead className="text-right">{t("count")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.subjectAverages.map((s) => (
                <TableRow key={s.subjectId}>
                  <TableCell className="font-medium">{s.subjectName}</TableCell>
                  <TableCell className="text-right">
                    <span className="font-semibold">
                      {s.averageScore.toFixed(2)}
                    </span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      / {s.averageMax.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary" size="sm">
                      {s.count}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {data.recent.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            {t("recentGrades")}
          </h3>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>{t("subject")}</TableHead>
                  <TableHead className="text-right">{t("score")}</TableHead>
                  <TableHead className="text-right">{t("period")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">
                      {g.subjectName ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold">
                        {g.score.toFixed(2)}
                      </span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        / {g.maxScore.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" size="sm">
                        {g.period}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
