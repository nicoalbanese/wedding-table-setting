import { App, type InitialPlanLoad } from "@/App";
import { getPlan, isPlanStoreConfigError, toPublicPlan } from "@/server/plan-store";

export const dynamic = "force-dynamic";

export default async function PlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const initialPlanLoad = await loadInitialPlan(planId);
  return <App initialPlanLoad={initialPlanLoad} planId={planId} />;
}

async function loadInitialPlan(planId: string): Promise<InitialPlanLoad> {
  try {
    const record = await getPlan(planId);
    if (!record) return { status: "not-found" };
    if (record.password) return { status: "password-required" };
    return { status: "available", plan: toPublicPlan(record) };
  } catch (error) {
    if (isPlanStoreConfigError(error)) return { status: "store-not-configured" };
    throw error;
  }
}
