/**
 * Deterministic, data-backed reasons for why a pick fits a person.
 * The LLM may rephrase these, but they are built only from Qloo data
 * (seed entities and shared tags) so nothing is invented.
 */
import { fitBand } from "./group-rank";
import type { QlooEntity, QlooTag } from "./qloo-parse";

export type ResolvedFavourite = {
  /** what the person typed */
  input: string;
  /** the Qloo entity it resolved to, or null if not found */
  entity: QlooEntity | null;
};

export type Reason = {
  person: string;
  score: number;
  band: ReturnType<typeof fitBand>;
  text: string;
};

const BAND_PHRASE: Record<Reason["band"], string> = {
  strong: "Strong fit",
  good: "Good fit",
  fair: "Decent fit",
  stretch: "Less of a fit",
};

function listNames(names: string[]): string {
  const unique = [...new Set(names)];
  if (unique.length <= 1) return unique[0] ?? "";
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(", ")} and ${unique[unique.length - 1]}`;
}

function tagKey(t: QlooTag): string {
  return t.name.toLowerCase();
}

/**
 * Build a one-line reason.
 * @param ignoreTagIds tags to skip (e.g. the outing's own filter tag like "restaurant")
 */
export function explain(
  pick: Pick<QlooEntity, "id" | "name" | "tags" | "seeds">,
  person: { name: string; score: number },
  favourites: ResolvedFavourite[],
  ignoreTagIds: string[] = [],
): Reason {
  const score = Math.max(0, Math.min(1, Number.isFinite(person.score) ? person.score : 0));
  const band = fitBand(score);
  const pct = Math.round(score * 100);
  const head = `${BAND_PHRASE[band]} for ${person.name} (${pct}%).`;
  const found = favourites.filter((f) => f.entity);

  if (found.length === 0) {
    return {
      person: person.name,
      score,
      band,
      text: `None of ${person.name}'s favourites were found on Qloo, so this pick does not reflect their taste yet.`,
    };
  }

  // 1. Explainability: which of their favourites seeded this result.
  const seedIds = new Set(pick.seeds ?? []);
  const seeded = found.filter((f) => f.entity && seedIds.has(f.entity.id)).map((f) => f.input);
  if (seeded.length) {
    return { person: person.name, score, band, text: `${head} Linked to their love of ${listNames(seeded.slice(0, 3))}.` };
  }

  // 2. Shared tags between the pick and their favourites.
  const ignore = new Set(ignoreTagIds);
  const pickTags = new Map<string, QlooTag>();
  for (const t of pick.tags) if (!ignore.has(t.id)) pickTags.set(tagKey(t), t);
  const sharedTags: string[] = [];
  const sources: string[] = [];
  for (const f of found) {
    for (const t of f.entity!.tags) {
      const hit = pickTags.get(tagKey(t));
      if (!hit) continue;
      if (!sharedTags.includes(hit.name)) sharedTags.push(hit.name);
      if (!sources.includes(f.input)) sources.push(f.input);
    }
  }
  if (sharedTags.length) {
    const tags = listNames(sharedTags.slice(0, 3).map((n) => n.toLowerCase()));
    return {
      person: person.name,
      score,
      band,
      text: `${head} Shares the ${tags} feel of ${listNames(sources.slice(0, 2))}.`,
    };
  }

  // 3. Only the aggregate signal.
  const basis = listNames(found.slice(0, 2).map((f) => f.input));
  const text =
    band === "stretch"
      ? `${head} Qloo sees little overlap with ${basis}.`
      : `${head} Fits the taste Qloo reads from ${basis}.`;
  return { person: person.name, score, band, text };
}
