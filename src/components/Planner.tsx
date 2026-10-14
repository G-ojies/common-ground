"use client";

import { useRef, useState } from "react";
import { EXAMPLE_GROUP } from "@/lib/example";
import { LIMITS } from "@/lib/group-input";
import { FAVOURITE_KIND_LABELS, FAVOURITE_KINDS, OUTING_SPECS, OUTINGS, type FavouriteKind, type Outing } from "@/lib/outing";
import { Results, type PlanResponse } from "./Results";

type Fav = { name: string; kind?: FavouriteKind };
type PersonDraft = { key: number; name: string; favourites: Fav[]; draft: string; draftKind: FavouriteKind | "" };

let nextKey = 1;
const blankPerson = (): PersonDraft => ({ key: nextKey++, name: "", favourites: [], draft: "", draftKind: "" });

const OUTING_HINTS: Record<Outing, string> = {
  dinner: "A restaurant everyone likes",
  movie: "A film for movie night",
  music: "An artist to see or play",
  book: "A book for the club",
  trip: "A place to travel to",
};

export function Planner() {
  const [people, setPeople] = useState<PersonDraft[]>(() => [blankPerson(), blankPerson()]);
  const [outing, setOuting] = useState<Outing>("dinner");
  const [city, setCity] = useState("");
  const [vibe, setVibe] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanResponse | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const update = (key: number, patch: Partial<PersonDraft>) =>
    setPeople((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const addFavourite = (p: PersonDraft) => {
    const name = p.draft.trim();
    if (!name || p.favourites.length >= LIMITS.maxFavourites) return;
    if (p.favourites.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      update(p.key, { draft: "" });
      return;
    }
    const fav: Fav = p.draftKind ? { name, kind: p.draftKind } : { name };
    update(p.key, { favourites: [...p.favourites, fav], draft: "" });
  };

  const loadExample = () => {
    setOuting(EXAMPLE_GROUP.outing);
    setCity(EXAMPLE_GROUP.city);
    setVibe(EXAMPLE_GROUP.vibe);
    setPeople(
      EXAMPLE_GROUP.people.map((p) => ({
        key: nextKey++,
        name: p.name,
        favourites: p.favourites.map((f) => ({ ...f })),
        draft: "",
        draftKind: "",
      })),
    );
    setError(null);
    setResult(null);
  };

  const plan = async () => {
    setError(null);
    // Include any half-typed favourite so nobody loses it.
    const group = {
      outing,
      city,
      vibe,
      people: people.map((p) => ({
        name: p.name,
        favourites: [
          ...p.favourites,
          ...(p.draft.trim() && p.favourites.length < LIMITS.maxFavourites
            ? [p.draftKind ? { name: p.draft.trim(), kind: p.draftKind } : { name: p.draft.trim() }]
            : []),
        ],
      })),
    };
    setLoading(true);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(group),
      });
      const data = (await res.json()) as PlanResponse & { error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setResult(null);
      } else {
        setResult(data);
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      }
    } catch {
      setError("Could not reach the planner. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const spec = OUTING_SPECS[outing];

  return (
    <div className="space-y-6">
      <section className="card p-4 sm:p-6" aria-labelledby="outing-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="outing-heading" className="text-lg font-semibold">
            What are you planning?
          </h2>
          <button type="button" className="btn-ghost" onClick={loadExample}>
            Try an example
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Outing type">
          {OUTINGS.map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={outing === o}
              onClick={() => setOuting(o)}
              className={`rounded-xl border px-3 py-2.5 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                outing === o
                  ? "border-brand-500 bg-brand-50 font-semibold text-brand-900 dark:border-brand-400 dark:bg-brand-900/30 dark:text-brand-100"
                  : "border-stone-200 hover:border-stone-300 dark:border-stone-700 dark:hover:border-stone-600"
              }`}
            >
              {OUTING_SPECS[o].label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">{OUTING_HINTS[outing]}.</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              City {spec.usesCity ? "" : <span className="font-normal text-stone-500">(only used for dinner)</span>}
            </span>
            <input
              className="field"
              value={city}
              maxLength={LIMITS.cityMax}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Lagos, Abuja, Benin City..."
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              Vibe <span className="font-normal text-stone-500">(optional)</span>
            </span>
            <input
              className="field"
              value={vibe}
              maxLength={LIMITS.vibeMax}
              onChange={(e) => setVibe(e.target.value)}
              placeholder="Cheap and cheerful, quiet, spicy..."
            />
          </label>
        </div>
      </section>

      <section aria-labelledby="group-heading" className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 id="group-heading" className="text-lg font-semibold">
            Who&apos;s coming?
          </h2>
          <span className="text-xs text-stone-500">
            {people.length} of {LIMITS.maxPeople} people
          </span>
        </div>

        {people.map((p, i) => (
          <div key={p.key} className="card p-4">
            <div className="flex items-center gap-2">
              <input
                className="field font-medium"
                value={p.name}
                maxLength={LIMITS.nameMax}
                onChange={(e) => update(p.key, { name: e.target.value })}
                placeholder={`Person ${i + 1}'s name`}
                aria-label={`Person ${i + 1} name`}
              />
              {people.length > LIMITS.minPeople && (
                <button
                  type="button"
                  className="btn-ghost shrink-0"
                  onClick={() => setPeople((ps) => ps.filter((x) => x.key !== p.key))}
                  aria-label={`Remove ${p.name || `person ${i + 1}`}`}
                >
                  Remove
                </button>
              )}
            </div>

            {p.favourites.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2" aria-label={`${p.name || `Person ${i + 1}`}'s favourites`}>
                {p.favourites.map((f) => (
                  <li
                    key={f.name}
                    className="inline-flex items-center gap-1 rounded-full bg-stone-100 py-1 pl-3 pr-1 text-sm dark:bg-stone-800"
                  >
                    <span>{f.name}</span>
                    {f.kind && <span className="text-xs text-stone-500">· {FAVOURITE_KIND_LABELS[f.kind]}</span>}
                    <button
                      type="button"
                      className="ml-1 rounded-full px-1.5 text-stone-500 hover:bg-stone-200 hover:text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-stone-700 dark:hover:text-white"
                      onClick={() => update(p.key, { favourites: p.favourites.filter((x) => x.name !== f.name) })}
                      aria-label={`Remove ${f.name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {p.favourites.length < LIMITS.maxFavourites ? (
              <form
                className="mt-3 flex flex-col gap-2 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  addFavourite(p);
                }}
              >
                <input
                  className="field"
                  value={p.draft}
                  maxLength={LIMITS.favouriteMax}
                  onChange={(e) => update(p.key, { draft: e.target.value })}
                  placeholder="A favourite film, artist, restaurant, book..."
                  aria-label="Add a favourite"
                />
                <div className="flex gap-2">
                  <select
                    className="field sm:w-40"
                    value={p.draftKind}
                    onChange={(e) => update(p.key, { draftKind: e.target.value as FavouriteKind | "" })}
                    aria-label="Kind of favourite"
                  >
                    <option value="">Any kind</option>
                    {FAVOURITE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {FAVOURITE_KIND_LABELS[k]}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="btn-ghost shrink-0 border border-stone-200 dark:border-stone-700">
                    Add
                  </button>
                </div>
              </form>
            ) : (
              <p className="mt-3 text-xs text-stone-500">That&apos;s {LIMITS.maxFavourites} favourites, the most we use.</p>
            )}
          </div>
        ))}

        {people.length < LIMITS.maxPeople && (
          <button
            type="button"
            className="btn-ghost w-full border border-dashed border-stone-300 py-3 dark:border-stone-700"
            onClick={() => setPeople((ps) => [...ps, blankPerson()])}
          >
            + Add a person
          </button>
        )}
      </section>

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <button type="button" className="btn-primary sm:w-auto" onClick={plan} disabled={loading}>
          {loading ? "Finding common ground..." : "Plan it"}
        </button>
        {loading && (
          <span className="text-sm text-stone-500" aria-live="polite">
            Checking everyone&apos;s taste with Qloo. This can take a few seconds.
          </span>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </div>
      )}

      <div ref={resultsRef} className="scroll-mt-6">
        {result && <Results data={result} />}
      </div>
    </div>
  );
}
