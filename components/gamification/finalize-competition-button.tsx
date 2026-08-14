"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Trophy } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { finalizeCompetitionAction } from "@/server/actions/competitions";

export interface FinalizeCompetitionButtonProps {
  competitionId: string;
  /** Pass true if the competition has already ended (renders nothing). */
  ended?: boolean;
}

export function FinalizeCompetitionButton({
  competitionId,
  ended = false,
}: FinalizeCompetitionButtonProps) {
  const t = useTranslations("Competitions");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (ended) {
    return null;
  }

  async function handleFinalize() {
    setPending(true);
    const res = await finalizeCompetitionAction(competitionId);
    setPending(false);
    if (res.success) {
      toast.success(t("finalized"));
      router.refresh();
    } else {
      toast.error(res.error.message ?? t("finalizeFailed"));
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="brand" size="sm">
          <Trophy className="size-4" />
          {t("finalize")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("finalizeConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("finalizeConfirmDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleFinalize();
            }}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trophy className="size-4" />
            )}
            {t("finalize")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
