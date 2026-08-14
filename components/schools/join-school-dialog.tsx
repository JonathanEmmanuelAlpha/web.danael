"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { KeyRound, Loader2, School, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { joinSchoolByCodeAction } from "@/server/actions/memberships";

interface JoinSchoolDialogProps {
  trigger?: React.ReactNode;
  /** Pré-remplir avec un rôle par défaut selon le contexte (élève/enseignant). */
  defaultRole?: "student" | "teacher" | "parent" | "staff";
}

/**
 * Dialog to join a school by access code.
 *
 * Students, teachers (and parents) can enter the 6-character code shared by
 * the school admin to instantly join the school — no email invitation needed.
 */
export function JoinSchoolDialog({
  trigger,
  defaultRole = "student",
}: JoinSchoolDialogProps) {
  const t = useTranslations("Schools");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 6) {
      toast.error("Le code d'accès doit comporter au moins 6 caractères");
      return;
    }
    setPending(true);
    const result = await joinSchoolByCodeAction({
      code: trimmed,
      roleInSchool: defaultRole,
    });
    setPending(false);
    if (!result.success || !result.data) {
      toast.error(result.error?.message ?? "Code invalide");
      return;
    }
    toast.success(
      `Vous avez rejoint ${result.data.school.name} avec succès`,
    );
    setOpen(false);
    setCode("");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="brand-outline">
            <KeyRound className="size-4" />
            {t("joinSchool")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <School className="size-5 text-primary-600" />
            {t("joinSchool")}
          </DialogTitle>
          <DialogDescription>
            Saisissez le code d'accès fourni par votre établissement pour le
            rejoindre immédiatement.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="school-join-code">Code d'accès</Label>
            <Input
              id="school-join-code"
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              className="h-12 font-mono text-lg uppercase tracking-widest"
              autoFocus
              maxLength={8}
            />
            <p className="text-xs text-muted-foreground">
              Le code est composé de 6 lettres/chiffres majuscules.
            </p>
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
              type="submit"
              variant="brand"
              disabled={pending || code.trim().length < 6}
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Rejoindre...
                </>
              ) : (
                <>
                  Rejoindre
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Inline variant — renders as a full section (used on onboarding page or
 * dashboard when user has no school yet).
 */
export function JoinSchoolInline() {
  const t = useTranslations("Schools");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 6) {
      toast.error("Code invalide");
      return;
    }
    setPending(true);
    const result = await joinSchoolByCodeAction({
      code: trimmed,
      roleInSchool: "student",
    });
    setPending(false);
    if (!result.success || !result.data) {
      toast.error(result.error?.message ?? "Code invalide");
      return;
    }
    toast.success(`Bienvenue à ${result.data.school.name} !`);
    setCode("");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Label htmlFor="inline-school-code">{t("joinSchool")}</Label>
      <div className="flex gap-2">
        <Input
          id="inline-school-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          className="font-mono uppercase tracking-widest"
          maxLength={8}
        />
        <Button type="submit" variant="brand" disabled={pending || !code.trim()}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowLeft className="size-4" />}
          {t("joinSchool")}
        </Button>
      </div>
    </form>
  );
}
