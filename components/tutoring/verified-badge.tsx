import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface VerifiedBadgeProps {
  verified: boolean;
  className?: string;
}

/**
 * §5.15 — Small badge for verified tutors.
 */
export function VerifiedBadge({ verified, className }: VerifiedBadgeProps) {
  if (!verified) return null;
  return (
    <Badge variant="success" size="sm" className={className}>
      <CheckCircle2 className="size-3" />
      Vérifié
    </Badge>
  );
}
