"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, X, Loader2, Inbox, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  approveSchoolJoinRequestAction,
  rejectSchoolJoinRequestAction,
  approveClassJoinRequestAction,
  rejectClassJoinRequestAction,
} from "@/server/actions/memberships";
import type { JoinRequestItem } from "@/stores/notifications-store";
import { EmptyState } from "../shared/empty-state";

interface JoinRequestsManagerProps {
  targetType: "school" | "class";
  targetId: string;
  targetName: string;
  initialRequests: JoinRequestItem[];
}

export function JoinRequestsManager({
  targetType,
  targetId,
  targetName,
  initialRequests,
}: JoinRequestsManagerProps) {
  const t = useTranslations("Schools");

  const router = useRouter();

  const [requests, setRequests] = useState(initialRequests);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<
    "pending" | "approved" | "rejected" | "all"
  >("pending");

  async function handleApprove(req: JoinRequestItem) {
    setPendingIds((s) => new Set(s).add(req.id));
    const action =
      req.type === "school"
        ? approveSchoolJoinRequestAction
        : approveClassJoinRequestAction;
    const result = await action({ requestId: req.id });
    setPendingIds((s) => {
      const next = new Set(s);
      next.delete(req.id);
      return next;
    });
    if (!result.success) {
      toast.error(result.error?.message ?? "Impossible d'approuver");
      return;
    }
    toast.success(`Demande de ${req.requestedBy.name} approuvée`);
    setRequests((prev) =>
      prev.map((r) =>
        r.id === req.id
          ? { ...r, status: "approved", decidedAt: new Date().toISOString() }
          : r,
      ),
    );
    router.refresh();
  }

  async function handleReject(req: JoinRequestItem) {
    setPendingIds((s) => new Set(s).add(req.id));
    const action =
      req.type === "school"
        ? rejectSchoolJoinRequestAction
        : rejectClassJoinRequestAction;
    const result = await action({ requestId: req.id });
    setPendingIds((s) => {
      const next = new Set(s);
      next.delete(req.id);
      return next;
    });
    if (!result.success) {
      toast.error(result.error?.message ?? "Impossible de rejeter");
      return;
    }
    toast.success(`Demande de ${req.requestedBy.name} rejetée`);
    setRequests((prev) =>
      prev.map((r) =>
        r.id === req.id
          ? { ...r, status: "rejected", decidedAt: new Date().toISOString() }
          : r,
      ),
    );
    router.refresh();
  }

  const filtered =
    filter === "all" ? requests : requests.filter((r) => r.status === filter);

  const counts = {
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
    all: requests.length,
  };

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f);
            }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
              filter === f
                ? "border-primary-500 bg-primary-500/10 text-primary-700"
                : "border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            {f === "pending" && t("pending")}
            {f === "approved" && t("approved")}
            {f === "rejected" && t("rejected")}
            {f === "all" && t("all")}
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={
            filter === "pending"
              ? "Aucune demande en attente"
              : "Aucune demande dans cette catégorie"
          }
          description={
            "Les demandes d'adhésion envoyées par les utilisateurs apparaîtront ici."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => {
            const isPending = req.status === "pending";
            const isProcessing = pendingIds.has(req.id);
            const initials = req.requestedBy.name.slice(0, 2).toUpperCase();

            return (
              <Card
                key={req.id}
                className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="size-10 border border-border">
                    {req.requestedBy.avatarUrl ? (
                      <AvatarImage
                        src={req.requestedBy.avatarUrl}
                        alt={req.requestedBy.name}
                      />
                    ) : null}
                    <AvatarFallback className="bg-primary-500/15 text-xs font-semibold text-primary-700">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {req.requestedBy.name}
                      </p>
                      <Badge variant="secondary" className="capitalize">
                        {req.role}
                      </Badge>
                      {req.status !== "pending" && (
                        <Badge
                          variant={
                            req.status === "approved"
                              ? "default"
                              : "destructive"
                          }
                        >
                          {req.status === "approved" ? "Approuvée" : "Rejetée"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {req.requestedBy.email}
                    </p>
                    {req.message && (
                      <p className="mt-1 flex items-start gap-1 text-xs italic text-muted-foreground">
                        <MessageSquare className="size-3 mt-0.5 shrink-0" />«{" "}
                        {req.message} »
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Envoyée le{" "}
                      {new Date(req.createdAt).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </div>

                {isPending && (
                  <div className="flex items-center gap-2 self-end sm:self-center">
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
                      Approuver
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(req)}
                      disabled={isProcessing}
                    >
                      <X className="size-4" />
                      Rejeter
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
