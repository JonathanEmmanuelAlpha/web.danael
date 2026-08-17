import { PageHeader } from "@/components/shared/page-header";
import { KeyRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getMySchoolAction } from "@/server/actions/schools";
import { listMyAccessCodesAction } from "@/server/actions/school-access";
import { AccessCodesList } from "@/components/schools/access-codes-list";
import { GenerateAccessCodeDialog } from "@/components/schools/generate-access-code-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * §5.3 — School admin: manage access codes.
 *
 * Lists all access codes generated for the current school, lets the admin
 * generate new ones, and deactivate existing codes.
 */
export default async function AccessCodesPage() {
  const t = await getTranslations("Schools");
  const tNav = await getTranslations("Navigation");

  const schoolRes = await getMySchoolAction();
  const school = schoolRes.success ? schoolRes.data : null;

  // No school yet → show empty state with CTA to create one.
  if (!school) {
    return (
      <>
        <PageHeader
          title={tNav("accessCodes")}
          description={t("noSchoolForAccessCodes")}
          icon={<KeyRound className="size-6" />}
        />
        <div className="mx-auto max-w-2xl">
          <EmptyState
            icon={KeyRound}
            title={t("noSchool")}
            description={t("noSchoolForAccessCodes")}
            action={{
              label: t("createSchool"),
              href: "/onboarding/school",
            }}
          />
        </div>
      </>
    );
  }

  // Fetch access codes for this school.
  const codesRes = await listMyAccessCodesAction();
  const codes = codesRes.success ? codesRes.data : [];

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title={tNav("accessCodes")}
          description={t("generateAccessCodeDescription")}
          icon={<KeyRound className="size-6" />}
          actions={<GenerateAccessCodeDialog />}
        />

        {codes.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title={t("noAccessCodes")}
            description={t("noAccessCodesHint")}
          />
        ) : (
          <AccessCodesList codes={codes} />
        )}

        {/* Helper link to access requests */}
        <div className="flex justify-end">
          <Button asChild variant="ghost" size="sm">
            <Link href="/access-requests">{t("accessRequests")}</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
