"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FoundationAlert,
  type FloorAlertData,
} from "@/components/talent/foundation-alert";
import { resolveFloorAlertAction } from "@/server/actions/talent";

export interface FoundationAlertBlockProps {
  /** Floor alerts (already mapped to the component-friendly shape). */
  alerts: FloorAlertData[];
  /** Underlying DB row IDs — used to call resolveFloorAlertAction. */
  alertIds: string[];
}

/**
 * Client wrapper around `FoundationAlert` that handles the `onDismiss`
 * flow by calling `resolveFloorAlertAction` (which resolves ALL of the
 * student's active alerts at once).
 */
export function FoundationAlertBlock({
  alerts,
  alertIds,
}: FoundationAlertBlockProps) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);

  async function handleDismiss() {
    if (alertIds.length === 0) return;
    const firstId = alertIds[0]!;
    const res = await resolveFloorAlertAction({ alertId: firstId });
    if (res.success) {
      setHidden(true);
      toast.success("Alertes résolues");
      router.refresh();
    } else {
      toast.error(res.error?.message ?? "Could not resolve alerts");
    }
  }

  if (hidden || alerts.length === 0) return null;

  return <FoundationAlert alerts={alerts} onDismiss={handleDismiss} />;
}
