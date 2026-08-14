"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Check,
  X,
  Clock,
  School,
  Users,
  Mail,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  acceptInvitationAction,
  rejectInvitationAction,
} from "@/server/actions/memberships";
import type { InvitationItem } from "@/stores/notifications-store";

interface InvitationsListProps {
  invitations: InvitationItem[];
}

function statusBadge(status: InvitationItem["status"]) {
  const map: Record<InvitationItem["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "En attente", variant: "default" },
    accepted: { label: "Acceptée", variant: "secondary" },
    rejected: { label: "Refusée", variant: "outline" },
    expired: { label: "Expirée", variant: "destructive" },
    cancelled: { label: "Annulée", variant: "outline" },
  };
  return map[status] ?? { label: status, variant: "outline" };
}

export function InvitationsList({ invitations }: InvitationsListProps) {
  const router = useRouter();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  async function handleAccept(id: string) {
    setPendingIds((s) => new Set(s).add(id));
    const result = await acceptInvitationAction(id);
    setPendingIds((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
    if (!result.success) {
      toast.error(result.error?.message ?? "Impossible d'accepter");
      return;
    }
    toast.success("Invitation acceptée avec succès");
    router.refresh();
  }

  async function handleReject(id: string) {
    setPendingIds((s) => new Set(s).add(id));
    const result = await rejectInvitationAction(id);
    setPendingIds((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
    if (!result.success) {
      toast.error(result.error?.message ?? "Impossible de refuser");
      return;
    }
    toast.success("Invitation refusée");
    router.refresh();
  }

  if (invitations.length === 0) {
    return (
      <Card className="border-dashed p-8 text-center">
        <Mail className="mx-auto size-8 text-muted-foreground" />
        <h3 className="mt-3 text-sm font-medium text-foreground">
          Aucune invitation
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Lorsqu'un administrateur ou un enseignant vous invitera à rejoindre
          une école ou une classe, l'invitation apparaîtra ici.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {invitations.map((inv) => {
        const status = statusBadge(inv.status);
        const isPending = inv.status === "pending";
        const isProcessing = pendingIds.has(inv.id);
        const initials = inv.invitedBy.name.slice(0, 2).toUpperCase();

        return (
          <Card
            key={inv.id}
            className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary-500/10">
                {inv.type === "school" ? (
                  <School className="size-5 text-primary-600" />
                ) : (
                  <Users className="size-5 text-primary-600" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {inv.refName}
                  </p>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Invité en tant que{" "}
                  <span className="font-medium capitalize">{inv.role}</span> par{" "}
                  {inv.invitedBy.name}
                </p>
                {inv.message && (
                  <p className="mt-1 text-xs italic text-muted-foreground">
                    « {inv.message} »
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Reçue le {new Date(inv.createdAt).toLocaleDateString("fr-FR")}
                  {inv.expiresAt && isPending && (
                    <>
                      {" "}
                      · expire le{" "}
                      {new Date(inv.expiresAt).toLocaleDateString("fr-FR")}
                    </>
                  )}
                </p>
              </div>
            </div>

            {isPending && (
              <div className="flex items-center gap-2 self-end sm:self-center">
                <Button
                  size="sm"
                  variant="brand"
                  onClick={() => handleAccept(inv.id)}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Accepter
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReject(inv.id)}
                  disabled={isProcessing}
                >
                  <X className="size-4" />
                  Refuser
                </Button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
