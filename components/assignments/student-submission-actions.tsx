"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUploader, type UploadedFile } from "@/components/forms/file-uploader";
import { FormError } from "@/components/forms/form-field";
import { resubmitAssignmentAction } from "@/server/actions/assignments";

interface StudentSubmissionActionsProps {
  assignmentId: string;
  submissionId: string;
  allowLate: boolean;
  isLate: boolean;
  editLabel?: string;
}

/**
 * §5.5 — Student resubmit dialog (used when a submission has been "returned"
 * by the teacher and the student wants to update it).
 *
 * Mirrors the SubmissionForm component but is wrapped in a Dialog so it can
 * be triggered from a button.
 */
export function StudentSubmissionActions({
  assignmentId,
  submissionId,
  allowLate,
  isLate,
  editLabel,
}: StudentSubmissionActionsProps) {
  const t = useTranslations("Assignments");
  const tCommon = useTranslations("Common");
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [comment, setComment] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const blockedByDeadline = isLate && !allowLate;

  function handleUploaded(file: UploadedFile) {
    if (file.id) {
      const id: string = file.id;
      setFileIds((prev) => [...prev, id]);
    }
  }

  async function handleResubmit() {
    setFormError(null);
    if (blockedByDeadline) {
      setFormError(t("deadlinePassed"));
      return;
    }
    setPending(true);
    const res = await resubmitAssignmentAction({
      submissionId,
      comment: comment.trim() || null,
      fileIds,
    });
    setPending(false);
    if (!res.success) {
      toast.error(res.error?.message ?? t("resubmit"));
      return;
    }
    toast.success(t("submissionUpdated"));
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="brand-outline" size="sm">
          <Pencil className="size-3.5" />
          {editLabel ?? t("resubmit")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("resubmit")}</DialogTitle>
          <DialogDescription>{t("filesHint")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resubmit-comment">{t("comment")}</Label>
            <Textarea
              id="resubmit-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("commentHint")}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("files")}</Label>
            {!blockedByDeadline && (
              <FileUploader
                multiple
                category="submission"
                accept="application/pdf,image/*,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onUploaded={handleUploaded}
                hint={t("filesHint")}
              />
            )}
          </div>

          {formError && <FormError message={formError} />}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            variant="brand"
            onClick={handleResubmit}
            disabled={pending || blockedByDeadline}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("resubmit")}
              </>
            ) : (
              t("resubmit")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
