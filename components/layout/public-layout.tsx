import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { PublicHeader } from "@/components/public/header";
import { Footer } from "@/components/public/footer";

export interface PublicLayoutProps {
  children: ReactNode;
  className?: string;
}

/**
 * Layout for public pages (landing, pricing, testimonials…).
 * Sticky header + content + sticky footer (mt-auto).
 *
 * Footer is sticky to bottom: root is `min-h-screen flex flex-col`,
 * footer has `mt-auto` (defined in the Footer component).
 */
export function PublicLayout({ children, className }: PublicLayoutProps) {
  return (
    <div className={cn("flex min-h-screen flex-col bg-background", className)}>
      <PublicHeader variant="light" />
      <main className="flex-1">{children}</main>
      <Footer variant="default" />
    </div>
  );
}
