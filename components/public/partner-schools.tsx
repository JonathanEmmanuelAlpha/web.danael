import { useTranslations } from "next-intl";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin } from "lucide-react";

interface PartnerSchool {
  name: string;
  city: string;
  level: "primary" | "secondary" | "university";
}

const SCHOOLS: PartnerSchool[] = [
  { name: "Lycée Général Leclerc", city: "Yaoundé", level: "secondary" },
  { name: "Lycée de Ngoa-Ekellé", city: "Yaoundé", level: "secondary" },
  { name: "Collège Bilingue de Bonaberi", city: "Douala", level: "secondary" },
  { name: "Collège Libermann", city: "Douala", level: "secondary" },
  { name: "Lycée de Bafoussam", city: "Bafoussam", level: "secondary" },
  { name: "Lycée Bilingue de Bamenda", city: "Bamenda", level: "secondary" },
  { name: "École Publique Bastos", city: "Yaoundé", level: "primary" },
  { name: "Lycée Technique de Douala", city: "Douala", level: "secondary" },
  { name: "Lycée de Maroua", city: "Maroua", level: "secondary" },
  { name: "Collège Adventiste de Nkongsamba", city: "Nkongsamba", level: "secondary" },
  { name: "Université de Yaoundé I", city: "Yaoundé", level: "university" },
  { name: "École Internationale de Douala", city: "Douala", level: "secondary" },
];

const LEVEL_COLORS: Record<PartnerSchool["level"], string> = {
  primary: "bg-primary-500/10 text-primary-700 dark:text-primary-400",
  secondary: "bg-secondary-600/10 text-secondary-600 dark:text-secondary-300",
  university: "bg-warning/10 text-warning",
};

const LEVEL_LABELS: Record<PartnerSchool["level"], string> = {
  primary: "Primaire",
  secondary: "Secondaire",
  university: "Université",
};

interface PartnerSchoolsProps {
  /** When true, renders all schools. When false, renders only a few teaser logos. */
  showAll?: boolean;
  className?: string;
}

/**
 * Partner schools list (§5.1 — Établissements partenaires).
 */
export function PartnerSchools({ showAll = false, className }: PartnerSchoolsProps) {
  const t = useTranslations("Landing");

  const schools = showAll ? SCHOOLS : SCHOOLS.slice(0, 6);

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {schools.map((s) => (
        <div
          key={`${s.name}-${s.city}`}
          className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary-500/40 hover:shadow-float"
        >
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-primary-700 dark:text-primary-400"
            aria-hidden
          >
            <Building2 className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold text-foreground">
              {s.name}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" aria-hidden />
                {s.city}
              </span>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 border-transparent text-[10px]",
              LEVEL_COLORS[s.level],
            )}
          >
            {LEVEL_LABELS[s.level]}
          </Badge>
        </div>
      ))}
    </div>
  );
}
