"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, LogIn, CheckCircle2, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { joinCompetitionAction } from "@/server/actions/competitions";

export interface JoinCompetitionButtonProps {
  competitionId: string;
  /** Pass true if the user already joined (renders a disabled "joined" state). */
  hasJoined?: boolean;
  /** Pass true if the competition is no longer joinable (e.g. ended). */
  disabled?: boolean;
}

export function JoinCompetitionButton({
  competitionId,
  hasJoined = false,
  disabled = false,
}: JoinCompetitionButtonProps) {
  const t = useTranslations("Competitions");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [joined, setJoined] = useState(hasJoined);

  useEffect(() => {
    setJoined(hasJoined);
  }, [hasJoined]);

  async function handleJoin() {
    setPending(true);
    const res = await joinCompetitionAction({ competitionId, isAnonymous });
    setPending(false);
    if (res.success) {
      toast.success(t("joined"));
      setJoined(true);
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error.message ?? t("joinFailed"));
    }
  }

  if (joined) {
    return (
      <Button variant="brand-outline" size="sm" disabled className="gap-2">
        <CheckCircle2 className="size-4" />
        {t("joined")}
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="brand"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <LogIn className="size-4" />
        {t("join")}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("joinConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("joinConfirmDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <Checkbox
              id="anonymous"
              checked={isAnonymous}
              onCheckedChange={(v) => setIsAnonymous(v === true)}
            />
            <Label htmlFor="anonymous" className="flex items-center gap-1.5 text-sm font-normal">
              <EyeOff className="size-3.5" />
              {t("participateAnonymously")}
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleJoin();
              }}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogIn className="size-4" />
              )}
              {t("confirmJoin")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
