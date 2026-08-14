"use client";

import { useEffect } from "react";
//import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

/** Dernière ligne de défense : erreur au niveau du layout racine. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    //Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h2 className="text-xl font-semibold">Une erreur est survenue</h2>
        <p className="text-sm text-muted-foreground">
          Nos équipes ont été notifiées. Vous pouvez réessayer.
        </p>
        <Button onClick={() => reset()}>Réessayer</Button>
      </body>
    </html>
  );
}
