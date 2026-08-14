import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";

interface LegalPageContentProps {
  namespace: "legal" | "privacy" | "cookies";
}

const SECTION_COUNT: Record<LegalPageContentProps["namespace"], number> = {
  legal: 7,
  privacy: 7,
  cookies: 4,
};

/**
 * Shared legal content renderer used inside /legal, /legal/privacy,
 * /legal/cookies. Renders the title block + numbered sections.
 *
 * This is a CONTENT-ONLY component — wrap with <PublicLayout> in the page.
 */
export async function LegalPageContent({ namespace }: LegalPageContentProps) {
  const t = await getTranslations(`Public.${namespace}` as never);
  const sectionCount = SECTION_COUNT[namespace];

  const today = new Date().toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <section className="border-b border-border bg-gradient-to-b from-primary-500/5 to-background px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-medium uppercase tracking-wide text-primary-700 dark:text-primary-400">
            {t("lastUpdated" as never)} · {today}
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {t("title" as never)}
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            {t("intro" as never)}
          </p>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-4xl space-y-6">
          {Array.from({ length: sectionCount }).map((_, i) => {
            const num = i + 1;
            return (
              <Card key={num} className="p-6 sm:p-8">
                <h2 className="font-display text-lg font-bold text-foreground sm:text-xl">
                  {t(`sections.${num}_title` as never)}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-foreground sm:text-base">
                  {t(`sections.${num}_content` as never)}
                </p>
              </Card>
            );
          })}

          <div className="rounded-2xl border border-border bg-muted/30 p-6 text-center sm:p-8">
            <p className="text-sm text-muted-foreground">
              Une question sur ce document ?{" "}
              <a
                href="/contact"
                className="font-medium text-primary-700 underline-offset-2 hover:underline dark:text-primary-400"
              >
                Contactez-nous
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
