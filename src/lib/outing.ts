/** Outing kinds the UI offers, and how each maps to a Qloo entity type. */

export const ENTITY_TYPES = [
  "artist",
  "book",
  "brand",
  "destination",
  "movie",
  "person",
  "place",
  "podcast",
  "tv_show",
  "video_game",
] as const;

export type EntityKind = (typeof ENTITY_TYPES)[number];

export function toUrn(kind: EntityKind): string {
  return `urn:entity:${kind}`;
}

export function fromUrn(urn: string): EntityKind | null {
  const short = urn.replace(/^urn:entity:/, "");
  return (ENTITY_TYPES as readonly string[]).includes(short) ? (short as EntityKind) : null;
}

/** Favourite kinds a person can tag a chip with (subset that makes sense as input). */
export const FAVOURITE_KINDS = [
  "movie",
  "artist",
  "place",
  "book",
  "tv_show",
  "destination",
  "podcast",
  "video_game",
] as const satisfies readonly EntityKind[];

export type FavouriteKind = (typeof FAVOURITE_KINDS)[number];

export const FAVOURITE_KIND_LABELS: Record<FavouriteKind, string> = {
  movie: "Film",
  artist: "Artist",
  place: "Restaurant / place",
  book: "Book",
  tv_show: "TV show",
  destination: "Destination",
  podcast: "Podcast",
  video_game: "Game",
};

export const OUTINGS = ["dinner", "movie", "music", "book", "trip"] as const;
export type Outing = (typeof OUTINGS)[number];

export type OutingSpec = {
  label: string;
  /** what the group gets back, e.g. "restaurant" */
  noun: string;
  kind: EntityKind;
  /** default tag filters for this outing (real Qloo tag ids) */
  tags: string[];
  /** whether a city makes sense for this outing */
  usesCity: boolean;
};

export const OUTING_SPECS: Record<Outing, OutingSpec> = {
  dinner: {
    label: "Dinner",
    noun: "restaurant",
    kind: "place",
    tags: ["urn:tag:genre:place:restaurant"],
    usesCity: true,
  },
  movie: { label: "Movie night", noun: "film", kind: "movie", tags: [], usesCity: false },
  music: { label: "Music", noun: "artist", kind: "artist", tags: [], usesCity: false },
  book: { label: "Book club", noun: "book", kind: "book", tags: [], usesCity: false },
  trip: { label: "Trip", noun: "destination", kind: "destination", tags: [], usesCity: false },
};
