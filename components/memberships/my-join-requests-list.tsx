"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Clock, Check, X, School, Users, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  cancelSchoolJoinRequestAction,
  cancelClassJoinRequestAction,
} from "@/server/actions/memberships";
import type { JoinRequestItem } from "@/stores/notifications-store";

interface MyJoinRequestsListProps {
  requests: JoinRequestItem[];
}

function statusBadge(status: JoinRequestItem["status"]) {
  const map: Record<
    JoinRequestItem["status"],
    {
      label: string;
      variant: "default" | "secondary" | "destructive" | "outline";
    }
  > = {
    pending: { label: "En attente", variant: "default" },
    approved: { label: "Approuvée", variant: "secondary" },
    rejected: { label: "Rejetée", variant: "destructive" },
    cancelled: { label: "Annulée", variant: "outline" },
  };
  return map[status] ?? { label: status, variant: "outline" };
}

export function MyJoinRequestsList({ requests }: MyJoinRequestsListProps) {
  const router = useRouter();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  async function handleCancel(req: JoinRequestItem) {
    setPendingIds((s) => new Set(s).add(req.id));
    const action =
      req.type === "school"
        ? cancelSchoolJoinRequestAction
        : cancelClassJoinRequestAction;
    const result = await action(req.id);
    setPendingIds((s) => {
      const next = new Set(s);
      next.delete(req.id);
      return next;
    });
    if (!result.success) {
      toast.error(result.error?.message ?? "Impossible d'annuler");
      return;
    }
    toast.success("Demande annulée");
    router.refresh();
  }

  if (requests.length === 0) {
    return (
      <Card className="border-dashed p-8 text-center">
        <Clock className="mx-auto size-8 text-muted-foreground" />
        <h3 className="mt-3 text-sm font-medium text-foreground">
          Aucune demande envoyée
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Les demandes que vous envoyez pour rejoindre des écoles ou classes
          apparaîtront ici avec leur statut.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => {
        const status = statusBadge(req.status);
        const isPending = req.status === "pending";
        const isProcessing = pendingIds.has(req.id);

        return (
          <Card
            key={req.id}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary-500/10">
                {req.type === "school" ? (
                  <School className="size-5 text-primary-600" />
                ) : (
                  <Users className="size-5 text-primary-600" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {req.refName}
                  </p>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Demande en tant que{" "}
                  <span className="font-medium capitalize">{req.role}</span>
                </p>
                {req.message && (
                  <p className="mt-1 text-xs italic text-muted-foreground">
                    « {req.message} »
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Envoyée le{" "}
                  {new Date(req.createdAt).toLocaleDateString("fr-FR")}
                  {req.decidedAt && (
                    <>
                      {" "}
                      · traitée le{" "}
                      {new Date(req.decidedAt).toLocaleDateString("fr-FR")}
                    </>
                  )}
                </p>
              </div>
            </div>

            {isPending && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCancel(req)}
                disabled={isProcessing}
                className="self-end sm:self-center"
              >
                {isProcessing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Annuler
              </Button>
            )}
          </Card>
        );
      })}
    </div>
  );
}
