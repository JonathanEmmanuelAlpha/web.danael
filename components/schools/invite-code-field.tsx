"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InviteCodeFieldProps {
  code: string;
  className?: string;
}

/**
 * §5.3 — Read-only invite code field with a copy-to-clipboard button.
 *
 * Used on the class detail page so teachers can share the code with students.
 */
export function InviteCodeField({ code, className }: InviteCodeFieldProps) {
  const t = useTranslations("Classes");
  const [copied, setCopied] = useState(false);
  const [pending] = useState(false);

  async function handleCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(t("inviteCodeCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Older browsers / insecure contexts.
      toast.error(t("copyCode"));
    }
  }

  return (
    <div className={className}>
      <p className="mb-3 text-base text-muted-foreground">
        {t("inviteCodeHint")}
      </p>
      <div className="flex gap-2">
        <Input
          id="invite-code-input"
          readOnly
          value={code}
          className="h-11 flex-1 font-mono text-base uppercase tracking-widest"
          aria-label={t("inviteCode")}
        />
        <Button
          type="button"
          variant={copied ? "brand" : "outline"}
          onClick={handleCopy}
          disabled={pending}
          className="h-11"
        >
          {copied ? (
            <>
              <Check className="size-4" />
              {t("copyCode")}
            </>
          ) : (
            <>
              <Copy className="size-4" />
              {pending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                t("copyCode")
              )}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
