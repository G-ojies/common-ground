import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTools, hasLlm, retryAfterSeconds, runPlan, SYSTEM_PROMPT } from "../src/lib/agent";
import { EXAMPLE_GROUP } from "../src/lib/example";
import { parseGroup } from "../src/lib/group-input";
import { PlanSession } from "../src/lib/planner";

process.env.QLOO_MOCK = "1";
delete process.env.QLOO_API_KEY;
delete process.env.GROQ_API_KEY;

function group() {
  const parsed = parseGroup(EXAMPLE_GROUP);
  if (!parsed.ok) throw new Error("bad example");
  return parsed.group;
}

test("without GROQ_API_KEY the plan is deterministic and still complete", async () => {
  assert.equal(hasLlm(), false);
  const a = await runPlan(group());
  const b = await runPlan(group());
  assert.equal(a.llmUsed, false);
  assert.equal(a.plan, b.plan);
  assert.ok(a.session.lastPicks && a.session.lastPicks.picks.length >= 3);
  assert.ok(a.session.steps.length >= 4);
});

test("tool schemas accept null for optional args (Groq sends null)", () => {
  const tools = buildTools(new PlanSession(group()));
  const picks = tools.find_group_picks.parameters.safeParse({ type: "movie", city: null, tags: null, take: null });
  assert.equal(picks.success, true);
  assert.equal("resolve_favourites" in tools, false, "per-person lookups stay out of the model's toolset (token budget)");
  assert.equal(tools.resolve_group.parameters.safeParse({}).success, true);
  const bad = tools.find_group_picks.parameters.safeParse({ type: "spaceship" });
  assert.equal(bad.success, false);
});

test("tools report errors instead of throwing", async () => {
  const tools = buildTools(new PlanSession(group()));
  const out = (await tools.find_group_picks.execute!(
    { type: "place", city: "Nowhere-That-Does-Not-Exist", tags: null, take: null },
    { toolCallId: "t1", messages: [] },
  )) as Record<string, unknown>;
  assert.ok(out && typeof out === "object", "returns a value instead of throwing");
});

test("system prompt guards against injected instructions and invented data", () => {
  assert.match(SYSTEM_PROMPT, /untrusted user input/);
  assert.match(SYSTEM_PROMPT, /Never invent/);
  assert.match(SYSTEM_PROMPT, /no markdown tables/);
  assert.match(SYSTEM_PROMPT, /Copy every name exactly/);
  assert.match(SYSTEM_PROMPT, /Do not guess anyone.s gender/);
});

test("agent loop: model calls the tools, then its text becomes the plan", async () => {
  const { MockLanguageModelV1 } = await import("ai/test");
  const g = group();
  const calls: Array<{ toolName: string; args: unknown }> = [
    { toolName: "find_group_picks", args: { type: "place", city: "Lagos", tags: null, take: null } },
  ];
  let step = 0;
  const usage = { promptTokens: 1, completionTokens: 1 };
  const model = new MockLanguageModelV1({
    doGenerate: async () => {
      const rawCall = { rawCall: { rawPrompt: null, rawSettings: {} } };
      if (step < calls.length) {
        const c = calls[step++];
        return {
          ...rawCall,
          finishReason: "tool-calls",
          usage,
          toolCalls: [{ toolCallType: "function", toolCallId: `c${step}`, toolName: c.toolName, args: JSON.stringify(c.args) }],
        };
      }
      return { ...rawCall, finishReason: "stop", usage, text: "**Dinner** for Ada, Tunde and Zainab: try Mock Amala Corner." };
    },
  });
  const run = await runPlan(g, { model });
  assert.equal(run.llmUsed, true);
  assert.equal(run.plan, "Dinner for Ada, Tunde and Zainab: try Mock Amala Corner.", "bold markdown stripped");
  assert.deepEqual(
    run.session.steps.map((s) => s.tool),
    ["resolve_favourites", "resolve_favourites", "resolve_favourites", "find_group_picks"],
  );
  assert.ok(run.session.lastPicks && run.session.lastPicks.picks.length > 0);
});

test("agent loop: a failing model falls back to the deterministic plan", async () => {
  const { MockLanguageModelV1 } = await import("ai/test");
  const model = new MockLanguageModelV1({
    doGenerate: async () => {
      throw new Error("boom");
    },
  });
  const run = await runPlan(group(), { model });
  assert.equal(run.llmUsed, false);
  assert.match(run.plan, /^Dinner plan for /);
  assert.match(run.notes.join(" "), /language model was unavailable/);
});

test("resolve_group looks up everyone in one call", async () => {
  const s = new PlanSession(group());
  const out = (await buildTools(s).resolve_group.execute!({}, { toolCallId: "g1", messages: [] })) as { people: Array<{ person: string; found: string[]; missing: string[] }> };
  assert.equal(out.people.length, group().people.length);
  assert.ok(out.people.every((p) => p.found.length + p.missing.length > 0));
  assert.equal(s.steps.filter((st) => st.tool === "resolve_favourites").length, group().people.length);
});

test("retryAfterSeconds reads Groq's rate-limit wait and ignores other errors", () => {
  assert.equal(retryAfterSeconds(new Error("Rate limit reached for model ... Please try again in 6.7125s. Need more tokens?")), 6.7125);
  assert.equal(retryAfterSeconds(new Error("Rate limit reached ... try again in 450ms")), 0.45);
  assert.equal(retryAfterSeconds(new Error("Rate limit reached")), 5);
  assert.equal(retryAfterSeconds(new Error("Invalid API key")), null);
});

test("plan text loses markdown emphasis", async () => {
  const { MockLanguageModelV1 } = await import("ai/test");
  let step = 0;
  const model = new MockLanguageModelV1({
    doGenerate: async () => {
      const raw = { rawCall: { rawPrompt: null, rawSettings: {} } };
      const usage = { promptTokens: 1, completionTokens: 1 };
      if (step++ === 0) return { ...raw, finishReason: "tool-calls", usage, toolCalls: [{ toolCallType: "function", toolCallId: "c1", toolName: "find_group_picks", args: JSON.stringify({ type: "place", city: "Lagos" }) }] };
      return { ...raw, finishReason: "stop", usage, text: "Try **Mock Amala Corner**. *Note: Zainab may like it less.* Rating 4*5 stays." };
    },
  });
  const run = await runPlan(group(), { model });
  assert.equal(run.plan, "Try Mock Amala Corner. Note: Zainab may like it less. Rating 4*5 stays.");
});
