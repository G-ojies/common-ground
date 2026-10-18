/**
 * MOCK Qloo backend.
 *
 * Everything in this file is INVENTED for demos and tests. It is not Qloo
 * data and is not derived from Qloo responses. Names are prefixed with
 * "Mock" and ids with "mock-" so they are never mistaken for real results.
 *
 * Each mock entity carries a few fake "taste" tags (lively, spicy, cozy...).
 * Insights are scored by tag overlap between the signal entities and the
 * candidates, which is enough to exercise the whole group-fit pipeline.
 *
 * The functions return raw JSON in roughly Qloo's response shape, so the
 * same tolerant parsers handle mock and live responses.
 */

type MockEntity = {
  id: string;
  name: string;
  kind: string; // short entity kind, e.g. "movie"
  tags: string[]; // keys of TASTE or GENRE
  city?: string;
  address?: string;
  rating?: number;
  price?: number;
};

const TASTE: Record<string, string> = {
  lively: "Lively",
  cozy: "Cozy",
  spicy: "Spicy",
  romantic: "Romantic",
  adventurous: "Adventurous",
  nostalgic: "Nostalgic",
  afro: "Afro-rooted",
  upscale: "Upscale",
  budget: "Budget-friendly",
  thoughtful: "Thoughtful",
  funny: "Funny",
  family: "Family-friendly",
};

const RESTAURANT_TAG = "urn:tag:genre:place:restaurant";

function tagId(key: string): string {
  return key === "restaurant" ? RESTAURANT_TAG : `urn:tag:mock:${key}`;
}
function tagName(key: string): string {
  return key === "restaurant" ? "Restaurant" : (TASTE[key] ?? key);
}

const place = (
  id: string,
  name: string,
  city: string,
  area: string,
  tags: string[],
  rating: number,
  price: number,
  restaurant = true,
): MockEntity => ({
  id: `mock-place-${id}`,
  name,
  kind: "place",
  city,
  address: `1 Mock Street, ${area}, ${city}`,
  rating,
  price,
  tags: restaurant ? ["restaurant", ...tags] : tags,
});

const item = (kind: string, id: string, name: string, tags: string[]): MockEntity => ({
  id: `mock-${kind}-${id}`,
  name,
  kind,
  tags,
});

export const MOCK_ENTITIES: MockEntity[] = [
  // Lagos
  place("l1", "Mock Jollof House", "Lagos", "Yaba", ["afro", "spicy", "lively", "budget"], 4.5, 1),
  place("l2", "Mock Suya Spot", "Lagos", "Surulere", ["spicy", "lively", "budget"], 4.3, 1),
  place("l3", "Mock Lagoon Grill", "Lagos", "Victoria Island", ["romantic", "upscale", "cozy"], 4.6, 3),
  place("l4", "Mock Island Noodle Bar", "Lagos", "Lekki", ["adventurous", "spicy", "cozy"], 4.2, 2),
  place("l5", "Mock Rooftop Lounge", "Lagos", "Ikoyi", ["lively", "upscale", "afro"], 4.1, 3),
  place("l6", "Mock Garden Cafe", "Lagos", "Ikeja GRA", ["cozy", "thoughtful", "family", "budget"], 4.4, 2),
  place("l7", "Mock Amala Corner", "Lagos", "Ojota", ["afro", "nostalgic", "budget", "family"], 4.0, 1),
  // Abuja
  place("a1", "Mock Pepper Soup Kitchen", "Abuja", "Wuse 2", ["spicy", "afro", "cozy", "budget"], 4.3, 1),
  place("a2", "Mock Hilltop Bistro", "Abuja", "Maitama", ["romantic", "upscale", "thoughtful"], 4.5, 3),
  place("a3", "Mock Zuma Grill House", "Abuja", "Garki", ["lively", "spicy", "family"], 4.2, 2),
  place("a4", "Mock Wuse Book Cafe", "Abuja", "Wuse", ["cozy", "thoughtful", "budget"], 4.4, 1),
  place("a5", "Mock Jabi Lakeside Diner", "Abuja", "Jabi", ["lively", "family", "adventurous"], 4.0, 2),
  // Benin City
  place("b1", "Mock Bini Pot", "Benin City", "GRA", ["afro", "spicy", "family", "budget"], 4.4, 1),
  place("b2", "Mock Ring Road Grill", "Benin City", "Ring Road", ["lively", "spicy", "adventurous"], 4.1, 2),
  place("b3", "Mock Oba Market Eatery", "Benin City", "Oba Market", ["nostalgic", "budget", "family"], 4.2, 1),
  place("b4", "Mock Moat Garden Lounge", "Benin City", "Sapele Road", ["romantic", "cozy", "upscale"], 4.5, 3),
  place("b5", "Mock Uniben Gate Buka", "Benin City", "Ugbowo", ["budget", "lively", "afro", "funny"], 4.0, 1),

  // Films
  item("movie", "1", "Mock Movie: Third Mainland Chase", ["adventurous", "lively", "afro"]),
  item("movie", "2", "Mock Movie: Rainy Season Letters", ["romantic", "nostalgic", "thoughtful"]),
  item("movie", "3", "Mock Movie: Aunty's Wedding Chaos", ["funny", "family", "afro", "lively"]),
  item("movie", "4", "Mock Movie: Star Harbour", ["adventurous", "thoughtful"]),
  item("movie", "5", "Mock Movie: Quiet Kitchen", ["cozy", "thoughtful", "romantic"]),
  item("movie", "6", "Mock Movie: Owambe Nights", ["lively", "funny", "afro"]),
  item("movie", "7", "Mock Movie: The Last Danfo", ["funny", "adventurous", "nostalgic"]),
  item("movie", "8", "Mock Movie: Glass Towers", ["upscale", "thoughtful"]),
  item("movie", "9", "Mock Movie: Harmattan Haunting", ["adventurous", "spicy"]),

  // Artists
  item("artist", "1", "Mock Artist: Highlife Revival Band", ["nostalgic", "afro", "lively"]),
  item("artist", "2", "Mock Artist: Amapiano Collective", ["lively", "afro", "adventurous"]),
  item("artist", "3", "Mock Artist: Quiet Strings Trio", ["cozy", "thoughtful", "romantic"]),
  item("artist", "4", "Mock Artist: Lagos Jazz Quartet", ["upscale", "cozy", "nostalgic"]),
  item("artist", "5", "Mock Artist: Sunday Choir Live", ["family", "lively", "nostalgic"]),
  item("artist", "6", "Mock Artist: Alte Soundsystem", ["adventurous", "lively", "upscale"]),
  item("artist", "7", "Mock Artist: Comedy Rap Duo", ["funny", "lively", "budget"]),

  // Books
  item("book", "1", "Mock Book: The Harmattan Diaries", ["nostalgic", "thoughtful", "afro"]),
  item("book", "2", "Mock Book: Code and Kola", ["thoughtful", "adventurous"]),
  item("book", "3", "Mock Book: Love on Allen Avenue", ["romantic", "lively", "funny"]),
  item("book", "4", "Mock Book: Spirits of the Creek", ["adventurous", "afro", "spicy"]),
  item("book", "5", "Mock Book: Small Kitchen, Big Dreams", ["cozy", "family", "budget"]),
  item("book", "6", "Mock Book: Campus Chronicles", ["funny", "nostalgic", "budget"]),

  // TV
  item("tv_show", "1", "Mock Show: Hostel Life", ["funny", "budget", "lively"]),
  item("tv_show", "2", "Mock Show: Boardroom Kings", ["upscale", "thoughtful"]),
  item("tv_show", "3", "Mock Show: Village Detectives", ["adventurous", "funny", "afro"]),
  item("tv_show", "4", "Mock Show: Kitchen Duel Naija", ["spicy", "lively", "family"]),

  // Destinations
  item("destination", "1", "Mock Destination: Obudu Highlands", ["adventurous", "cozy", "romantic"]),
  item("destination", "2", "Mock Destination: Lekki Coast", ["lively", "romantic", "upscale"]),
  item("destination", "3", "Mock Destination: Erin Ijesha Falls", ["adventurous", "budget"]),
  item("destination", "4", "Mock Destination: Old Benin Heritage Walk", ["nostalgic", "thoughtful", "afro"]),
  item("destination", "5", "Mock Destination: Yankari Safari Park", ["adventurous", "family"]),
  item("destination", "6", "Mock Destination: Calabar Carnival Town", ["lively", "afro", "funny"]),

  // Podcasts and games, for completeness
  item("podcast", "1", "Mock Podcast: Gist Hour", ["funny", "lively"]),
  item("podcast", "2", "Mock Podcast: Founders in Yaba", ["thoughtful", "adventurous"]),
  item("video_game", "1", "Mock Game: Danfo Racer", ["adventurous", "funny"]),
  item("video_game", "2", "Mock Game: Ludo Legends", ["family", "nostalgic", "budget"]),
];

/** Keyword hints so free-text favourites get a plausible mock taste profile. */
const HINTS: Array<[RegExp, string[]]> = [
  [/afro|amapiano|naija|lagos|burna|wizkid|davido|tems|rema|asake|nollywood/i, ["afro", "lively"]],
  [/jollof|suya|pepper|spic|chilli|chili|curry|jerk|hot/i, ["spicy"]],
  [/jazz|piano|classical|acoustic|lofi|lo-fi|indie/i, ["cozy", "thoughtful"]],
  [/comed|funny|sitcom|laugh|skit/i, ["funny"]],
  [/roman|love|wedding|date/i, ["romantic"]],
  [/action|adventure|thriller|marvel|hike|safari|sci-?fi|space/i, ["adventurous"]],
  [/drama|novel|documentary|history|biograph|philosoph/i, ["thoughtful"]],
  [/gospel|family|kids|disney|pixar|animation|cartoon/i, ["family"]],
  [/luxury|fine|steak|wine|sushi|rooftop|lounge/i, ["upscale"]],
  [/cheap|street|buka|mama|canteen/i, ["budget"]],
  [/retro|classic|old|90s|80s|highlife|fela|vintage/i, ["nostalgic"]],
  [/party|club|dance|owambe|festival|concert/i, ["lively"]],
  [/cafe|coffee|tea|bakery|book/i, ["cozy"]],
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const TASTE_KEYS = Object.keys(TASTE);

function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/^mock(\s+\w+)?:\s*/, "")
    .replace(/^mock\s+/, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build a synthetic stand-in for a free-text favourite that has no mock entry.
 * Its taste tags are encoded in the id so later insights calls stay stateless.
 */
function synthesise(query: string, kind: string): MockEntity {
  const tags: string[] = [];
  for (const [re, keys] of HINTS) {
    if (re.test(query)) for (const k of keys) if (!tags.includes(k)) tags.push(k);
  }
  const h = hash(query.toLowerCase());
  for (let i = 0; tags.length < 2 && i < TASTE_KEYS.length; i++) {
    const k = TASTE_KEYS[(h + i * 5) % TASTE_KEYS.length];
    if (!tags.includes(k)) tags.push(k);
  }
  const unique = tags.slice(0, 4);
  return {
    id: `mock-syn-${kind}-${h.toString(36)}~${unique.join(".")}`,
    name: `${query} (mock match)`,
    kind,
    tags: unique,
  };
}

function lookup(id: string): MockEntity | null {
  const found = MOCK_ENTITIES.find((e) => e.id === id);
  if (found) return found;
  const m = /^mock-syn-([a-z_]+)-[a-z0-9]+~([a-z.]+)$/.exec(id);
  if (!m) return null;
  return { id, name: id, kind: m[1], tags: m[2].split(".").filter((k) => k in TASTE) };
}

function toRaw(e: MockEntity, extra: Record<string, unknown> = {}) {
  return {
    entity_id: e.id,
    name: e.name,
    types: [`urn:entity:${e.kind}`],
    tags: e.tags.map((k) => ({ id: tagId(k), name: tagName(k) })),
    properties: {
      ...(e.address ? { address: e.address } : {}),
      ...(e.rating !== undefined ? { business_rating: e.rating } : {}),
      ...(e.price !== undefined ? { price_level: e.price } : {}),
      ...(e.city ? { geocode: { city: e.city } } : {}),
    },
    ...extra,
  };
}

function kindsFrom(types: string | null | undefined): string[] {
  if (!types) return [];
  return types
    .split(",")
    .map((t) => t.trim().replace(/^urn:entity:/, ""))
    .filter(Boolean);
}

export function mockSearch(params: URLSearchParams) {
  const query = (params.get("query") ?? "").trim();
  const kinds = kindsFrom(params.get("types"));
  const take = Math.max(1, Math.min(20, Number(params.get("take")) || 5));
  if (!query) return { success: true, results: [] };

  const q = normaliseName(query);
  const pool = MOCK_ENTITIES.filter((e) => kinds.length === 0 || kinds.includes(e.kind));
  const hits = pool.filter((e) => {
    const n = normaliseName(e.name);
    return q.length >= 3 && (n.includes(q) || q.includes(n));
  });
  const results = hits.slice(0, take).map((e) => toRaw(e));
  if (results.length === 0) {
    results.push(toRaw(synthesise(query, kinds[0] ?? "movie")));
  }
  return { success: true, results };
}

export function mockInsights(params: URLSearchParams) {
  const kind = (params.get("filter.type") ?? "").replace(/^urn:entity:/, "");
  const signalIds = (params.get("signal.interests.entities") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const city = (params.get("filter.location.query") ?? "").trim().toLowerCase();
  const tagFilter = (params.get("filter.tags") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const take = Math.max(1, Math.min(50, Number(params.get("take")) || 20));
  const explain = params.get("feature.explainability") === "true";
  const onlyIds = new Set(
    (params.get("filter.results.entities") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  let pool = MOCK_ENTITIES.filter((e) => e.kind === kind && (!onlyIds.size || onlyIds.has(e.id)));
  if (pool.length === 0) return { success: true, results: { entities: [] } };

  if (city) {
    const inCity = pool.filter((e) => !e.city || e.city.toLowerCase().includes(city) || city.includes(e.city.toLowerCase()));
    // Unknown city in mock mode: fall back to every mock place so the demo still works.
    if (inCity.length) pool = inCity;
  }

  const knownTagIds = new Set([RESTAURANT_TAG, ...TASTE_KEYS.map(tagId)]);
  const activeTags = tagFilter.filter((t) => knownTagIds.has(t));
  if (activeTags.length) {
    pool = pool.filter((e) => activeTags.every((t) => e.tags.map(tagId).includes(t)));
  }

  const signals = signalIds.map(lookup).filter((e): e is MockEntity => e !== null);
  const profile = new Map<string, number>();
  for (const s of signals) for (const t of s.tags) profile.set(t, (profile.get(t) ?? 0) + 1);
  const total = [...profile.values()].reduce((a, b) => a + b, 0);

  const scored = pool.map((e) => {
    const overlap = e.tags.reduce((acc, t) => acc + (profile.get(t) ?? 0), 0);
    const jitter = (hash(e.id + signalIds.join(",")) % 1000) / 100000; // < 0.01, deterministic
    const affinity = total ? Math.min(0.99, 0.2 + 0.75 * (overlap / total) + jitter) : 0.2 + jitter;
    const seeds = signals.filter((s) => s.tags.some((t) => e.tags.includes(t))).map((s) => ({ entity_id: s.id }));
    return { e, overlap, affinity, seeds };
  });

  // Pinned ids are always scored, like Qloo does, even with no overlap.
  const useful = signals.length && !onlyIds.size ? scored.filter((s) => s.overlap > 0) : scored;
  useful.sort((a, b) => b.affinity - a.affinity);

  return {
    success: true,
    results: {
      entities: useful.slice(0, take).map((s) =>
        toRaw(s.e, {
          query: {
            affinity: Number(s.affinity.toFixed(4)),
            ...(explain && s.seeds.length ? { explainability: { "signal.interests.entities": s.seeds } } : {}),
          },
        }),
      ),
    },
  };
}

export function mockTags(params: URLSearchParams) {
  const q = (params.get("filter.query") ?? "").trim().toLowerCase();
  const all = [
    { id: RESTAURANT_TAG, name: "Restaurant" },
    ...TASTE_KEYS.map((k) => ({ id: tagId(k), name: tagName(k) })),
  ];
  const tags = q ? all.filter((t) => t.name.toLowerCase().includes(q) || t.id.includes(q)) : all;
  return { success: true, results: { tags } };
}

/** Dispatch a mock request by path. */
export function mockRequest(path: string, params: URLSearchParams): unknown {
  if (path === "/search") return mockSearch(params);
  if (path === "/v2/insights") return mockInsights(params);
  if (path === "/v2/tags") return mockTags(params);
  return { success: false, error: "unknown mock path" };
}
