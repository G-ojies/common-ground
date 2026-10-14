/** Parsing and validation for the group a user submits. Pure, no I/O. */
import { FAVOURITE_KINDS, OUTINGS, type FavouriteKind, type Outing } from "./outing";

export const LIMITS = {
  minPeople: 2,
  maxPeople: 8,
  minFavourites: 1,
  maxFavourites: 6,
  nameMax: 40,
  favouriteMax: 80,
  cityMax: 60,
  vibeMax: 200,
} as const;

export type Favourite = { name: string; kind?: FavouriteKind };
export type Person = { name: string; favourites: Favourite[] };
export type Group = {
  people: Person[];
  outing: Outing;
  city?: string;
  vibe?: string;
};

export type ParseResult = { ok: true; group: Group } | { ok: false; errors: string[] };

/** Trim, drop control characters and collapse runs of whitespace. */
export function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseGroup(input: unknown): ParseResult {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ["The request must be a JSON object."] };

  const outingRaw = cleanText(input.outing).toLowerCase();
  const outing = (OUTINGS as readonly string[]).includes(outingRaw)
    ? (outingRaw as Outing)
    : null;
  if (!outing) errors.push(`Pick an outing type: ${OUTINGS.join(", ")}.`);

  const city = cleanText(input.city);
  if (city.length > LIMITS.cityMax) errors.push(`City must be at most ${LIMITS.cityMax} characters.`);

  const vibe = cleanText(input.vibe);
  if (vibe.length > LIMITS.vibeMax) errors.push(`Vibe must be at most ${LIMITS.vibeMax} characters.`);

  const peopleRaw = Array.isArray(input.people) ? input.people : null;
  const people: Person[] = [];
  if (!peopleRaw) {
    errors.push("Add the people in your group.");
  } else {
    if (peopleRaw.length < LIMITS.minPeople || peopleRaw.length > LIMITS.maxPeople) {
      errors.push(`A group needs ${LIMITS.minPeople} to ${LIMITS.maxPeople} people.`);
    }
    const seenNames = new Set<string>();
    peopleRaw.slice(0, LIMITS.maxPeople).forEach((raw, i) => {
      const label = `Person ${i + 1}`;
      if (!isRecord(raw)) {
        errors.push(`${label} is not valid.`);
        return;
      }
      const name = cleanText(raw.name);
      if (!name) errors.push(`${label} needs a name.`);
      else if (name.length > LIMITS.nameMax)
        errors.push(`${label}'s name must be at most ${LIMITS.nameMax} characters.`);
      const key = name.toLowerCase();
      if (name && seenNames.has(key)) errors.push(`Two people are called "${name}". Give them different names.`);
      seenNames.add(key);

      const who = name || label;
      const favsRaw = Array.isArray(raw.favourites) ? raw.favourites : [];
      const favourites: Favourite[] = [];
      const seenFavs = new Set<string>();
      for (const f of favsRaw) {
        const fName = cleanText(isRecord(f) ? f.name : f);
        if (!fName) continue; // empty chips are ignored
        if (fName.length > LIMITS.favouriteMax) {
          errors.push(`"${fName.slice(0, 20)}..." is too long (max ${LIMITS.favouriteMax} characters).`);
          continue;
        }
        const fKey = fName.toLowerCase();
        if (seenFavs.has(fKey)) continue;
        seenFavs.add(fKey);
        const kindRaw = isRecord(f) ? cleanText(f.kind).toLowerCase() : "";
        const kind = (FAVOURITE_KINDS as readonly string[]).includes(kindRaw)
          ? (kindRaw as FavouriteKind)
          : undefined;
        favourites.push(kind ? { name: fName, kind } : { name: fName });
      }
      if (favourites.length < LIMITS.minFavourites)
        errors.push(`${who} needs at least ${LIMITS.minFavourites} favourite.`);
      if (favourites.length > LIMITS.maxFavourites)
        errors.push(`${who} can have at most ${LIMITS.maxFavourites} favourites.`);
      people.push({ name, favourites });
    });
  }

  if (errors.length || !outing) return { ok: false, errors };
  const group: Group = { people, outing };
  if (city) group.city = city;
  if (vibe) group.vibe = vibe;
  return { ok: true, group };
}
