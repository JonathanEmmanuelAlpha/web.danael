"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Send, Archive } from "lucide-react";
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
import { publishAssignmentAction, deleteAssignmentAction } from "@/server/actions/assignments";

interface PublishAssignmentButtonProps {
  assignmentId: string;
  className?: string;
}

/**
 * §5.5 — "Publish" button that flips an assignment's status from draft to
 * published. Shows a confirmation dialog.
 */
export function PublishAssignmentButton({
  assignmentId,
  className,
}: PublishAssignmentButtonProps) {
  const t = useTranslations("Assignments");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

  async function handlePublish() {
    setPending(true);
    const res = await publishAssignmentAction(assignmentId);
    setPending(false);
    if (!res.success) {
      toast.error(res.error?.message ?? t("publish"));
      return;
    }
    toast.success(t("assignmentPublished"));
    setOpen(false);
    router.refresh();
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="brand" size="sm" className={className}>
          <Send className="size-4" />
          {t("publish")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("publish")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("noAssignmentsHint")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t("noAssignments")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handlePublish}
            disabled={pending}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("publish")}
              </>
            ) : (
              t("publish")
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface ArchiveAssignmentButtonProps {
  assignmentId: string;
  className?: string;
}

/**
 * §5.5 — "Archive" button that soft-deletes an assignment (status=archived).
 */
export function ArchiveAssignmentButton({
  assignmentId,
  className,
}: ArchiveAssignmentButtonProps) {
  const t = useTranslations("Assignments");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleArchive() {
    setPending(true);
    const res = await deleteAssignmentAction(assignmentId);
    setPending(false);
    if (!res.success) {
      toast.error(res.error?.message ?? t("archive"));
      return;
    }
    toast.success(t("assignmentArchived"));
    setOpen(false);
    router.push("/teacher-assignments");
    router.refresh();
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Archive className="size-4" />
          {t("archive")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("archive")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("noAssignmentsHint")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t("noAssignments")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleArchive}
            disabled={pending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("archive")}
              </>
            ) : (
              t("archive")
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
