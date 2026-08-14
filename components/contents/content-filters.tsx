"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TextField, SubmitButton } from "@/components/forms/tanstack-fields";
import {
  CONTENT_TYPE_VALUES,
  LEVEL_VALUES,
  SERIES_VALUES,
  DIFFICULTY_VALUES,
} from "@/server/db/schema/enums";
import type { Subject } from "@/server/db/schema/schools";
import type { LevelValue } from "@/server/db/schema/enums";

export interface ContentFiltersProps {
  subjects: Subject[];
  className?: string;
}

const filtersSchema = z.object({
  search: z.string(),
});

type FiltersFormValues = z.infer<typeof filtersSchema>;

/**
 * Search bar + filter dropdowns for the library/catalog page.
 *
 * The component reads the current search params (search, type, level, series,
 * subject, difficulty, sort) and pushes updates to the URL — keeping the
 * page state shareable & SSR-friendly.
 */
export function ContentFilters({ subjects, className }: ContentFiltersProps) {
  const t = useTranslations("Contents");
  const tCommon = useTranslations("Common");
  const tClasses = useTranslations("Classes");
  const router = useRouter();
  const params = useSearchParams();

  const form = useForm({
    defaultValues: {
      search: params.get("search") ?? "",
    } as FiltersFormValues,
    validators: {
      onChange: filtersSchema,
    },
    onSubmit: async ({ value }) => {
      updateParam("search", value.search.trim() || null);
    },
  });

  function updateParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    next.set("page", "1");
    router.push(`?${next.toString()}`, { scroll: false });
  }

  function clearAll() {
    form.setFieldValue("search", "");
    router.push("?", { scroll: false });
  }

  const hasActiveFilter =
    params.get("search") ||
    params.get("type") ||
    params.get("level") ||
    params.get("series") ||
    params.get("subjectId") ||
    params.get("difficulty");

  return (
    <div className={cn("space-y-3", className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="flex gap-2"
      >
        <div className="flex-1">
          <form.Field name="search">
            {(field) => (
              <TextField
                field={field}
                type="search"
                placeholder={t("searchPlaceholder")}
                leading={<Search className="size-4" />}
                inputClassName="h-11"
              />
            )}
          </form.Field>
        </div>
        <SubmitButton variant="brand" size="lg" className="h-11">
          {tCommon("search")}
        </SubmitButton>
        {hasActiveFilter ? (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="h-11"
            onClick={clearAll}
            aria-label={tCommon("cancel")}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </form>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="filter-type" className="text-xs">
            {t("type")}
          </Label>
          <Select
            value={params.get("type") ?? ""}
            onValueChange={(v) => updateParam("type", v || null)}
          >
            <SelectTrigger id="filter-type" className="h-10 w-40">
              <SelectValue placeholder={tCommon("all")} />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_TYPE_VALUES.map((tp) => (
                <SelectItem key={tp} value={tp}>
                  {t(`types.${tp}` as const)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-level" className="text-xs">
            {t("level")}
          </Label>
          <Select
            value={params.get("level") ?? ""}
            onValueChange={(v) => updateParam("level", v || null)}
          >
            <SelectTrigger id="filter-level" className="h-10 w-40">
              <SelectValue placeholder={tCommon("all")} />
            </SelectTrigger>
            <SelectContent>
              {LEVEL_VALUES.map((lv: LevelValue) => (
                <SelectItem key={lv} value={lv}>
                  {tClasses(`levelLabels.${lv}` as const)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-series" className="text-xs">
            {t("series")}
          </Label>
          <Select
            value={params.get("series") ?? ""}
            onValueChange={(v) => updateParam("series", v || null)}
          >
            <SelectTrigger id="filter-series" className="h-10 w-28">
              <SelectValue placeholder={tCommon("all")} />
            </SelectTrigger>
            <SelectContent>
              {SERIES_VALUES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t("seriesLabel", { series: s })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-subject" className="text-xs">
            {t("subject")}
          </Label>
          <Select
            value={params.get("subjectId") ?? ""}
            onValueChange={(v) => updateParam("subjectId", v || null)}
          >
            <SelectTrigger id="filter-subject" className="h-10 w-44">
              <SelectValue placeholder={tCommon("all")} />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-difficulty" className="text-xs">
            {t("difficultyLabel")}
          </Label>
          <Select
            value={params.get("difficulty") ?? ""}
            onValueChange={(v) => updateParam("difficulty", v || null)}
          >
            <SelectTrigger id="filter-difficulty" className="h-10 w-36">
              <SelectValue placeholder={tCommon("all")} />
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTY_VALUES.map((d) => (
                <SelectItem key={d} value={d}>
                  {t(`difficulty.${d}` as const)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-sort" className="text-xs">
            <SlidersHorizontal className="mr-1 inline size-3" />
            {tCommon("sort")}
          </Label>
          <Select
            value={params.get("sort") ?? "recent"}
            onValueChange={(v) => updateParam("sort", v)}
          >
            <SelectTrigger id="filter-sort" className="h-10 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">{t("sortRecent")}</SelectItem>
              <SelectItem value="popular">{t("sortPopular")}</SelectItem>
              <SelectItem value="downloads">{t("sortDownloads")}</SelectItem>
              <SelectItem value="title">{t("sortTitle")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
