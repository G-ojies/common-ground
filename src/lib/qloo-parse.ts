/**
 * Tolerant parsers for Qloo responses. The exact entity fields are not fully
 * documented, so every field is optional and unknown fields are ignored.
 */

export type QlooTag = { id: string; name: string };

export type QlooEntity = {
  id: string;
  name: string;
  types: string[];
  tags: QlooTag[];
  address?: string;
  city?: string;
  rating?: number;
  priceLevel?: number;
  image?: string;
  /** raw affinity score from an insights call */
  affinity?: number;
  /** entity ids the explainability block says contributed to this result */
  seeds?: string[];
};

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

function httpUrl(v: unknown): string | undefined {
  const s = isObj(v) ? str(v.url) : str(v);
  if (!s) return undefined;
  return /^https?:\/\//i.test(s) ? s : undefined;
}

export function parseTag(raw: unknown): QlooTag | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id) ?? str(raw.tag_id) ?? str(raw.entity_id);
  const name = str(raw.name) ?? str(raw.value);
  if (!id || !name) return null;
  return { id, name };
}

/** Collect entity ids found anywhere (depth-limited) inside an explainability block. */
function collectSeedIds(v: unknown, depth = 0, out = new Set<string>()): Set<string> {
  if (depth > 4 || out.size > 50) return out;
  if (Array.isArray(v)) {
    for (const item of v) collectSeedIds(item, depth + 1, out);
  } else if (isObj(v)) {
    const id = str(v.entity_id);
    if (id) out.add(id);
    for (const value of Object.values(v)) {
      if (typeof value === "object") collectSeedIds(value, depth + 1, out);
    }
  }
  return out;
}

export function parseEntity(raw: unknown): QlooEntity | null {
  if (!isObj(raw)) return null;
  const id = str(raw.entity_id) ?? str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return null;

  const props = isObj(raw.properties) ? raw.properties : {};
  const query = isObj(raw.query) ? raw.query : {};

  const types: string[] = [];
  if (Array.isArray(raw.types)) for (const t of raw.types) if (str(t)) types.push(String(t));
  if (str(raw.type) && !types.includes(String(raw.type))) types.push(String(raw.type));
  if (str(raw.subtype) && !types.includes(String(raw.subtype))) types.push(String(raw.subtype));

  const tags: QlooTag[] = [];
  if (Array.isArray(raw.tags)) {
    for (const t of raw.tags) {
      const tag = parseTag(t);
      if (tag && !tags.some((x) => x.id === tag.id)) tags.push(tag);
      if (tags.length >= 25) break;
    }
  }

  const geocode = isObj(props.geocode) ? props.geocode : {};
  const location = isObj(raw.location) ? raw.location : {};

  const entity: QlooEntity = { id, name, types, tags };
  const address = str(props.address) ?? str(raw.address);
  if (address) entity.address = address;
  const city = str(geocode.city) ?? str(location.city) ?? str(props.city);
  if (city) entity.city = city;
  const rating = num(props.business_rating) ?? num(raw.business_rating);
  if (rating !== undefined) entity.rating = rating;
  const price = num(props.price_level) ?? num(raw.price_level);
  if (price !== undefined) entity.priceLevel = price;
  const image = httpUrl(props.image) ?? httpUrl(raw.image);
  if (image) entity.image = image;
  const affinity = num(query.affinity) ?? num(raw.affinity) ?? num(raw.score);
  if (affinity !== undefined) entity.affinity = affinity;
  if (query.explainability !== undefined) {
    const seeds = [...collectSeedIds(query.explainability)].filter((s) => s !== id);
    if (seeds.length) entity.seeds = seeds;
  }
  return entity;
}

function parseList(list: unknown): QlooEntity[] {
  if (!Array.isArray(list)) return [];
  const out: QlooEntity[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const e = parseEntity(raw);
    if (e && !seen.has(e.id)) {
      seen.add(e.id);
      out.push(e);
    }
  }
  return out;
}

/** GET /search -> { results: [...] } (also tolerates results.entities). */
export function parseSearchResponse(json: unknown): QlooEntity[] {
  if (!isObj(json)) return [];
  if (Array.isArray(json.results)) return parseList(json.results);
  if (isObj(json.results)) return parseList(json.results.entities);
  return parseList(json.entities);
}

/** GET /v2/insights -> { results: { entities: [...] } } (also tolerates results: [...]). */
export function parseInsightsResponse(json: unknown): QlooEntity[] {
  return parseSearchResponse(json);
}

/** GET /v2/tags -> tolerant: results.tags | results | tags. */
export function parseTagsResponse(json: unknown): QlooTag[] {
  if (!isObj(json)) return [];
  const results = json.results;
  const list = Array.isArray(results)
    ? results
    : isObj(results) && Array.isArray(results.tags)
      ? results.tags
      : isObj(results) && Array.isArray(results.entities)
        ? results.entities
        : Array.isArray(json.tags)
          ? json.tags
          : [];
  const out: QlooTag[] = [];
  for (const raw of list) {
    const tag = parseTag(raw);
    if (tag && !out.some((t) => t.id === tag.id)) out.push(tag);
  }
  return out;
}
