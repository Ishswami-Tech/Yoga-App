"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";

export const DEFAULT_PLAN_PAISE = 150000;

type PlanResp = {
  amountPaise: number;
  currency?: string;
  name?: string;
  display?: string;
};

/** Whole-rupee string with en-IN grouping: 150000 -> "1,500" */
function rupeesOf(paise: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(
    paise / 100
  );
}

/** Current membership price (public). Falls back to the default while loading. */
export function usePlan() {
  const q = useQuery<PlanResp>({
    queryKey: ["plan"],
    queryFn: () => apiGet<PlanResp>("/api/plan"),
    staleTime: 60_000,
  });
  const amountPaise =
    q.data && Number.isFinite(q.data.amountPaise) && q.data.amountPaise > 0
      ? q.data.amountPaise
      : DEFAULT_PLAN_PAISE;
  const rupees = rupeesOf(amountPaise);
  const fixed = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountPaise / 100);
  return {
    amountPaise,
    rupees,
    /** "1,500.00" (no symbol) */
    fixed,
    display: q.data?.display ?? `₹${rupees}`,
    isLoading: q.isLoading,
  };
}
