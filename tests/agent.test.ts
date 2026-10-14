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
