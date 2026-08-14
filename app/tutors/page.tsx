import { getCurrentDbUser } from "@/lib/clerk";
import { getTranslations } from "next-intl/server";
import { GraduationCap } from "lucide-react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PublicLayout } from "@/components/layout/public-layout";
import { PageHeader } from "@/components/shared/page-header";
import { TutorsExplorer } from "@/components/users/tutors-explorer";
import {
  listSubjectsForFilterAction,
  listTutorsAction,
} from "@/server/actions/users";

/**
 * Public tutors listing — accessible to students AND parents (and any
 * authenticated user). When the user is not authenticated (sandbox
 * without mock auth), we still render the listing under the PublicLayout
 * so they can browse; actions like "Contacter" / "Prendre rendez-vous"
 * will then redirect to /sign-in.
 */
export default async function TutorsPage() {
  const tUsers = await getTranslations("Users");
  const user = await getCurrentDbUser();

  // First page of tutors + subject filter options — server-side.
  const [tutorsRes, subjectsRes] = await Promise.all([
    listTutorsAction({ page: 1, pageSize: 12 }),
    listSubjectsForFilterAction(),
  ]);

  const tutors = tutorsRes.success ? tutorsRes.data.items : [];
  const total = tutorsRes.success ? tutorsRes.data.total : 0;
  const subjects = subjectsRes.success ? subjectsRes.data : [];

  // Unauthenticated view — render under the public layout.
  if (!user) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <PageHeader
            title={tUsers("findTutors")}
            description={tUsers("findTutorsSubtitle")}
            icon={<GraduationCap className="size-6" />}
          />
          <div className="mt-8">
            <TutorsExplorer
              initialItems={tutors}
              initialTotal={total}
              subjects={subjects}
            />
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
          title={tUsers("findTutors")}
          description={tUsers("findTutorsSubtitle")}
          icon={<GraduationCap className="size-6" />}
        />
        <TutorsExplorer
          initialItems={tutors}
          initialTotal={total}
          subjects={subjects}
        />
      </div>
    </DashboardShell>
  );
}
