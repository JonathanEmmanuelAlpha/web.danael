"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Copy,
  Check,
  Power,
  Calendar,
  Clock,
  Hash,
  Infinity as InfinityIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/shared/glass-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deactivateAccessCodeAction } from "@/server/actions/school-access";

interface AccessCodeItem {
  id: string;
  accessCode: string;
  usages: number;
  maxUsages: number | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

interface AccessCodesListProps {
  codes: AccessCodeItem[];
}

/**
 * List of access codes (school admin view).
 *
 * Each code is rendered as a glass card with:
 *  - The code (monospace, copyable)
 *  - Usages "x/y" or "x/∞"
 *  - Created at / Expires at dates
 *  - Active/Inactive badge
 *  - Deactivate button (with confirm dialog) — only for active codes
 */
export function AccessCodesList({ codes }: AccessCodesListProps) {
  const t = useTranslations("Schools");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleCopy(code: AccessCodeItem) {
    try {
      await navigator.clipboard.writeText(code.accessCode);
      setCopiedId(code.id);
      toast.success(t("copied"));
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Impossible de copier");
    }
  }

  async function handleDeactivate(codeId: string) {
    setPendingId(codeId);
    const result = await deactivateAccessCodeAction({ codeId });
    setPendingId(null);
    if (!result.success) {
      toast.error(result.error?.message ?? "Impossible de désactiver");
      return;
    }
    toast.success(t("accessCodeDeactivated"));
    router.refresh();
  }

  function formatDate(d: Date | null | string): string {
    if (!d) return t("expiryNever");
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {codes.map((code) => {
        const isCopied = copiedId === code.id;
        const isPending = pendingId === code.id;
        const usagesLabel = code.maxUsages
          ? `${code.usages}/${code.maxUsages}`
          : `${code.usages}/${t("unlimited")}`;

        return (
          <GlassCard
            key={code.id}
            glow={code.isActive ? "primary" : false}
            hover
            className="flex flex-col gap-4 rounded-2xl p-5"
          >
            {/* Code (copyable) */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t("accessCode")}
                </p>
                <p className="mt-1 truncate font-mono text-xl font-bold tracking-[0.15em] text-foreground">
                  {code.accessCode}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => handleCopy(code)}
                aria-label={t("copyCode")}
              >
                {isCopied ? (
                  <Check className="size-4 text-primary-400" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Hash className="size-3.5 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">{t("usages")}</p>
                  <p className="font-medium text-foreground">
                    {usagesLabel}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="size-3.5 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">{t("createdAt")}</p>
                  <p className="font-medium text-foreground">
                    {formatDate(code.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="size-3.5 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">{t("expiresAt")}</p>
                  <p className="flex items-center gap-1 font-medium text-foreground">
                    {code.maxUsages === null && (
                      <InfinityIcon className="size-3 text-primary-400" />
                    )}
                    {formatDate(code.expiresAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-2 shrink-0 self-center rounded-full bg-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">{tCommon("status")}</p>
                  <Badge
                    variant={code.isActive ? "default" : "secondary"}
                    size="sm"
                    className="mt-0.5"
                  >
                    {code.isActive ? t("active") : t("inactive")}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Actions */}
            {code.isActive && (
              <div className="mt-auto flex justify-end pt-1">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      className="border-accent-coral-500/40 text-accent-coral-300 hover:bg-accent-coral-500/10 hover:border-accent-coral-500/60"
                    >
                      <Power className="size-4" />
                      {t("deactivate")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {t("deactivate")}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("deactivateConfirm")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeactivate(code.id)}
                        className="bg-accent-coral-500 text-white hover:bg-accent-coral-600"
                      >
                        {t("deactivate")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </GlassCard>
        );
      })}
    </div>
  );
}
