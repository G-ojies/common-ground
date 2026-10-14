import { test } from "node:test";
import assert from "node:assert/strict";
import { fitBand, groupRank, normaliseScores } from "../src/lib/group-rank";

const scores = (pairs: Record<string, number>) => new Map(Object.entries(pairs));
const c = (id: string) => ({ id, name: id.toUpperCase() });

test("groupRank: empty people or empty candidates returns []", () => {
  assert.deepEqual(groupRank([], [c("a")]), []);
  assert.deepEqual(groupRank([{ person: "Ada", scores: scores({ a: 1 }) }], []), []);
});

test("groupRank: sorts by the minimum across people, not the mean", () => {
  const ranked = groupRank(
    [
      { person: "Ada", scores: scores({ a: 1.0, b: 0.6 }) },
      { person: "Tunde", scores: scores({ a: 0.1, b: 0.6 }) },
    ],
    [c("a"), c("b")],
  );
  // Ada loves a, but Tunde barely likes it; b is fine for both.
  assert.equal(ranked[0].candidate.id, "b");
  assert.equal(ranked[0].min, 0.6);
  assert.equal(ranked[1].candidate.id, "a");
  assert.ok(Math.abs(ranked[1].mean - 0.55) < 1e-9);
});

test("groupRank: a high-mean pick that leaves one person out ranks below a fair one", () => {
  const ranked = groupRank(
    [
      { person: "Ada", scores: scores({ loud: 1, fair: 0.5 }) },
      { person: "Bisi", scores: scores({ loud: 1, fair: 0.5 }) },
      { person: "Chidi", scores: scores({ loud: 0.2, fair: 0.5 }) },
    ],
    [c("loud"), c("fair")],
  );
  assert.equal(ranked[0].candidate.id, "fair");
  assert.deepEqual(ranked[1].leftOut, ["Chidi"]);
});

test("groupRank: ties on min are broken by mean", () => {
  const ranked = groupRank(
    [
      { person: "Ada", scores: scores({ a: 0.5, b: 0.9 }) },
      { person: "Tunde", scores: scores({ a: 0.5, b: 0.5 }) },
    ],
    [c("a"), c("b")],
  );
  assert.deepEqual(
    ranked.map((r) => r.candidate.id),
    ["b", "a"],
  );
});

test("groupRank: full ties keep input order (stable)", () => {
  const people = [
    { person: "Ada", scores: scores({ a: 0.5, b: 0.5, c: 0.5 }) },
    { person: "Tunde", scores: scores({ a: 0.5, b: 0.5, c: 0.5 }) },
  ];
  assert.deepEqual(
    groupRank(people, [c("c"), c("a"), c("b")]).map((r) => r.candidate.id),
    ["c", "a", "b"],
  );
});

test("groupRank: a person with no score for a candidate counts as 0 and is left out", () => {
  const ranked = groupRank(
    [
      { person: "Ada", scores: scores({ a: 0.9 }) },
      { person: "Tunde", scores: scores({}) },
    ],
    [c("a")],
  );
  assert.equal(ranked[0].min, 0);
  assert.ok(Math.abs(ranked[0].mean - 0.45) < 1e-9);
  assert.deepEqual(ranked[0].perPerson, [
    { person: "Ada", score: 0.9 },
    { person: "Tunde", score: 0 },
  ]);
  assert.deepEqual(ranked[0].leftOut, ["Tunde"]);
});

test("groupRank: single person ranks by their own score", () => {
  const ranked = groupRank(
    [{ person: "Ada", scores: scores({ a: 0.2, b: 0.8, c: 0.5 }) }],
    [c("a"), c("b"), c("c")],
  );
  assert.deepEqual(
    ranked.map((r) => r.candidate.id),
    ["b", "c", "a"],
  );
  assert.equal(ranked[0].min, ranked[0].mean);
  assert.deepEqual(ranked[2].leftOut, ["Ada"]);
});

test("groupRank: respects a custom left-out threshold", () => {
  const ranked = groupRank(
    [
      { person: "Ada", scores: scores({ a: 0.6 }) },
      { person: "Tunde", scores: scores({ a: 0.4 }) },
    ],
    [c("a")],
    { leftOutThreshold: 0.5 },
  );
  assert.deepEqual(ranked[0].leftOut, ["Tunde"]);
});

test("groupRank: duplicate candidates are collapsed", () => {
  const ranked = groupRank([{ person: "Ada", scores: scores({ a: 1 }) }], [c("a"), c("a")]);
  assert.equal(ranked.length, 1);
});

test("groupRank: out-of-range and NaN scores are clamped", () => {
  const ranked = groupRank(
    [{ person: "Ada", scores: scores({ a: 3, b: Number.NaN, c: -1 }) }],
    [c("a"), c("b"), c("c")],
  );
  assert.equal(ranked[0].perPerson[0].score, 1);
  assert.equal(ranked[1].perPerson[0].score, 0);
  assert.equal(ranked[2].perPerson[0].score, 0);
});

test("normaliseScores: min-max scales affinities into [floor, 1]", () => {
  const m = normaliseScores([
    { id: "a", affinity: 0.9 },
    { id: "b", affinity: 0.7 },
    { id: "c", affinity: 0.5 },
  ]);
  assert.equal(m.get("a"), 1);
  assert.ok(Math.abs((m.get("b") ?? 0) - 0.55) < 1e-9);
  assert.ok(Math.abs((m.get("c") ?? 0) - 0.1) < 1e-9);
});

test("normaliseScores: falls back to list position without affinities", () => {
  const m = normaliseScores([{ id: "a" }, { id: "b" }, { id: "c", affinity: 0.3 }]);
  assert.equal(m.get("a"), 1);
  assert.ok(Math.abs((m.get("b") ?? 0) - 0.55) < 1e-9);
  assert.ok(Math.abs((m.get("c") ?? 0) - 0.1) < 1e-9);
});

test("normaliseScores: equal affinities fall back to position", () => {
  const m = normaliseScores([
    { id: "a", affinity: 0.5 },
    { id: "b", affinity: 0.5 },
  ]);
  assert.equal(m.get("a"), 1);
  assert.ok(Math.abs((m.get("b") ?? 0) - 0.1) < 1e-9);
});

test("normaliseScores: empty, single and duplicate ids", () => {
  assert.equal(normaliseScores([]).size, 0);
  assert.equal(normaliseScores([{ id: "x", affinity: 0.2 }]).get("x"), 1);
  const m = normaliseScores([{ id: "a" }, { id: "a" }, { id: "" }, { id: "b" }]);
  assert.equal(m.size, 2);
  assert.equal(m.get("b"), 0.1);
});

test("fitBand: maps scores to plain bands", () => {
  assert.equal(fitBand(0.9), "strong");
  assert.equal(fitBand(0.6), "good");
  assert.equal(fitBand(0.4), "fair");
  assert.equal(fitBand(0.1), "stretch");
});
