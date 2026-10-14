import { NextResponse } from "next/server";
import { hasLlm, runPlan } from "@/lib/agent";
import { parseGroup } from "@/lib/group-input";
import { isMockMode, QlooError } from "@/lib/qloo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BODY_BYTES = 16_000;

export async function GET() {
  return NextResponse.json({ mode: { qloo: isMockMode() ? "mock" : "live", llm: hasLlm() ? "groq" : "none" } });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "That request is too large." }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Send the group as JSON." }, { status: 400 });
  }

  const parsed = parseGroup(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.errors.join(" "), errors: parsed.errors }, { status: 400 });

  try {
    const run = await runPlan(parsed.group);
    const picks = run.session.lastPicks;
    return NextResponse.json({
      plan: run.plan,
      picks: picks?.picks ?? [],
      unscored: picks?.unscored ?? [],
      notes: [...(picks?.notes ?? []), ...run.notes],
      steps: run.session.steps,
      mode: { qloo: isMockMode() ? "mock" : "live", llm: run.llmUsed ? "groq" : "none" },
    });
  } catch (err) {
    const message = err instanceof QlooError ? err.message : "Something went wrong while planning. Please try again.";
    if (!(err instanceof QlooError)) console.error("plan failed", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
