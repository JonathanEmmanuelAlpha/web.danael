"use client";

/**
 * §5.16 — Generic admin table filter bar (search + select filter).
 */

import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FilterOption {
  value: string;
  label: string;
}

export interface AdminTableFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterOptions?: FilterOption[];
  filterPlaceholder?: string;
  filterAllLabel?: string;
  loading?: boolean;
}

export function AdminTableFilters({
  search,
  onSearchChange,
  searchPlaceholder,
  filterValue,
  onFilterChange,
  filterOptions,
  filterPlaceholder,
  filterAllLabel,
  loading,
}: AdminTableFiltersProps) {
  const t = useTranslations("Admin");
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder ?? t("searchPlaceholder")}
          className="pl-9"
          aria-label={t("search")}
          disabled={loading}
        />
      </div>
      {filterOptions && onFilterChange && (
        <Select
          value={filterValue ?? "all"}
          onValueChange={(v) => onFilterChange(v === "all" ? "" : v)}
          disabled={loading}
        >
          <SelectTrigger className="w-full sm:w-48" aria-label={t("filter")}>
            <SelectValue placeholder={filterPlaceholder ?? t("filter")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{filterAllLabel ?? t("all")}</SelectItem>
            {filterOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
