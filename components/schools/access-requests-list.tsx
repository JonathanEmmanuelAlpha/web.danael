"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, X, Loader2, Mail, Calendar, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GlassCard } from "@/components/shared/glass-card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  approveAccessRequestAction,
  rejectAccessRequestAction,
} from "@/server/actions/school-access";

interface AccessRequestItem {
  id: string;
  schoolId: string;
  schoolAdminId: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  adminName: string;
  adminEmail: string;
  adminAvatarUrl: string | null;
  adminNote: string | null;
  createdAt: Date;
  decidedAt: Date | null;
}

interface AccessRequestsListProps {
  requests: AccessRequestItem[];
}

type StatusFilter = "pending" | "approved" | "rejected" | "all";

/**
 * List of access requests for a school (school admin view).
 *
 * Renders a filter tab (pending / approved / rejected / all) and a list
 * of glass cards. Each card shows the requesting admin's avatar, name,
 * email, request date, status badge, and approve/reject buttons (only
 * for pending requests).
 */
export function AccessRequestsList({ requests }: AccessRequestsListProps) {
  const t = useTranslations("Schools");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  async function handleApprove(req: AccessRequestItem) {
    setPendingIds((s) => new Set(s).add(req.id));
    const result = await approveAccessRequestAction({ requestId: req.id });
    setPendingIds((s) => {
      const next = new Set(s);
      next.delete(req.id);
      return next;
    });
    if (!result.success) {
      toast.error(result.error?.message ?? "Impossible d'approuver");
      return;
    }
    toast.success(t("accessRequestApproved"));
    router.refresh();
  }

  async function handleReject(req: AccessRequestItem) {
    setPendingIds((s) => new Set(s).add(req.id));
    const result = await rejectAccessRequestAction({ requestId: req.id });
    setPendingIds((s) => {
      const next = new Set(s);
      next.delete(req.id);
      return next;
    });
    if (!result.success) {
      toast.error(result.error?.message ?? "Impossible de rejeter");
      return;
    }
    toast.success(t("accessRequestRejected"));
    router.refresh();
  }

  const counts = {
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
    all: requests.length,
  };

  function statusBadge(status: AccessRequestItem["status"]) {
    switch (status) {
      case "pending":
        return (
          <Badge variant="warning">
            {t("pending")}
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="success">
            {t("approved")}
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            {t("rejected")}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }

  function formatDate(d: Date | null | string): string {
    if (!d) return "—";
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function renderRequest(req: AccessRequestItem) {
    const isPending = req.status === "pending";
    const isProcessing = pendingIds.has(req.id);
    const initials = req.adminName.slice(0, 2).toUpperCase();

    return (
      <GlassCard
        key={req.id}
        glow={isPending ? "amber" : false}
        hover
        className="flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between"
      >
        {/* Left: avatar + identity */}
        <div className="flex items-start gap-3">
          <Avatar className="size-10 border border-border">
            {req.adminAvatarUrl ? (
              <AvatarImage
                src={req.adminAvatarUrl}
                alt={req.adminName}
              />
            ) : null}
            <AvatarFallback className="bg-primary-500/15 text-xs font-semibold text-primary-300">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">
                {req.adminName}
              </p>
              {statusBadge(req.status)}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="size-3" />
              {req.adminEmail}
            </p>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Calendar className="size-3" />
              {formatDate(req.createdAt)}
            </p>

            {/* Admin note (visible only when rejected with a note) */}
            {req.status === "rejected" && req.adminNote && (
              <p className="mt-2 flex items-start gap-1.5 rounded-md border border-accent-coral-500/20 bg-accent-coral-500/5 px-2 py-1.5 text-xs italic text-muted-foreground">
                <MessageSquare className="mt-0.5 size-3 shrink-0" />
                « {req.adminNote} »
              </p>
            )}

            {req.decidedAt && (
              <p className="text-[11px] text-muted-foreground">
                {formatDate(req.decidedAt)}
              </p>
            )}
          </div>
        </div>

        {/* Right: actions */}
        {isPending && (
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
            <Button
              size="sm"
              variant="brand"
              onClick={() => handleApprove(req)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {t("approve")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleReject(req)}
              disabled={isProcessing}
              className="border-accent-coral-500/40 text-accent-coral-300 hover:bg-accent-coral-500/10 hover:border-accent-coral-500/60"
            >
              <X className="size-4" />
              {t("reject")}
            </Button>
          </div>
        )}
      </GlassCard>
    );
  }

  function renderEmpty(filter: StatusFilter) {
    return (
      <div className="glass-card flex flex-col items-center gap-2 rounded-2xl px-6 py-14 text-center">
        <div className="glass flex size-12 items-center justify-center rounded-2xl text-muted-foreground">
          <Mail className="size-6" />
        </div>
        <p className="text-sm font-medium text-foreground">
          {t("noAccessRequests")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("noAccessRequestsHint")}
        </p>
        {filter !== "pending" && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {tCommon("noResults")}
          </p>
        )}
      </div>
    );
  }

  return (
    <Tabs defaultValue="pending" className="w-full">
      <TabsList className="grid w-full grid-cols-4 sm:w-auto sm:grid-cols-4">
        <TabsTrigger value="pending" className="gap-1.5">
          {t("pending")}
          <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
            {counts.pending}
          </span>
        </TabsTrigger>
        <TabsTrigger value="approved" className="gap-1.5">
          {t("approved")}
          <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
            {counts.approved}
          </span>
        </TabsTrigger>
        <TabsTrigger value="rejected" className="gap-1.5">
          {t("rejected")}
          <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
            {counts.rejected}
          </span>
        </TabsTrigger>
        <TabsTrigger value="all" className="gap-1.5">
          {t("all")}
          <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
            {counts.all}
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="pending" className="mt-4 space-y-3">
        {counts.pending === 0
          ? renderEmpty("pending")
          : requests
              .filter((r) => r.status === "pending")
              .map(renderRequest)}
      </TabsContent>

      <TabsContent value="approved" className="mt-4 space-y-3">
        {counts.approved === 0
          ? renderEmpty("approved")
          : requests
              .filter((r) => r.status === "approved")
              .map(renderRequest)}
      </TabsContent>

      <TabsContent value="rejected" className="mt-4 space-y-3">
        {counts.rejected === 0
          ? renderEmpty("rejected")
          : requests
              .filter((r) => r.status === "rejected")
              .map(renderRequest)}
      </TabsContent>

      <TabsContent value="all" className="mt-4 space-y-3">
        {counts.all === 0
          ? renderEmpty("all")
          : requests.map(renderRequest)}
      </TabsContent>
    </Tabs>
  );
}
