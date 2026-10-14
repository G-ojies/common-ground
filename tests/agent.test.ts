import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTools, hasLlm, runPlan, SYSTEM_PROMPT } from "../src/lib/agent";
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
  const fav = tools.resolve_favourites.parameters.safeParse({ person: "Ada", items: [{ name: "X", kind: null }] });
  assert.equal(fav.success, true);
  const bad = tools.find_group_picks.parameters.safeParse({ type: "spaceship" });
  assert.equal(bad.success, false);
});

test("tools report errors instead of throwing", async () => {
  const tools = buildTools(new PlanSession(group()));
  const out = await tools.resolve_favourites.execute!(
    { person: "Mallory", items: [{ name: "x" }] },
    { toolCallId: "t1", messages: [] },
  );
  assert.deepEqual(out, { error: '"Mallory" is not in this group.' });
});

test("system prompt guards against injected instructions and invented data", () => {
  assert.match(SYSTEM_PROMPT, /untrusted user input/);
  assert.match(SYSTEM_PROMPT, /Never invent/);
  assert.match(SYSTEM_PROMPT, /no markdown tables/);
});

test("agent loop: model calls the tools, then its text becomes the plan", async () => {
  const { MockLanguageModelV1 } = await import("ai/test");
  const g = group();
  const calls: Array<{ toolName: string; args: unknown }> = [
    ...g.people.map((p) => ({ toolName: "resolve_favourites", args: { person: p.name, items: p.favourites } })),
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
