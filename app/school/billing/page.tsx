import { redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/clerk";
import { getTranslations } from "next-intl/server";
import { BillingView } from "@/components/billing/billing-view";
import * as schoolsService from "@/server/services/schools";
import type { UserRole } from "@/types";

/**
 * §5.13 — School billing page.
 *
 * For school_admin: shows school subscription + payments + invoices.
 * For other roles authenticated via (school): falls back to the personal
 * billing view (subscription + payments, no invoices tab).
 */
export default async function BillingPage() {
  const user = await getCurrentDbUser();

  if (!user) redirect("/sign-in");

  const role = user.role as UserRole;

  const tNav = await getTranslations("Navigation");
  void tNav;

  // For school admins, resolve their school to enable invoices tab.
  let schoolId: string | undefined;
  if (role === "school_admin") {
    const school = await schoolsService.getSchoolForAdminUser(user.id);
    schoolId = school?.id;
  }

  return (
    <>
      <BillingView
        schoolId={schoolId}
        schoolMode={role === "school_admin" && Boolean(schoolId)}
      />
    </>
  );
}
