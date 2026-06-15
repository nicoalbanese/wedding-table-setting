import { NextResponse } from "next/server";

import {
  createPlan,
  PlanInvalidSlugError,
  PlanSlugUnavailableError,
  isPlanStoreConfigError,
  parsePlannerState,
  toPublicPlan,
} from "@/server/plan-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const state = parsePlannerState(body?.state);
    if (!state) return NextResponse.json({ error: "INVALID_STATE" }, { status: 400 });

    const id = typeof body?.id === "string" ? body.id : undefined;
    const name = typeof body?.name === "string" ? body.name : "";
    const password = typeof body?.password === "string" ? body.password : undefined;
    const record = await createPlan({ id, name, state }, password);
    return NextResponse.json(toPublicPlan(record), { status: 201 });
  } catch (error) {
    if (isPlanStoreConfigError(error)) return NextResponse.json({ error: "PLAN_STORE_NOT_CONFIGURED" }, { status: 503 });
    if (error instanceof PlanInvalidSlugError) return NextResponse.json({ error: "INVALID_PLAN_ID" }, { status: 400 });
    if (error instanceof PlanSlugUnavailableError) return NextResponse.json({ error: "PLAN_ID_TAKEN" }, { status: 409 });
    console.error(error);
    return NextResponse.json({ error: "PLAN_CREATE_FAILED" }, { status: 500 });
  }
}

async function readJson(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
