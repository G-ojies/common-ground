import { test } from "node:test";
import assert from "node:assert/strict";

import { PlanSession, findGroupPicks, priceFromVibe, resolveFavourites, runDeterministicPlan, findTagsStep } from "../src/lib/planner";
import { isMockMode } from "../src/lib/qloo";
import { mockInsights, mockSearch } from "../src/lib/qloo-mock";
import { EXAMPLE_GROUP } from "../src/lib/example";
import { parseGroup } from "../src/lib/group-input";

// The client reads these lazily at call time, so setting them here is enough.
process.env.QLOO_MOCK = "1";
delete process.env.QLOO_API_KEY;

function exampleSession() {
  const parsed = parseGroup(EXAMPLE_GROUP);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error("example group is invalid");
  return new PlanSession(parsed.group);
}

test("mock mode is on without a key", () => {
  assert.equal(isMockMode(), true);
});

test("mock search finds mock entities and synthesises the rest", () => {
  const hit = mockSearch(new URLSearchParams({ query: "jollof house", types: "urn:entity:place" }));
  assert.equal(hit.results[0].name, "Mock Jollof House");
  const syn = mockSearch(new URLSearchParams({ query: "Some Afrobeats Singer", types: "urn:entity:artist" }));
  assert.match(String(syn.results[0].entity_id), /^mock-syn-artist-/);
  assert.match(String(syn.results[0].name), /\(mock match\)$/);
});

test("mock insights are deterministic and filter by city", () => {
  const params = new URLSearchParams({
    "filter.type": "urn:entity:place",
    "signal.interests.entities": "mock-place-l1",
    "filter.location.query": "Abuja",
  });
  const a = mockInsights(params);
  const b = mockInsights(params);
  assert.deepEqual(a, b);
  assert.ok(a.results.entities.length > 0);
  for (const e of a.results.entities) assert.match(String(e.properties.address), /Abuja/);
});

test("resolveFavourites rejects people outside the group", async () => {
  const s = exampleSession();
  await assert.rejects(() => resolveFavourites(s, "Stranger", [{ name: "x" }]), /not in this group/);
});

test("findGroupPicks ranks dinner options for the example group", async () => {
  const s = exampleSession();
  const r = await findGroupPicks(s, { kind: "place", city: "Lagos", tags: ["urn:tag:genre:place:restaurant"], take: 5 });
  assert.ok(r.picks.length >= 3);
  assert.equal(r.city, "Lagos");
  for (let i = 1; i < r.picks.length; i++) {
    assert.ok(r.picks[i - 1].groupScore >= r.picks[i].groupScore - 1e-9, "sorted by group fit");
  }
  for (const p of r.picks) {
    assert.equal(p.perPerson.length, s.group.people.length);
    assert.match(p.name, /^Mock /);
    assert.ok(!p.tags.includes("Restaurant"));
  }
  assert.ok(s.steps.some((st) => st.tool === "resolve_favourites"));
  assert.ok(s.steps.some((st) => st.tool === "find_group_picks"));
});

test("runDeterministicPlan writes a plain-text plan with a line per person", async () => {
  const s = exampleSession();
  const { plan, result } = await runDeterministicPlan(s);
  assert.match(plan, /^Dinner plan for /);
  assert.match(plan, /1\. Mock /);
  for (const p of s.group.people) assert.ok(plan.includes(p.name));
  assert.ok(!plan.includes("|"), "no markdown tables");
  assert.ok(result.picks.length > 0);
});

test("findTagsStep returns mock tags", async () => {
  const s = exampleSession();
  const tags = await findTagsStep(s, "spicy");
  assert.deepEqual(tags.map((t) => t.id), ["urn:tag:mock:spicy"]);
});

test("priceFromVibe reads a budget from the vibe in code", () => {
  assert.deepEqual(priceFromVibe("Affordable, somewhere we can talk after exams"), { max: 2 });
  assert.deepEqual(priceFromVibe("cheap eats, we're students"), { max: 2 });
  assert.deepEqual(priceFromVibe("Somewhere upscale for a birthday"), { min: 3 });
  assert.equal(priceFromVibe("Lively, with music"), null);
  assert.equal(priceFromVibe(undefined), null);
});

function movieSession() {
  const parsed = parseGroup({
    outing: "movie",
    people: [
      { name: "Ada", favourites: [{ name: "Mock Movie: Quiet Kitchen", kind: "movie" }] },
      { name: "Tunde", favourites: [{ name: "Mock Movie: Harmattan Haunting", kind: "movie" }] },
    ],
  });
  if (!parsed.ok) throw new Error("movie group is invalid");
  return new PlanSession(parsed.group);
}

test("mock insights score pinned ids even with no taste overlap", () => {
  const r = mockInsights(
    new URLSearchParams({
      "filter.type": "urn:entity:movie",
      "signal.interests.entities": "mock-movie-5",
      "filter.results.entities": "mock-movie-9,mock-movie-1",
    }),
  );
  assert.deepEqual(r.results.entities.map((e) => e.entity_id).sort(), ["mock-movie-1", "mock-movie-9"]);
});

test("findGroupPicks never suggests a favourite back and scores every pick for everyone", async () => {
  const s = movieSession();
  const r = await findGroupPicks(s, { kind: "movie", take: 10 });
  assert.ok(r.picks.length > 0);
  const ids = r.picks.map((p) => p.id);
  assert.ok(!ids.includes("mock-movie-5") && !ids.includes("mock-movie-9"), "favourites are not picks");
  // Tastes barely overlap, yet each pick has a real fit for both people, not a 0 for whoever's list it missed.
  for (const p of r.picks) for (const fit of p.perPerson) assert.ok(fit.score > 0, `${fit.person} scored on ${p.name}`);
});
