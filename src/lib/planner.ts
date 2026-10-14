/**
 * The planning pipeline the agent's tools call. Also used directly to build
 * a deterministic plan when no LLM key is configured.
 */
import { explain, type Reason, type ResolvedFavourite } from "./explain";
import { groupRank, normaliseScores, type PersonScores } from "./group-rank";
import type { Favourite, Group } from "./group-input";
import { OUTING_SPECS, type EntityKind } from "./outing";
import { DEFAULT_SEARCH_KINDS, findTags, getInsights, isMockMode, QlooError, searchEntities } from "./qloo";
import type { QlooEntity, QlooTag } from "./qloo-parse";

export type Step = { tool: string; input: string; output: string };

export type PickView = {
  id: string;
  name: string;
  kind: EntityKind;
  address?: string;
  city?: string;
  rating?: number;
  priceLevel?: number;
  image?: string;
  tags: string[];
  /** lowest per-person fit, 0..1 */
  groupScore: number;
  /** average per-person fit, 0..1 */
  meanScore: number;
  /** fit against everyone's favourites at once, 0..1, if that call worked */
  crowdScore?: number;
  perPerson: Reason[];
  leftOut: string[];
};

export type GroupPicksResult = {
  kind: EntityKind;
  city?: string;
  tags: string[];
  picks: PickView[];
  /** people with no favourites found on Qloo (not part of the ranking) */
  unscored: string[];
  notes: string[];
};

export class PlanSession {
  readonly profiles = new Map<string, ResolvedFavourite[]>();
  readonly steps: Step[] = [];
  lastPicks: GroupPicksResult | null = null;

  constructor(readonly group: Group) {}

  personByName(name: string) {
    const key = name.trim().toLowerCase();
    return this.group.people.find((p) => p.name.toLowerCase() === key) ?? null;
  }

  record(tool: string, input: string, output: string) {
    this.steps.push({ tool, input: input.slice(0, 300), output: output.slice(0, 400) });
  }
}

function bestMatch(query: string, results: QlooEntity[]): QlooEntity | null {
  if (!results.length) return null;
  const q = query.trim().toLowerCase();
  return results.find((r) => r.name.toLowerCase() === q) ?? results[0];
}

function errorText(err: unknown): string {
  return err instanceof QlooError ? err.message : "Something went wrong talking to Qloo.";
}

/** Resolve one person's favourites to Qloo entities (or null when not found). */
export async function resolveFavourites(
  session: PlanSession,
  personName: string,
  items: Favourite[],
): Promise<{ person: string; resolved: Array<{ input: string; match: string | null; id: string | null }> }> {
  const person = session.personByName(personName);
  if (!person) {
    session.record("resolve_favourites", personName, "No such person in the group.");
    throw new Error(`"${personName}" is not in this group.`);
  }
  const list = items.slice(0, 6);
  const resolved: ResolvedFavourite[] = await Promise.all(
    list.map(async (f) => {
      try {
        const kinds = f.kind ? [f.kind as EntityKind] : DEFAULT_SEARCH_KINDS;
        const results = await searchEntities(f.name, kinds, 5);
        return { input: f.name, entity: bestMatch(f.name, results) };
      } catch (err) {
        if (err instanceof QlooError && err.status === 401) throw err;
        return { input: f.name, entity: null };
      }
    }),
  );

  // Merge with anything already resolved for this person.
  const existing = session.profiles.get(person.name) ?? [];
  const merged = [...existing.filter((e) => !resolved.some((r) => r.input.toLowerCase() === e.input.toLowerCase())), ...resolved];
  session.profiles.set(person.name, merged);

  const summary = resolved.map((r) => ({ input: r.input, match: r.entity?.name ?? null, id: r.entity?.id ?? null }));
  session.record(
    "resolve_favourites",
    `${person.name}: ${list.map((f) => f.name).join(", ")}`,
    summary.map((s) => (s.match ? `${s.input} -> ${s.match}` : `${s.input} -> not found`)).join("; "),
  );
  return { person: person.name, resolved: summary };
}

/** Resolve everyone who has not been resolved yet. */
export async function ensureResolved(session: PlanSession) {
  for (const p of session.group.people) {
    if (!session.profiles.has(p.name)) await resolveFavourites(session, p.name, p.favourites);
  }
}

export type FindPicksArgs = {
  kind: EntityKind;
  city?: string | null;
  tags?: string[] | null;
  take?: number | null;
};

const PER_PERSON_TAKE = 30;

async function insightsWithFallback(
  args: { kind: EntityKind; entityIds: string[]; city?: string | null; tags: string[]; take: number },
  notes: string[],
): Promise<QlooEntity[]> {
  const list = await getInsights({ ...args, explain: true });
  if (list.length || !args.tags.length) return list;
  // 200 with no entities usually means the tag filter does not fit this type.
  const retry = await getInsights({ ...args, tags: [], explain: true });
  if (retry.length && !notes.some((n) => n.startsWith("The tag filter"))) {
    notes.push("The tag filter returned nothing, so it was dropped.");
  }
  return retry;
}

export async function findGroupPicks(session: PlanSession, args: FindPicksArgs): Promise<GroupPicksResult> {
  await ensureResolved(session);
  const kind = args.kind;
  const usesCity = kind === "place";
  const city = usesCity ? (args.city?.trim() || session.group.city || null) : null;
  const tags = (args.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 5);
  const take = Math.max(1, Math.min(10, args.take ?? 5));
  const notes: string[] = [];
  if (isMockMode()) notes.push("Running on mock data: names and scores are invented for the demo.");

  const people = session.group.people.map((p) => ({
    name: p.name,
    favourites: session.profiles.get(p.name) ?? [],
  }));
  const scorable = people.filter((p) => p.favourites.some((f) => f.entity));
  const unscored = people.filter((p) => !p.favourites.some((f) => f.entity)).map((p) => p.name);
  if (unscored.length) notes.push(`No favourites were found on Qloo for ${unscored.join(", ")}, so the ranking leaves them out.`);

  const result: GroupPicksResult = { kind, tags, picks: [], unscored, notes, ...(city ? { city } : {}) };
  if (!scorable.length) {
    session.record("find_group_picks", `${kind}${city ? ` in ${city}` : ""}`, "Nobody's favourites were found, so there is nothing to rank.");
    session.lastPicks = result;
    return result;
  }

  const idsFor = (p: (typeof scorable)[number]) => p.favourites.filter((f) => f.entity).map((f) => f.entity!.id);
  const allIds = [...new Set(scorable.flatMap(idsFor))].slice(0, 25);

  const [perPersonLists, crowdList] = await Promise.all([
    Promise.all(scorable.map((p) => insightsWithFallback({ kind, entityIds: idsFor(p), city, tags, take: PER_PERSON_TAKE }, notes))),
    insightsWithFallback({ kind, entityIds: allIds, city, tags, take: 50 }, notes).catch(() => [] as QlooEntity[]),
  ]);

  const candidatesById = new Map<string, QlooEntity>();
  const seedsById = new Map<string, Set<string>>();
  for (const list of [...perPersonLists, crowdList]) {
    for (const e of list) {
      if (!candidatesById.has(e.id)) candidatesById.set(e.id, e);
      if (e.seeds?.length) {
        const s = seedsById.get(e.id) ?? new Set<string>();
        e.seeds.forEach((x) => s.add(x));
        seedsById.set(e.id, s);
      }
    }
  }

  const perPersonScores: PersonScores[] = scorable.map((p, i) => ({
    person: p.name,
    scores: normaliseScores(perPersonLists[i].map((e) => ({ id: e.id, affinity: e.affinity }))),
  }));
  const crowdScores = normaliseScores(crowdList.map((e) => ({ id: e.id, affinity: e.affinity })));

  const ranked = groupRank(perPersonScores, [...candidatesById.values()]);
  const ignoreTags = [...OUTING_SPECS.dinner.tags, ...tags];

  result.picks = ranked.slice(0, take).map((r) => {
    const e = { ...r.candidate, seeds: [...(seedsById.get(r.candidate.id) ?? [])] };
    const perPerson = r.perPerson.map((fit) => {
      const favs = scorable.find((p) => p.name === fit.person)?.favourites ?? [];
      return explain(e, { name: fit.person, score: fit.score }, favs, ignoreTags);
    });
    const view: PickView = {
      id: e.id,
      name: e.name,
      kind,
      tags: e.tags.filter((t) => !ignoreTags.includes(t.id)).slice(0, 5).map((t) => t.name),
      groupScore: r.min,
      meanScore: r.mean,
      perPerson,
      leftOut: r.leftOut,
    };
    if (e.address) view.address = e.address;
    if (e.city) view.city = e.city;
    if (e.rating !== undefined) view.rating = e.rating;
    if (e.priceLevel !== undefined) view.priceLevel = e.priceLevel;
    if (e.image) view.image = e.image;
    const crowd = crowdScores.get(e.id);
    if (crowd !== undefined) view.crowdScore = crowd;
    return view;
  });

  if (!result.picks.length) notes.push("Qloo returned no options for this search.");

  session.record(
    "find_group_picks",
    `${kind}${city ? ` in ${city}` : ""}${tags.length ? ` tags=${tags.join(",")}` : ""}`,
    result.picks.length
      ? `${candidatesById.size} candidates; top: ${result.picks
          .slice(0, 3)
          .map((p) => `${p.name} (group fit ${Math.round(p.groupScore * 100)}%)`)
          .join(", ")}`
      : "No options found.",
  );
  session.lastPicks = result;
  return result;
}

export async function findTagsStep(session: PlanSession, keyword: string): Promise<QlooTag[]> {
  const tags = (await findTags(keyword, 10)).slice(0, 10);
  session.record("find_tags", keyword, tags.length ? tags.map((t) => `${t.name} (${t.id})`).join(", ") : "No tags found.");
  return tags;
}

/** Compact view of picks for the LLM: enough to write the plan, nothing more. */
export function picksForModel(result: GroupPicksResult, limit = result.picks.length) {
  return {
    kind: result.kind,
    city: result.city ?? null,
    unscored: result.unscored,
    notes: result.notes,
    picks: result.picks.slice(0, limit).map((p, i) => ({
      rank: i + 1,
      name: p.name,
      address: p.address ?? null,
      rating: p.rating ?? null,
      group_fit_pct: Math.round(p.groupScore * 100),
      average_fit_pct: Math.round(p.meanScore * 100),
      left_out: p.leftOut,
      per_person: p.perPerson.map((r) => ({ person: r.person, fit_pct: Math.round(r.score * 100), reason: r.text })),
    })),
  };
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** A plain-text plan built only from data, used when no LLM is available. */
export function buildDeterministicPlan(group: Group, result: GroupPicksResult): string {
  const spec = OUTING_SPECS[group.outing];
  const who = joinNames(group.people.map((p) => p.name));
  const where = result.city ? ` in ${result.city}` : "";
  const lines: string[] = [`${spec.label} plan for ${who}${where}.`];

  if (!result.picks.length) {
    lines.push("", `I could not find a ${spec.noun} that fits this group yet. Try adding a few more favourites or a different city.`);
  } else {
    lines.push("", `Here are the ${Math.min(3, result.picks.length)} best ${spec.noun} options for the whole group, fairest first:`);
    result.picks.slice(0, 3).forEach((p, i) => {
      const where = p.address ? ` at ${p.address}` : "";
      const rated = p.rating !== undefined ? ` Rated ${p.rating.toFixed(1)}.` : "";
      lines.push("", `${i + 1}. ${p.name}${where}.${rated} Group fit ${Math.round(p.groupScore * 100)}%.`);
      for (const r of p.perPerson) lines.push(`   - ${r.text}`);
      if (p.leftOut.length) {
        lines.push(`   Heads up: ${joinNames(p.leftOut)} may enjoy this one less, so it might be worth checking with them.`);
      }
    });
  }
  for (const n of result.notes) lines.push("", `Note: ${n}`);
  return lines.join("\n");
}

/** Run the whole pipeline without an LLM. */
export async function runDeterministicPlan(session: PlanSession) {
  const spec = OUTING_SPECS[session.group.outing];
  try {
    const result = await findGroupPicks(session, { kind: spec.kind, city: session.group.city, tags: spec.tags, take: 5 });
    return { plan: buildDeterministicPlan(session.group, result), result };
  } catch (err) {
    const message = errorText(err);
    session.record("find_group_picks", spec.kind, message);
    throw new QlooError(message, err instanceof QlooError ? err.status : undefined);
  }
}
