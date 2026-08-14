import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Inbox } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getMySchoolAction } from "@/server/actions/schools";
import { listAccessRequestsAction } from "@/server/actions/school-access";
import { AccessRequestsList } from "@/components/schools/access-requests-list";
import { EmptyState } from "@/components/shared/empty-state";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * §5.3 — School admin: review access requests.
 *
 * Lists requests from other school_admins who entered an access code and
 * are waiting for the creator to approve / reject their access.
 *
 * Default filter: pending. The client component handles filtering between
 * pending / approved / rejected / all.
 */
export default async function AccessRequestsPage() {
  const t = await getTranslations("Schools");
  const tNav = await getTranslations("Navigation");

  const schoolRes = await getMySchoolAction();
  const school = schoolRes.success ? schoolRes.data : null;

  // No school yet → show empty state with CTA to create one.
  if (!school) {
    return (
      <DashboardShell>
        <PageHeader
          title={tNav("accessRequests")}
          description={t("noSchoolForAccessCodes")}
          icon={<Inbox className="size-6" />}
        />
        <div className="mx-auto max-w-2xl">
          <EmptyState
            icon={Inbox}
            title={t("noSchool")}
            description={t("noSchoolForAccessCodes")}
            action={{
              label: t("createSchool"),
              href: "/onboarding/school",
            }}
          />
        </div>
      </DashboardShell>
    );
  }

  // Fetch all requests (any status) — the client component handles filtering.
  const reqsRes = await listAccessRequestsAction();
  const requests = reqsRes.success ? reqsRes.data : [];

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
          title={tNav("accessRequests")}
          description={t("noAccessRequestsHint")}
          icon={<Inbox className="size-6" />}
        />

        {requests.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={t("noAccessRequests")}
            description={t("noAccessRequestsHint")}
          />
        ) : (
          <AccessRequestsList requests={requests} />
        )}

        {/* Helper link to access codes */}
        <div className="flex justify-end">
          <Button asChild variant="ghost" size="sm">
            <Link href="/access-codes">{t("accessCodes")}</Link>
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}
