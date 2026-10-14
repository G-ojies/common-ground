import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseEntity,
  parseInsightsResponse,
  parseSearchResponse,
  parseTagsResponse,
} from "../src/lib/qloo-parse";

// Invented shapes for tests only; no real Qloo response data is stored here.

test("parseEntity: reads id from entity_id or id and requires a name", () => {
  assert.equal(parseEntity({ entity_id: "E1", name: "Fake One" })?.id, "E1");
  assert.equal(parseEntity({ id: "E2", name: "Fake Two" })?.id, "E2");
  assert.equal(parseEntity({ id: "E3" }), null);
  assert.equal(parseEntity({ name: "No id" }), null);
  assert.equal(parseEntity("nope"), null);
});

test("parseEntity: pulls optional place fields and ignores unknown ones", () => {
  const e = parseEntity({
    entity_id: "P1",
    name: "Fake Diner",
    types: ["urn:entity:place"],
    subtype: "urn:entity:place:restaurant",
    tags: [{ id: "t1", name: "Cozy" }, { tag_id: "t2", name: "Cheap" }, { id: "t1", name: "Cozy" }, { bad: 1 }],
    properties: {
      address: "1 Fake Street",
      business_rating: "4.4",
      price_level: 2,
      image: { url: "https://example.com/a.jpg" },
      geocode: { city: "Lagos" },
      something_new: { deep: true },
    },
    query: { affinity: 0.91 },
  });
  assert.ok(e);
  assert.deepEqual(e.types, ["urn:entity:place", "urn:entity:place:restaurant"]);
  assert.deepEqual(e.tags.map((t) => t.id), ["t1", "t2"]);
  assert.equal(e.address, "1 Fake Street");
  assert.equal(e.rating, 4.4);
  assert.equal(e.priceLevel, 2);
  assert.equal(e.image, "https://example.com/a.jpg");
  assert.equal(e.city, "Lagos");
  assert.equal(e.affinity, 0.91);
});

test("parseEntity: rejects non-http images and reads top-level affinity", () => {
  const e = parseEntity({ id: "X", name: "Fake", image: "javascript:alert(1)", affinity: 0.3 });
  assert.equal(e?.image, undefined);
  assert.equal(e?.affinity, 0.3);
  const s = parseEntity({ id: "Y", name: "Fake", image: "https://example.com/y.png" });
  assert.equal(s?.image, "https://example.com/y.png");
});

test("parseEntity: collects seed ids from an explainability block", () => {
  const e = parseEntity({
    entity_id: "R1",
    name: "Fake Result",
    query: {
      affinity: 0.5,
      explainability: { "signal.interests.entities": [{ entity_id: "S1", score: 0.9 }, { entity_id: "S2" }] },
    },
  });
  assert.deepEqual(e?.seeds, ["S1", "S2"]);
});

test("parseSearchResponse: accepts results array or results.entities and dedupes", () => {
  assert.equal(parseSearchResponse({ success: true, results: [{ id: "a", name: "A" }, { id: "a", name: "A" }] }).length, 1);
  assert.equal(parseSearchResponse({ results: { entities: [{ id: "b", name: "B" }] } })[0].id, "b");
  assert.deepEqual(parseSearchResponse(null), []);
  assert.deepEqual(parseSearchResponse({ results: "x" }), []);
});

test("parseInsightsResponse: reads results.entities", () => {
  const list = parseInsightsResponse({
    success: true,
    results: { entities: [{ entity_id: "m1", name: "Fake Movie", query: { affinity: 0.7 } }, { junk: true }] },
  });
  assert.equal(list.length, 1);
  assert.equal(list[0].affinity, 0.7);
});

test("parseTagsResponse: tolerates several shapes", () => {
  assert.deepEqual(parseTagsResponse({ results: { tags: [{ id: "t", name: "T" }] } }), [{ id: "t", name: "T" }]);
  assert.deepEqual(parseTagsResponse({ results: [{ tag_id: "u", name: "U" }] }), [{ id: "u", name: "U" }]);
  assert.deepEqual(parseTagsResponse({ tags: [{ id: "v", name: "V" }, { id: "v", name: "V" }] }), [{ id: "v", name: "V" }]);
  assert.deepEqual(parseTagsResponse(undefined), []);
});
