"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CreditCard, Receipt, Sparkles, BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SubscriptionCard } from "./subscription-card";
import { PaymentHistory } from "./payment-history";
import { InvoiceList } from "./invoice-list";
import { PricingCards } from "./pricing-cards";
import { InitiatePaymentDialog } from "./initiate-payment-dialog";
import {
  cancelSubscriptionAction,
  getMySubscriptionAction,
  listMyPaymentsAction,
  listInvoicesAction,
  getPlanFeaturesAction,
  createSubscriptionAction,
} from "@/server/actions/payments";
import type { PlanDefinition, PlanType } from "@/server/providers/payments/types";
import type { Subscription } from "@/server/db/schema/payments";
import type { PaymentWithSubscription } from "@/server/services/payments";
import type { Invoice } from "@/server/db/schema/payments";

interface BillingViewProps {
  /** Owner id used for invoice queries (school admin → schoolId; otherwise user-scoped). */
  schoolId?: string;
  /** When true, the view is in "school" mode (invoices enabled, institution plan shown). */
  schoolMode?: boolean;
}

/**
 * §5.13 — Unified billing view used by /billing (school_admin, parent, student).
 * Adapts to the role via `schoolMode`.
 */
export function BillingView({ schoolId, schoolMode }: BillingViewProps) {
  const t = useTranslations("Billing");
  const tPayments = useTranslations("Payments");

  const [subscription, setSubscription] = React.useState<Subscription | null>(null);
  const [payments, setPayments] = React.useState<PaymentWithSubscription[]>([]);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [plans, setPlans] = React.useState<PlanDefinition[]>([]);
  const [fetchStarted, setFetchStarted] = React.useState(false);
  const [tab, setTab] = React.useState<"subscription" | "payments" | "invoices">("subscription");

  // Fetch initial data on mount. We follow the pattern from SchoolDashboard
  // (avoid setState synchronously in the effect body) by using a `fetchStarted`
  // flag and deriving `loading` from it.
  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      schoolMode && schoolId
        ? getMySubscriptionAction().then((r) => (r.success ? r.data : null))
        : getMySubscriptionAction().then((r) => (r.success ? r.data : null)),
      listMyPaymentsAction(1, 20).then((r) => (r.success ? r.data.items : [])),
      schoolMode && schoolId
        ? listInvoicesAction({ schoolId, page: 1, pageSize: 20 }).then((r) =>
            r.success ? r.data.items : [],
          )
        : Promise.resolve([] as Invoice[]),
      getPlanFeaturesAction().then((r) =>
        r.success ? (Array.isArray(r.data) ? r.data : [r.data]) : [],
      ),
    ])
      .then(([sub, pays, invs, planList]) => {
        if (cancelled) return;
        setSubscription(sub ?? null);
        setPayments(pays);
        setInvoices(invs);
        setPlans(planList);
      })
      .finally(() => {
        if (!cancelled) setFetchStarted(true);
      });
    return () => {
      cancelled = true;
    };
  }, [schoolId, schoolMode]);

  // Loading state until the first fetch completes.
  const loading = !fetchStarted;

  const currentPlan = (subscription?.planType ?? "free") as PlanType;
  const isFree = !subscription || subscription.status === "free" || subscription.status === "expired";
  const visiblePlans = schoolMode
    ? plans.filter((p) => p.institutional || p.type === "free")
    : plans.filter((p) => !p.institutional);

  const handleSelectPlan = async (planType: PlanType) => {
    const plan = plans.find((p) => p.type === planType);
    if (!plan) return;

    // For free plan, just create the subscription row.
    if (planType === "free") {
      const res = await createSubscriptionAction({
        userId: undefined,
        schoolId: schoolMode ? schoolId : undefined,
        planType,
        amount: plan.price,
        currency: plan.currency,
        autoRenew: false,
      });
      if (res.success) {
        setSubscription(res.data);
      }
      return;
    }

    // For paid plans, create the subscription (if not already created) then
    // open the initiate-payment dialog via the "Subscription" tab.
    if (!subscription || subscription.planType !== planType) {
      const res = await createSubscriptionAction({
        userId: undefined,
        schoolId: schoolMode ? schoolId : undefined,
        planType,
        amount: plan.price,
        currency: plan.currency,
        autoRenew: true,
      });
      if (res.success) {
        setSubscription(res.data);
        setTab("subscription");
      }
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t(schoolMode ? "schoolDescription" : "personalDescription")}
        icon={<CreditCard className="size-6" />}
        actions={
          subscription && !isFree ? (
            <InitiatePaymentDialog
              subscriptionId={subscription.id}
              amount={Number(subscription.amount)}
              currency={subscription.currency}
              planType={currentPlan}
              trigger={
                <Button variant="brand" size="sm">
                  <Sparkles className="size-4" />
                  {tPayments("renew")}
                </Button>
              }
            />
          ) : null
        }
      />

      {/* Top stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label={t("currentPlanLabel")}
          value={t(`plans.${currentPlan}.name` as const)}
          icon={Sparkles}
          hint={subscription?.endsAt ? t("renewalDate") + " : " + new Date(subscription.endsAt).toLocaleDateString("fr-FR") : undefined}
        />
        <StatCard
          label={tPayments("title")}
          value={payments.length}
          icon={CreditCard}
          hint={tPayments("totalPayments")}
        />
        <StatCard
          label={t("invoices")}
          value={invoices.length}
          icon={Receipt}
          hint={schoolMode ? t("invoicesHint") : t("invoicesHintPersonal")}
        />
      </div>

      {/* Tabs: subscription / payments / invoices */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="subscription">{t("tabs.subscription")}</TabsTrigger>
          <TabsTrigger value="payments">{t("tabs.payments")}</TabsTrigger>
          {schoolMode && <TabsTrigger value="invoices">{t("tabs.invoices")}</TabsTrigger>}
        </TabsList>

        <TabsContent value="subscription" className="space-y-6">
          <SubscriptionCard subscription={subscription} freePlan={isFree} />

          <SectionCard
            title={t("availablePlans")}
            description={t(schoolMode ? "availablePlansSchoolHint" : "availablePlansHint")}
            icon={<BarChart3 className="size-4" />}
          >
            {visiblePlans.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title={t("noPlansAvailable")}
                description={t("noPlansAvailableHint")}
              />
            ) : (
              <PricingCards
                plans={visiblePlans}
                currentPlan={currentPlan}
                onSelectPlan={handleSelectPlan}
                contactMode={schoolMode}
              />
            )}
          </SectionCard>

          {!schoolMode && (
            <p className="text-center text-xs text-muted-foreground">
              {t("institutionalPlanHint")}{" "}
              <Link href="/pricing" className="font-medium text-primary-600 hover:underline">
                {t("viewPricing")}
              </Link>
            </p>
          )}
        </TabsContent>

        <TabsContent value="payments">
          <SectionCard
            title={tPayments("title")}
            description={tPayments("historyHint")}
            icon={<CreditCard className="size-4" />}
          >
            <PaymentHistory payments={payments} loading={loading} />
          </SectionCard>
        </TabsContent>

        {schoolMode && (
          <TabsContent value="invoices">
            <SectionCard
              title={t("invoices")}
              description={t("invoicesHint")}
              icon={<Receipt className="size-4" />}
            >
              <InvoiceList invoices={invoices} loading={loading} />
            </SectionCard>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
