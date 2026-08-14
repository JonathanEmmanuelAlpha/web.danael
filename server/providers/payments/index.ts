/**
 * §17.1 — Payment provider factory.
 *
 * Returns the right provider instance based on a `provider` param.
 * Throws AppError("PROVIDER_ERROR") for unknown providers.
 */

import { AppError } from "@/lib/api-response";
import type { PaymentProviderValue } from "@/server/db/schema/enums";
import { mtnMomoProvider } from "./mtn-momo";
import { orangeMoneyProvider } from "./orange-money";
import { cardProvider } from "./card";
import type { PaymentProvider } from "./types";

export type {
  PaymentProvider,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  PaymentStatusOutput,
  WebhookVerification,
  PlanType,
  PlanFeature,
  PlanDefinition,
} from "./types";
export * from "./types";

const REGISTRY: Record<PaymentProviderValue, PaymentProvider> = {
  mtn_money: mtnMomoProvider,
  orange_money: orangeMoneyProvider,
  stripe: cardProvider,
  // wave / flutterwave — reserved slots, will fall back to "not configured"
  wave: orangeMoneyProvider,
  flutterwave: cardProvider,
};

/**
 * Returns the provider for the given name. Throws on unknown providers.
 */
export function getPaymentProvider(name: PaymentProviderValue): PaymentProvider {
  const provider = REGISTRY[name];
  if (!provider) {
    throw AppError.provider(`Unknown payment provider: ${name}`, { name });
  }
  return provider;
}

/**
 * Lists the providers that are *configurable* in this environment, for display
 * in the UI payment-method selector. We don't expose wave / flutterwave since
 * they share implementations and could mislead the user.
 */
export function listAvailableProviders(): PaymentProvider[] {
  return [mtnMomoProvider, orangeMoneyProvider, cardProvider];
}
