"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { unlinkChildAction } from "@/server/actions/parent";

interface UnlinkChildButtonProps {
  studentId: string;
  childName: string;
}

/**
 * §5.14 — Confirmation dialog to unlink a child from the parent account.
 */
export function UnlinkChildButton({
  studentId,
  childName,
}: UnlinkChildButtonProps) {
  const t = useTranslations("Parent");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    setPending(true);
    const result = await unlinkChildAction({ studentId });
    setPending(false);
    if (!result.success) {
      toast.error(result.error?.message ?? t("unlinkFailed"));
      return;
    }
    toast.success(t("childUnlinked"));
    router.push("/children");
    router.refresh();
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">
          <Trash2 className="size-3.5" />
          {t("unlinkChild")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("unlinkTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("unlinkDescription", { name: childName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t("cancelUnlink")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={pending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            {t("confirmUnlink")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
