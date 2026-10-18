/**
 * Server-side Qloo client. The API key never leaves the server.
 *
 * - Mock mode (QLOO_MOCK=1, or no QLOO_API_KEY) uses the invented dataset in
 *   qloo-mock.ts so the app and tests run without a key.
 * - Live responses are cached in memory only (Map with TTL), never on disk,
 *   so no Qloo data ends up in the repo or on the filesystem.
 */
import { mockRequest } from "./qloo-mock";
import {
  parseInsightsResponse,
  parseSearchResponse,
  parseTagsResponse,
  type QlooEntity,
  type QlooTag,
} from "./qloo-parse";
import { toUrn, type EntityKind } from "./outing";

export const DEFAULT_QLOO_BASE_URL = "https://hackathon.api.qloo.com";
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 500;
const TIMEOUT_MS = 12_000;
/** The hackathon key allows 5 requests a second; stay just under it. */
const MAX_PER_SECOND = 4;

export class QlooError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "QlooError";
  }
}

export function isMockMode(): boolean {
  const flag = (process.env.QLOO_MOCK ?? "").trim().toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  return !process.env.QLOO_API_KEY?.trim();
}

const cache = new Map<string, { expires: number; data: unknown }>();

function cacheGet(key: string): unknown | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.data;
}

function cacheSet(key: string, data: unknown) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, data });
}

/** For tests. */
export function clearQlooCache() {
  cache.clear();
}

function friendlyError(status: number, path: string): string {
  if (status === 401) return "Qloo rejected the API key (401). Check QLOO_API_KEY.";
  if (status === 403) return "Qloo does not support that entity type on this key (403).";
  if (status === 429) return "Qloo rate limit reached (429). Try again in a moment.";
  return `Qloo request to ${path} failed with status ${status}.`;
}

const recentStarts: number[] = [];

/** Wait until a request can start without passing MAX_PER_SECOND in any one-second window. */
async function rateSlot(): Promise<void> {
  for (;;) {
    const now = Date.now();
    while (recentStarts.length && now - recentStarts[0] >= 1000) recentStarts.shift();
    if (recentStarts.length < MAX_PER_SECOND) {
      recentStarts.push(now);
      return;
    }
    await new Promise((r) => setTimeout(r, 1000 - (now - recentStarts[0]) + 5));
  }
}

async function qlooGet(path: string, params: URLSearchParams): Promise<unknown> {
  params.sort();
  if (isMockMode()) return mockRequest(path, params);

  const base = (process.env.QLOO_BASE_URL?.trim() || DEFAULT_QLOO_BASE_URL).replace(/\/+$/, "");
  const url = `${base}${path}?${params.toString()}`;
  const cached = cacheGet(url);
  if (cached !== undefined) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const send = async () => {
    await rateSlot();
    return fetch(url, {
      headers: { "X-Api-Key": process.env.QLOO_API_KEY!.trim(), Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
  };
  try {
    let res = await send();
    // Another instance may share the key's per-second budget: wait out the window once.
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1100));
      res = await send();
    }
    if (!res.ok) throw new QlooError(friendlyError(res.status, path), res.status);
    const json = (await res.json()) as unknown;
    cacheSet(url, json);
    return json;
  } catch (err) {
    if (err instanceof QlooError) throw err;
    if (err instanceof Error && err.name === "AbortError") throw new QlooError("Qloo took too long to answer.");
    throw new QlooError("Could not reach Qloo.");
  } finally {
    clearTimeout(timer);
  }
}

export const DEFAULT_SEARCH_KINDS: EntityKind[] = ["movie", "artist", "book", "tv_show", "place", "destination"];

export async function searchEntities(query: string, kinds: EntityKind[] = DEFAULT_SEARCH_KINDS, take = 5): Promise<QlooEntity[]> {
  const params = new URLSearchParams({ query, take: String(Math.max(1, Math.min(20, take))) });
  if (kinds.length) params.set("types", kinds.map(toUrn).join(","));
  return parseSearchResponse(await qlooGet("/search", params));
}

export type InsightsOptions = {
  kind: EntityKind;
  entityIds: string[];
  city?: string | null;
  radiusMeters?: number | null;
  tags?: string[] | null;
  take?: number | null;
  explain?: boolean;
  /** Qloo price level bounds for places, 1 (cheapest) to 4. */
  priceMin?: number | null;
  priceMax?: number | null;
  /** Score only these entity ids (Qloo `filter.results.entities`). */
  onlyIds?: string[] | null;
};

export async function getInsights(opts: InsightsOptions): Promise<QlooEntity[]> {
  const params = new URLSearchParams();
  params.set("filter.type", toUrn(opts.kind));
  if (opts.entityIds.length) params.set("signal.interests.entities", opts.entityIds.join(","));
  if (opts.city) params.set("filter.location.query", opts.city);
  if (opts.city && opts.radiusMeters) params.set("filter.location.radius", String(Math.round(opts.radiusMeters)));
  if (opts.tags?.length) params.set("filter.tags", opts.tags.join(","));
  if (opts.priceMin) params.set("filter.price_level.min", String(opts.priceMin));
  if (opts.priceMax) params.set("filter.price_level.max", String(opts.priceMax));
  if (opts.onlyIds?.length) params.set("filter.results.entities", opts.onlyIds.join(","));
  params.set("take", String(Math.max(1, Math.min(50, opts.take ?? 20))));
  if (opts.explain) params.set("feature.explainability", "true");
  return parseInsightsResponse(await qlooGet("/v2/insights", params));
}

export async function findTags(keyword: string, take = 10): Promise<QlooTag[]> {
  const params = new URLSearchParams({ "filter.query": keyword, take: String(Math.max(1, Math.min(50, take))) });
  return parseTagsResponse(await qlooGet("/v2/tags", params));
}
