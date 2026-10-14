/**
 * Group fit ranking. Pure functions, no I/O.
 *
 * The idea: a pick is only as good as it is for the person who likes it
 * least. So we sort by the MINIMUM per-person score first ("nobody left
 * out"), and only use the MEAN to break ties between equally fair picks.
 */

export type PersonScores = {
  person: string;
  /** entityId -> affinity in 0..1 for this person */
  scores: Map<string, number>;
};

export type PersonFit = { person: string; score: number };

export type RankedCandidate<T extends { id: string }> = {
  candidate: T;
  /** one entry per person, in the order people were given */
  perPerson: PersonFit[];
  /** lowest per-person score: the primary sort key */
  min: number;
  /** average per-person score: the tie-break */
  mean: number;
  /** people whose score is below the threshold */
  leftOut: string[];
};

export type GroupRankOptions = {
  /** people scoring below this are listed in `leftOut` (default 0.35) */
  leftOutThreshold?: number;
};

export const DEFAULT_LEFT_OUT_THRESHOLD = 0.35;

const EPSILON = 1e-9;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function groupRank<T extends { id: string }>(
  perPerson: PersonScores[],
  candidates: T[],
  options: GroupRankOptions = {},
): RankedCandidate<T>[] {
  if (perPerson.length === 0 || candidates.length === 0) return [];
  const threshold = options.leftOutThreshold ?? DEFAULT_LEFT_OUT_THRESHOLD;

  // De-duplicate candidates by id, keeping the first occurrence.
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const c of candidates) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    unique.push(c);
  }

  const ranked = unique.map((candidate, index) => {
    const fits: PersonFit[] = perPerson.map((p) => ({
      person: p.person,
      score: clamp01(p.scores.get(candidate.id) ?? 0),
    }));
    const values = fits.map((f) => f.score);
    const min = Math.min(...values);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const leftOut = fits.filter((f) => f.score < threshold).map((f) => f.person);
    return { candidate, perPerson: fits, min, mean, leftOut, index };
  });

  ranked.sort((a, b) => {
    if (Math.abs(b.min - a.min) > EPSILON) return b.min - a.min;
    if (Math.abs(b.mean - a.mean) > EPSILON) return b.mean - a.mean;
    return a.index - b.index; // stable: keep input order on a full tie
  });

  return ranked.map(({ index: _index, ...rest }) => rest);
}

/**
 * Turn one person's raw insight list into 0..1 scores.
 *
 * Being on someone's list at all is a positive signal, so scores are
 * scaled into [floor, 1] rather than [0, 1]; a candidate that is missing
 * from their list scores 0 in `groupRank`.
 *
 * If the list has usable affinity values with some spread, we min-max
 * scale them. Otherwise we fall back to list position (first = 1).
 */
export function normaliseScores(
  items: Array<{ id: string; affinity?: number | null }>,
  floor = 0.1,
): Map<string, number> {
  const out = new Map<string, number>();
  const list: Array<{ id: string; affinity?: number | null }> = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    list.push(item);
  }
  if (list.length === 0) return out;
  if (list.length === 1) {
    out.set(list[0].id, 1);
    return out;
  }

  const affinities = list.map((i) =>
    typeof i.affinity === "number" && Number.isFinite(i.affinity) ? i.affinity : null,
  );
  const allHave = affinities.every((a) => a !== null);
  const nums = affinities.filter((a): a is number => a !== null);
  const max = nums.length ? Math.max(...nums) : 0;
  const min = nums.length ? Math.min(...nums) : 0;

  if (allHave && max - min > EPSILON) {
    list.forEach((item, i) => {
      const t = ((affinities[i] as number) - min) / (max - min);
      out.set(item.id, floor + (1 - floor) * t);
    });
    return out;
  }

  const n = list.length;
  list.forEach((item, i) => {
    out.set(item.id, floor + (1 - floor) * (1 - i / (n - 1)));
  });
  return out;
}

export function fitBand(score: number): "strong" | "good" | "fair" | "stretch" {
  if (score >= 0.75) return "strong";
  if (score >= 0.5) return "good";
  if (score >= DEFAULT_LEFT_OUT_THRESHOLD) return "fair";
  return "stretch";
}
