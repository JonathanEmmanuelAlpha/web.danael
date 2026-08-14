"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { BookingCard } from "@/components/tutoring/booking-card";
import { EmptyState } from "@/components/shared/empty-state";
import { GridSkeleton } from "@/components/shared/loading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  cancelBookingAction,
  completeBookingAction,
  confirmBookingAction,
  getTutorProfileAction,
  listTutorBookingsAction,
} from "@/server/actions/tutoring";
import type { TutorBooking } from "@/server/services/tutoring";

interface TutorBookingsListProps {
  tutorUserId: string;
}

type BookingRow = Pick<
  TutorBooking,
  "id" | "scheduledAt" | "status" | "price" | "studentId" | "tutorProfileId" | "bookedBy"
>;

/**
 * §5.15 — Tutor bookings list with upcoming / past / cancelled tabs.
 */
export function TutorBookingsList({ tutorUserId }: TutorBookingsListProps) {
  const t = useTranslations("Tutoring");
  const router = useRouter();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [items, setItems] = useState<BookingRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    (async () => {
      const p = await getTutorProfileAction();
      if (!cancelled && p.success && p.data) {
        setProfileId(p.data.id);
        const res = await listTutorBookingsAction({
          tutorProfileId: p.data.id,
          page: 1,
          pageSize: 100,
        });
        if (!cancelled) {
          setItems(res.success ? (res.data.items as BookingRow[]) : []);
        }
      } else if (!cancelled) {
        setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tutorUserId]);

  async function handleConfirm(id: string) {
    const r = await confirmBookingAction(id);
    if (!r.success) {
      toast.error(r.error?.message ?? t("confirmFailed"));
      return;
    }
    toast.success(t("bookingConfirmed"));
    router.refresh();
    setItems((prev) =>
      prev
        ? prev.map((b) => (b.id === id ? { ...b, status: "confirmed" } : b))
        : prev,
    );
  }

  async function handleComplete(id: string) {
    const r = await completeBookingAction(id);
    if (!r.success) {
      toast.error(r.error?.message ?? t("completeFailed"));
      return;
    }
    toast.success(t("bookingCompleted"));
    router.refresh();
    setItems((prev) =>
      prev
        ? prev.map((b) => (b.id === id ? { ...b, status: "completed" } : b))
        : prev,
    );
  }

  async function handleCancel(id: string) {
    const r = await cancelBookingAction({ bookingId: id });
    if (!r.success) {
      toast.error(r.error?.message ?? t("cancelFailed"));
      return;
    }
    toast.success(t("bookingCancelled"));
    router.refresh();
    setItems((prev) =>
      prev
        ? prev.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b))
        : prev,
    );
  }

  if (items === null) {
    return <GridSkeleton count={4} columns={2} />;
  }
  if (!profileId) {
    return (
      <EmptyState
        icon={CalendarClock}
        title={t("noProfile")}
        description={t("noProfileHint")}
      />
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title={t("noBookings")}
        description={t("noBookingsHint")}
      />
    );
  }

  const now = Date.now();
  const upcoming = items.filter(
    (b) =>
      (b.status === "pending" || b.status === "confirmed") &&
      new Date(b.scheduledAt).getTime() >= now,
  );
  const past = items.filter(
    (b) =>
      b.status === "completed" ||
      (b.status !== "cancelled" && new Date(b.scheduledAt).getTime() < now),
  );
  const cancelled = items.filter((b) => b.status === "cancelled");

  return (
    <Tabs defaultValue="upcoming">
      <TabsList>
        <TabsTrigger value="upcoming">
          {t("upcoming")} ({upcoming.length})
        </TabsTrigger>
        <TabsTrigger value="past">
          {t("past")} ({past.length})
        </TabsTrigger>
        <TabsTrigger value="cancelled">
          {t("cancelled")} ({cancelled.length})
        </TabsTrigger>
      </TabsList>
      <TabsContent value="upcoming" className="mt-4">
        {upcoming.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title={t("noUpcomingBookings")}
            description={t("noUpcomingBookingsHint")}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((b) => (
              <li key={b.id}>
                <BookingCard
                  booking={b as TutorBooking}
                  viewerIsTutor
                  viewerIsBooker={false}
                  onConfirm={handleConfirm}
                  onComplete={handleComplete}
                  onCancel={handleCancel}
                />
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
      <TabsContent value="past" className="mt-4">
        {past.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title={t("noPastBookings")}
            description={t("noPastBookingsHint")}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {past.map((b) => (
              <li key={b.id}>
                <BookingCard
                  booking={b as TutorBooking}
                  viewerIsTutor
                  viewerIsBooker={false}
                />
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
      <TabsContent value="cancelled" className="mt-4">
        {cancelled.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title={t("noCancelledBookings")}
            description={t("noCancelledBookingsHint")}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {cancelled.map((b) => (
              <li key={b.id}>
                <BookingCard
                  booking={b as TutorBooking}
                  viewerIsTutor
                  viewerIsBooker={false}
                />
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}
