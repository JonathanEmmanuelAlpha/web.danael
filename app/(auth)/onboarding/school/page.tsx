"use client";

import { useTranslations } from "next-intl";
import { School, KeyRound } from "lucide-react";
import AuthLayout from "@/components/layout/auth-layout";
import { AuthPanel } from "@/components/layout/auth-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateSchoolForm } from "@/components/schools/create-school-form";
import { JoinSchoolForm } from "@/components/schools/join-school-form";

/**
 * §5.2 — School onboarding (tabbed: create / join).
 *
 * Two paths:
 *  - "create" → CreateSchoolForm (creates a new school)
 *  - "join"   → JoinSchoolForm (request to co-manage an existing school
 *               via an access code)
 */
export default function SchoolOnboardingPage() {
  const t = useTranslations("Schools");

  return (
    <AuthLayout>
      <AuthPanel wrapperSize="full" className="py-10">
        <div className="animate-fade-up w-full max-w-2xl">
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">
                <School className="size-4" />
                {t("createMySchool")}
              </TabsTrigger>
              <TabsTrigger value="join">
                <KeyRound className="size-4" />
                {t("joinASchool")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="mt-6">
              <CreateSchoolForm />
            </TabsContent>

            <TabsContent value="join" className="mt-6">
              <JoinSchoolForm />
            </TabsContent>
          </Tabs>
        </div>
      </AuthPanel>
    </AuthLayout>
  );
}
