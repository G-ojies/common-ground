import { test } from "node:test";
import assert from "node:assert/strict";
import { explain, type ResolvedFavourite } from "../src/lib/explain";
import type { QlooEntity } from "../src/lib/qloo-parse";

// All fixtures are invented for tests; none of this is Qloo data.
const ent = (id: string, tags: Array<[string, string]> = [], seeds?: string[]): QlooEntity => ({
  id,
  name: `Fake ${id}`,
  types: [],
  tags: tags.map(([tid, name]) => ({ id: tid, name })),
  ...(seeds ? { seeds } : {}),
});

const fav = (input: string, entity: QlooEntity | null): ResolvedFavourite => ({ input, entity });

test("explain: names the favourites that seeded the pick", () => {
  const pick = ent("pick", [], ["f1", "f3"]);
  const r = explain(pick, { name: "Ada", score: 0.82 }, [
    fav("Fake Film One", ent("f1")),
    fav("Fake Film Two", ent("f2")),
    fav("Fake Film Three", ent("f3")),
  ]);
  assert.equal(r.band, "strong");
  assert.equal(r.text, "Strong fit for Ada (82%). Linked to their love of Fake Film One and Fake Film Three.");
});

test("explain: a low-fit seeded pick is described as a loose link", () => {
  const r = explain(ent("pick", [], ["f1"]), { name: "Zainab", score: 0.2 }, [fav("Fake Cafe", ent("f1"))]);
  assert.equal(r.text, "Less of a fit for Zainab (20%). Only a loose link to their love of Fake Cafe.");
});

test("explain: falls back to shared tags and lists the favourites behind them", () => {
  const pick = ent("pick", [
    ["t:spicy", "Spicy"],
    ["t:lively", "Lively"],
    ["t:restaurant", "Restaurant"],
  ]);
  const r = explain(
    pick,
    { name: "Tunde", score: 0.6 },
    [fav("Fake Suya", ent("a", [["t:spicy", "Spicy"], ["t:restaurant", "Restaurant"]])), fav("Fake Club", ent("b", [["t:lively", "Lively"]]))],
    ["t:restaurant"],
  );
  assert.equal(r.band, "good");
  assert.equal(r.text, "Good fit for Tunde (60%). Shares the spicy and lively feel of Fake Suya and Fake Club.");
});

test("explain: matches tags by name case-insensitively", () => {
  const pick = ent("pick", [["x:1", "Cozy"]]);
  const r = explain(pick, { name: "Zainab", score: 0.4 }, [fav("Fake Cafe", ent("c", [["y:1", "cozy"]]))]);
  assert.match(r.text, /^Decent fit for Zainab \(40%\)\. Shares the cozy feel of Fake Cafe\.$/);
});

test("explain: aggregate-only reason when there is no seed or tag overlap", () => {
  const r = explain(ent("pick"), { name: "Ada", score: 0.55 }, [fav("A", ent("a")), fav("B", ent("b")), fav("C", ent("c"))]);
  assert.equal(r.text, "Good fit for Ada (55%). Fits the taste Qloo reads from A and B.");
  const low = explain(ent("pick"), { name: "Ada", score: 0.1 }, [fav("A", ent("a"))]);
  assert.equal(low.band, "stretch");
  assert.equal(low.text, "Less of a fit for Ada (10%). Qloo sees little overlap with A.");
});

test("explain: says plainly when none of their favourites were found", () => {
  const r = explain(ent("pick"), { name: "Bo", score: 0 }, [fav("Unknown Thing", null)]);
  assert.equal(r.text, "None of Bo's favourites were found on Qloo, so this pick does not reflect their taste yet.");
});

test("explain: clamps bad scores and is deterministic", () => {
  const args = [ent("p", [], ["a"]), { name: "Ada", score: Number.NaN }, [fav("A", ent("a"))]] as const;
  const a = explain(...args);
  const b = explain(...args);
  assert.deepEqual(a, b);
  assert.equal(a.score, 0);
  assert.equal(explain(ent("p"), { name: "Ada", score: 7 }, [fav("A", ent("a"))]).score, 1);
});
