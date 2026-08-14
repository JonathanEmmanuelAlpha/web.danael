import { getTranslations } from "next-intl/server";
import AuthLayout from "@/components/layout/auth-layout";
import { AuthPanel } from "@/components/layout/auth-panel";
import { AuthHeader } from "@/components/auth/auth-header";
import { ProfileForm } from "@/components/forms/profile-form";
import { getCurrentDbUser } from "@/lib/clerk";

/**
 * §5.2 — Onboarding step 1: role selection.
 */
export default async function ProfilePage() {
  const t = await getTranslations("Onboarding.Profile");
  const dbUser = await getCurrentDbUser();

  return (
    <AuthLayout>
      <AuthPanel wrapperSize="medium">
        <div className="animate-fade-up w-full max-w-2xl">
          <AuthHeader title={t("title")} subtitle={t("subtitle")} />

          <ProfileForm user={dbUser!} />
        </div>
      </AuthPanel>
    </AuthLayout>
  );
}
