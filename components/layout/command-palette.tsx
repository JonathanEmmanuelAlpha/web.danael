"use client";

import { useRouter } from "next/navigation";
import { CommandModal } from "@/components/ui/command";
import { getNavForRole } from "./nav-config";
import type { UserRole } from "@/types";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: UserRole;
}

interface CmdItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Global command palette (§6.2). Triggered with ⌘K / Ctrl+K.
 */
export function CommandPalette({ open, onOpenChange, role }: CommandPaletteProps) {
  const router = useRouter();
  const t = useTranslations("Navigation");

  const items = useMemo<CmdItem[]>(() => {
    const sections = getNavForRole(role);
    return sections.flatMap((s) =>
      s.items.map((i) => ({ label: t(i.labelKey), href: i.href, icon: i.icon })),
    );
  }, [role, t]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <CommandModal open={open} onOpenChange={onOpenChange}>
      {items.map((item) => (
        <button
          key={item.href}
          onClick={() => go(item.href)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
        >
          <item.icon className="size-4 text-muted-foreground" />
          <span>{item.label}</span>
        </button>
      ))}
    </CommandModal>
  );
}
