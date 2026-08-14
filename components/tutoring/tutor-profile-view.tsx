"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Star, GraduationCap, Clock } from "lucide-react";
import { VerifiedBadge } from "./verified-badge";
import { TutorReviewsList } from "./tutor-reviews-list";
import { CreateBookingDialog } from "./create-booking-dialog";
import type { TutorProfilePublic } from "@/server/services/tutoring";

interface TutorProfileViewProps {
  profile: TutorProfilePublic;
  /** If provided, renders the "Book session" button using this student id. */
  bookableStudentId?: string;
}

function initials(first?: string | null, last?: string | null): string {
  const f = (first ?? "").trim().charAt(0).toUpperCase();
  const l = (last ?? "").trim().charAt(0).toUpperCase();
  return `${f}${l}` || "?";
}

function formatHourlyRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${rate.toLocaleString("fr-FR")} FCFA/h`;
}

const DAY_NAMES = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
] as const;

/**
 * §5.15 — Full public tutor profile view (bio, subjects, availability, reviews).
 */
export function TutorProfileView({
  profile,
  bookableStudentId,
}: TutorProfileViewProps) {
  const t = useTranslations("Tutoring");
  const [tab, setTab] = useState("about");

  const name =
    [profile.user.firstName, profile.user.lastName].filter(Boolean).join(" ") ||
    "Tuteur";

  const slotsByDay = new Map<number, Array<{ start: string; end: string }>>();
  for (const a of profile.availabilities) {
    const arr = slotsByDay.get(a.dayOfWeek) ?? [];
    arr.push({ start: a.startTime, end: a.endTime });
    slotsByDay.set(a.dayOfWeek, arr);
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Avatar className="size-20 border-2 border-border">
            {profile.user.avatarUrl ? (
              <AvatarImage src={profile.user.avatarUrl} alt={name} />
            ) : null}
            <AvatarFallback className="bg-primary-500/10 text-primary-700 dark:text-primary-400 font-display text-xl font-bold">
              {initials(profile.user.firstName, profile.user.lastName)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-bold text-foreground sm:text-2xl">
                {name}
              </h1>
              <VerifiedBadge verified={profile.isVerified} />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Star className="size-4 text-amber-500" />
                <span className="font-semibold text-foreground">
                  {profile.ratingAvgNumber.toFixed(1)}
                </span>
                ({profile.ratingCount} avis)
              </span>
              {profile.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-4" />
                  {profile.location}
                </span>
              )}
              {profile.user.level && (
                <span className="inline-flex items-center gap-1">
                  <GraduationCap className="size-4" />
                  {profile.user.level}
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="rounded-lg border border-primary-500/30 bg-primary-500/10 px-3 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-primary-700 dark:text-primary-400">
                  {t("hourlyRate")}
                </p>
                <p className="font-display text-base font-bold text-foreground">
                  {formatHourlyRate(profile.hourlyRate)}
                </p>
              </div>
              {bookableStudentId && (
                <CreateBookingDialog
                  tutorProfileId={profile.id}
                  studentId={bookableStudentId}
                  availabilities={profile.availabilities}
                />
              )}
            </div>
          </div>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="about">{t("about")}</TabsTrigger>
          <TabsTrigger value="availability">{t("availability")}</TabsTrigger>
          <TabsTrigger value="reviews">
            {t("reviews")} ({profile.ratingCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="about" className="mt-3 space-y-4">
          <Card className="p-5">
            <h2 className="font-display text-base font-semibold text-foreground">
              {t("bio")}
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
              {profile.bio ?? t("noBio")}
            </p>
          </Card>
          <Card className="p-5">
            <h2 className="font-display text-base font-semibold text-foreground">
              {t("subjectsTaught")}
            </h2>
            {profile.subjects.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("noSubjects")}
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.subjects.map((s) => (
                  <Badge key={s.id} variant="brand" size="lg">
                    {s.subject.name}
                    {s.level ? ` · ${s.level}` : ""}
                  </Badge>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="availability" className="mt-3">
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="size-4 text-primary-600" />
              <h2 className="font-display text-base font-semibold text-foreground">
                {t("weeklyAvailability")}
              </h2>
            </div>
            {profile.availabilities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("noAvailabilities")}
              </p>
            ) : (
              <ul className="space-y-2">
                {Array.from(slotsByDay.entries())
                  .sort(([a], [b]) => a - b)
                  .map(([day, slots]) => (
                    <li
                      key={day}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2"
                    >
                      <Badge variant="brand" size="sm">
                        {DAY_NAMES[day]}
                      </Badge>
                      <div className="flex flex-wrap gap-1.5">
                        {slots.map((s, i) => (
                          <Badge key={i} variant="secondary" size="sm">
                            {s.start} → {s.end}
                          </Badge>
                        ))}
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="mt-3">
          <Card className="p-5">
            <h2 className="mb-3 font-display text-base font-semibold text-foreground">
              {t("reviews")}
            </h2>
            <TutorReviewsList tutorProfileId={profile.id} />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
