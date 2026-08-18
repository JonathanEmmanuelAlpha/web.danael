"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Image as ImageIcon,
  ExternalLink,
  Send,
  Loader2,
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createShowcaseItemAction } from "@/server/actions/talent";

export function ShowcaseEditor() {
  const t = useTranslations("Talent");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) {
      toast.error(t("titleRequired"));
      return;
    }
    setSaving(true);
    const res = await createShowcaseItemAction({
      title: title.trim(),
      description: description.trim() || undefined,
      type: "project",
      fileIds: [],
      externalUrl: externalUrl.trim() || undefined,
      isPublished,
    });
    setSaving(false);
    if (res.success) {
      toast.success(t("showcaseItemCreated"));
      setTitle("");
      setDescription("");
      setExternalUrl("");
      setIsPublished(false);
      router.refresh();
    } else {
      toast.error(res.error?.message ?? t("showcaseCreateFailed"));
    }
  }

  return (
    <Card className="overflow-hidden border-0 bg-gradient-to-br from-pink-500/10 via-rose-500/5 to-transparent p-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 text-white">
          <Sparkles className="size-5" />
        </div>
        <div>
          <h3 className="font-display text-base font-semibold">
            {t("addToShowcase")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("addToShowcaseDesc")}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">{t("title")}</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("titlePlaceholder")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">{t("description")}</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("descriptionPlaceholder")}
            rows={3}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="url">{t("externalUrl")}</Label>
          <div className="relative">
            <ExternalLink className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 p-3">
          <div className="flex items-center gap-2">
            {isPublished ? (
              <Eye className="size-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <EyeOff className="size-4 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm font-medium">
                {t("publishShowcase")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("publishShowcaseDesc")}
              </p>
            </div>
          </div>
          <Switch checked={isPublished} onCheckedChange={setIsPublished} />
        </div>

        <Button
          variant="brand"
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="w-full"
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {t("saveShowcase")}
        </Button>
      </div>
    </Card>
  );
}
