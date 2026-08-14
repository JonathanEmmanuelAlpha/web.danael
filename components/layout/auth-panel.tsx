import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/**
 * Left-side form panel for auth pages: dot-grid + halos + logo.
 * Extracted from original auth-panel.tsx (DRY) — used by sign-in, sign-up,
 * verify-account, forgot-password, reset-password, onboarding/*.
 */
export function AuthPanel({
  children,
  className,
  showLogo = true,
  wrapperSize = "small",
}: {
  children: React.ReactNode;
  className?: string;
  showLogo?: boolean;
  wrapperSize?: "small" | "medium" | "full";
}) {
  return (
    <div
      className={cn(
        "relative flex w-full flex-col items-center justify-center overflow-hidden px-8 py-6 sm:px-12 lg:w-1/2 xl:px-14",
        className,
      )}
    >
      {/* Dot grid background */}
      <div className="auth-dot-grid absolute inset-0" />

      {/* Top radial halo */}
      <div className="halo-lime -top-32 left-1/2 h-87.5 w-125 -translate-x-1/2" />
      {/* Bottom halo */}
      <div className="halo-lime -bottom-24 left-0 h-72 w-72" />

      {/* Logo (top-left absolute) */}
      {showLogo && (
        <div className="absolute left-4 top-4 z-10">
          <Logo variant="light" />
        </div>
      )}

      <div
        className={cn(
          "z-100 w-full py-8",
          wrapperSize === "full"
            ? "max-w-full"
            : wrapperSize === "medium"
              ? "max-w-xl"
              : "max-w-md",
        )}
      >
        {children}
      </div>
    </div>
  );
}
