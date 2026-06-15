import { NextResponse } from "next/server";

import {
  checkPlanPassword,
  getPlan,
  isPlanStoreConfigError,
  parsePlannerState,
  savePlan,
  toPublicPlan,
} from "@/server/plan-store";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ planId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { planId } = await context.params;
    const record = await getPlan(planId);
    if (!record) return NextResponse.json({ error: "PLAN_NOT_FOUND" }, { status: 404 });

    const passwordCheck = await checkPlanPassword(record, request.headers.get("x-plan-password") ?? undefined);
    if (passwordCheck === "required") return NextResponse.json({ error: "PASSWORD_REQUIRED", protected: true }, { status: 401 });
    if (passwordCheck === "invalid") return NextResponse.json({ error: "INVALID_PASSWORD", protected: true }, { status: 403 });

    return NextResponse.json(toPublicPlan(record));
  } catch (error) {
    if (isPlanStoreConfigError(error)) return NextResponse.json({ error: "PLAN_STORE_NOT_CONFIGURED" }, { status: 503 });
    console.error(error);
    return NextResponse.json({ error: "PLAN_LOAD_FAILED" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { planId } = await context.params;
    const body = await readJson(request);
    const state = parsePlannerState(body?.state);
    const name = typeof body?.name === "string" ? body.name : "";
    const nextPassword = typeof body?.nextPassword === "string" ? body.nextPassword.trim() : "";
    const clearPassword = body?.clearPassword === true;
    const baseRev = typeof body?.baseRev === "number" && Number.isInteger(body.baseRev) ? body.baseRev : null;
    if (!state || baseRev === null) return NextResponse.json({ error: "INVALID_SAVE_REQUEST" }, { status: 400 });
    if (nextPassword && clearPassword) return NextResponse.json({ error: "INVALID_PASSWORD_UPDATE" }, { status: 400 });

    const record = await getPlan(planId);
    if (!record) return NextResponse.json({ error: "PLAN_NOT_FOUND" }, { status: 404 });

    const password = typeof body?.password === "string" ? body.password : undefined;
    const passwordCheck = await checkPlanPassword(record, password);
    if (passwordCheck === "required") return NextResponse.json({ error: "PASSWORD_REQUIRED", protected: true }, { status: 401 });
    if (passwordCheck === "invalid") return NextResponse.json({ error: "INVALID_PASSWORD", protected: true }, { status: 403 });

    const passwordPatch = clearPassword ? { action: "clear" as const } : nextPassword ? { action: "set" as const, password: nextPassword } : { action: "keep" as const };
    const result = await savePlan(planId, baseRev, { name, state }, passwordPatch);
    if (result.status === "missing") return NextResponse.json({ error: "PLAN_NOT_FOUND" }, { status: 404 });
    if (result.status === "conflict") {
      return NextResponse.json({ error: "REV_CONFLICT", latest: toPublicPlan(result.record) }, { status: 409 });
    }

    return NextResponse.json(toPublicPlan(result.record));
  } catch (error) {
    if (isPlanStoreConfigError(error)) return NextResponse.json({ error: "PLAN_STORE_NOT_CONFIGURED" }, { status: 503 });
    console.error(error);
    return NextResponse.json({ error: "PLAN_SAVE_FAILED" }, { status: 500 });
  }
}

async function readJson(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
