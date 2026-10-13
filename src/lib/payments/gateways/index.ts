import type { FetchLike, Gateway, GatewayEnv, GatewayName } from "../types";
import { createCashfreeGateway } from "./cashfree";
import { createPhonePeGateway } from "./phonepe";
import { createRazorpayGateway } from "./razorpay";

export type ConfiguredGateways = Readonly<Partial<Record<GatewayName, Gateway>>>;

/** Gateways whose credentials are present in the environment. */
export function getGateways(env: GatewayEnv, fetchImpl: FetchLike = fetch): ConfiguredGateways {
  const candidates: Array<Gateway | null> = [
    createRazorpayGateway(env, fetchImpl),
    createCashfreeGateway(env, fetchImpl),
    createPhonePeGateway(env, fetchImpl),
  ];
  const configured: Partial<Record<GatewayName, Gateway>> = {};
  for (const gateway of candidates) {
    if (gateway) {
      configured[gateway.name] = gateway;
    }
  }
  return configured;
}

export function isGatewayName(value: unknown): value is GatewayName {
  return value === "razorpay" || value === "cashfree" || value === "phonepe";
}
