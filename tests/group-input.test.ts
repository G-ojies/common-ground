import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanText, LIMITS, parseGroup } from "../src/lib/group-input";

const person = (name: string, favs: unknown[] = ["Something"]) => ({ name, favourites: favs });

test("parseGroup: accepts a valid group and trims names", () => {
  const r = parseGroup({
    outing: " Dinner ",
    city: "  Lagos ",
    vibe: " chill   and cheap ",
    people: [person("  Ada  ", [{ name: "  Jollof  ", kind: "place" }]), person("Tunde", ["Film A"])],
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.group.outing, "dinner");
  assert.equal(r.group.city, "Lagos");
  assert.equal(r.group.vibe, "chill and cheap");
  assert.deepEqual(r.group.people[0], { name: "Ada", favourites: [{ name: "Jollof", kind: "place" }] });
  assert.deepEqual(r.group.people[1].favourites, [{ name: "Film A" }]);
});

test("parseGroup: rejects non-objects and missing people", () => {
  assert.equal(parseGroup(null).ok, false);
  assert.equal(parseGroup([]).ok, false);
  const r = parseGroup({ outing: "movie" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.errors.join(" "), /Add the people/);
});

test("parseGroup: needs 2 to 8 people", () => {
  const one = parseGroup({ outing: "movie", people: [person("Ada")] });
  assert.equal(one.ok, false);
  const nine = parseGroup({
    outing: "movie",
    people: Array.from({ length: 9 }, (_, i) => person(`P${i}`)),
  });
  assert.equal(nine.ok, false);
  if (!nine.ok) assert.match(nine.errors[0], /2 to 8/);
  const eight = parseGroup({
    outing: "movie",
    people: Array.from({ length: LIMITS.maxPeople }, (_, i) => person(`P${i}`)),
  });
  assert.equal(eight.ok, true);
});

test("parseGroup: needs 1 to 6 favourites each, ignoring empty chips and duplicates", () => {
  const none = parseGroup({ outing: "movie", people: [person("Ada", ["  ", ""]), person("Bo")] });
  assert.equal(none.ok, false);
  if (!none.ok) assert.match(none.errors.join(" "), /Ada needs at least 1/);

  const seven = parseGroup({
    outing: "movie",
    people: [person("Ada", ["a", "b", "c", "d", "e", "f", "g"]), person("Bo")],
  });
  assert.equal(seven.ok, false);

  const dupes = parseGroup({
    outing: "movie",
    people: [person("Ada", ["Film", "film", " FILM "]), person("Bo")],
  });
  assert.equal(dupes.ok, true);
  if (dupes.ok) assert.equal(dupes.group.people[0].favourites.length, 1);
});

test("parseGroup: enforces length limits", () => {
  const longName = parseGroup({ outing: "movie", people: [person("x".repeat(41)), person("Bo")] });
  assert.equal(longName.ok, false);
  const longFav = parseGroup({ outing: "movie", people: [person("Ada", ["y".repeat(81)]), person("Bo")] });
  assert.equal(longFav.ok, false);
  const longCity = parseGroup({ outing: "dinner", city: "z".repeat(61), people: [person("A"), person("B")] });
  assert.equal(longCity.ok, false);
  const longVibe = parseGroup({ outing: "dinner", vibe: "v".repeat(201), people: [person("A"), person("B")] });
  assert.equal(longVibe.ok, false);
});

test("parseGroup: rejects unknown outings, blank and duplicate names", () => {
  const badOuting = parseGroup({ outing: "skydiving", people: [person("A"), person("B")] });
  assert.equal(badOuting.ok, false);
  const blank = parseGroup({ outing: "movie", people: [person("   "), person("B")] });
  assert.equal(blank.ok, false);
  const dup = parseGroup({ outing: "movie", people: [person("Ada"), person(" ada ")] });
  assert.equal(dup.ok, false);
  if (!dup.ok) assert.match(dup.errors.join(" "), /Two people/);
});

test("parseGroup: unknown favourite kinds are dropped, not fatal", () => {
  const r = parseGroup({
    outing: "music",
    people: [person("Ada", [{ name: "Song", kind: "spaceship" }]), person("Bo")],
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.group.people[0].favourites, [{ name: "Song" }]);
});

test("parseGroup: omits empty city and vibe", () => {
  const r = parseGroup({ outing: "movie", city: "  ", people: [person("A"), person("B")] });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal("city" in r.group, false);
    assert.equal("vibe" in r.group, false);
  }
});

test("cleanText: strips control characters and non-strings", () => {
  assert.equal(cleanText("a\u0000b\nc\t d"), "a b c d");
  assert.equal(cleanText(42), "");
  assert.equal(cleanText(undefined), "");
});
