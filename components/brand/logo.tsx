import { cn } from "@/lib/utils";

/**
 * Danaël brand logo.
 * SVG-based (no external asset dependency), two variants:
 *  - "light": green/lime mark for dark backgrounds
 *  - "default": dark mark for light backgrounds
 */
export function Logo({
  className,
  variant = "default",
  showWordmark = true,
}: {
  className?: string;
  variant?: "default" | "light";
  showWordmark?: boolean;
}) {
  const markColor = variant === "light" ? "#93d91a" : "#5e9405";
  const wordColor = variant === "light" ? "#ffffff" : "#0e1a30";

  return (
    <div
      className={cn(
        "relative inline-flex items-center bg-linear-120 from-primary-600/40 from-25% to-transparent px-1 rounded-2xl",
        className,
      )}
    >
      <img
        src={"/images/danael-logo.png"}
        alt="Danael Logo"
        className="w-20 h-auto"
      />
    </div>
  );
}
