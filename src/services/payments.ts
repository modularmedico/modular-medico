import { getFirebaseFunctions } from "../firebase";
import type { PaymentProvider } from "../types";

export interface CheckoutFormResponse {
  /** URL to POST the form fields to (JazzCash Hosted Checkout / Easypaisa Index.jsf). */
  actionUrl: string;
  /** Pre-signed field/value pairs to submit as a standard HTML form POST. */
  fields: Record<string, string>;
}

const PLAN_AMOUNTS_PKR: Record<"monthly" | "yearly", number> = {
  monthly: 499,
  yearly: 3999,
};

/**
 * Asks the Cloud Function to build a signed checkout request, then auto-submits a
 * hidden form to redirect the browser to the gateway's hosted payment page — this is
 * how both JazzCash and Easypaisa expect to receive a transaction (server-signed
 * redirect, not a client-side API call), since the merchant secret can never be
 * exposed to the browser.
 */
export async function startCheckout(provider: PaymentProvider, plan: "monthly" | "yearly", uid: string) {
  const callableName = provider === "jazzcash" ? "createJazzCashCheckout" : "createEasypaisaCheckout";
  const { httpsCallable } = await import("firebase/functions");
  const functions = await getFirebaseFunctions();
  const call = httpsCallable<{ uid: string; plan: string; amount: number }, CheckoutFormResponse>(functions, callableName);
  const result = await call({ uid, plan, amount: PLAN_AMOUNTS_PKR[plan] });
  redirectToGateway(result.data);
}

function redirectToGateway({ actionUrl, fields }: CheckoutFormResponse) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = actionUrl;
  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

export const PLAN_PRICES = PLAN_AMOUNTS_PKR;
