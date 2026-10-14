"use client";

import type { PickView, Step } from "@/lib/planner";

export type PlanResponse = {
  plan: string;
  picks: PickView[];
  unscored: string[];
  notes: string[];
  steps: Step[];
  mode: { qloo: "mock" | "live"; llm: "groq" | "none" };
};

const BAND_COLOUR: Record<string, string> = {
  strong: "bg-emerald-500",
  good: "bg-lime-500",
  fair: "bg-amber-400",
  stretch: "bg-rose-400",
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

function priceLabel(level?: number) {
  if (level === undefined || level < 1) return null;
  return `Price level ${Math.min(4, Math.round(level))} of 4`;
}

function PickCard({ pick, rank }: { pick: PickView; rank: number }) {
  const price = priceLabel(pick.priceLevel);
  return (
    <article className="card overflow-hidden">
      <div className="flex gap-4 p-4 sm:p-5">
        {pick.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pick.image} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <div
            aria-hidden
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-2xl font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
          >
            {rank}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h3 className="text-base font-semibold leading-snug">
              <span className="sr-only">Pick {rank}: </span>
              {pick.name}
            </h3>
            <span className="text-sm font-semibold text-brand-700 dark:text-brand-300">Group fit {pct(pick.groupScore)}</span>
          </div>
          {(pick.address || pick.rating !== undefined || price) && (
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
              {[pick.address, pick.rating !== undefined ? `★ ${pick.rating.toFixed(1)}` : null, price].filter(Boolean).join(" · ")}
            </p>
          )}
          {pick.tags.length > 0 && (
            <p className="mt-1 text-xs text-stone-500">{pick.tags.join(" · ")}</p>
          )}
        </div>
      </div>

      <ul className="space-y-3 border-t border-stone-100 px-4 py-4 sm:px-5 dark:border-stone-800">
        {pick.perPerson.map((r) => (
          <li key={r.person}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{r.person}</span>
              <span className="tabular-nums text-stone-500">{pct(r.score)}</span>
            </div>
            <div
              className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800"
              role="meter"
              aria-label={`${r.person}'s fit`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(r.score * 100)}
            >
              <div className={`h-full rounded-full ${BAND_COLOUR[r.band] ?? "bg-stone-400"}`} style={{ width: pct(Math.max(r.score, 0.02)) }} />
            </div>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">{r.text}</p>
          </li>
        ))}
      </ul>

      {pick.leftOut.length > 0 && (
        <p className="border-t border-amber-100 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 sm:px-5 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          Might suit {pick.leftOut.join(" and ")} less. Worth a quick check with them.
        </p>
      )}
    </article>
  );
}

export function Results({ data }: { data: PlanResponse }) {
  return (
    <section aria-labelledby="plan-heading" className="space-y-5">
      <div className="card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="plan-heading" className="text-lg font-semibold">
            Your plan
          </h2>
          <span className="text-xs text-stone-500">
            {data.mode.llm === "groq" ? "Written by the agent" : "Built straight from the data"}
            {data.mode.qloo === "mock" ? " · mock data" : ""}
          </span>
        </div>
        <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-stone-800 dark:text-stone-200">{data.plan}</p>
      </div>

      {data.picks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Ranked by group fit</h2>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Group fit is the score of whoever likes a pick least, so a pick only ranks high if nobody is left out.
          </p>
          {data.picks.map((p, i) => (
            <PickCard key={p.id} pick={p} rank={i + 1} />
          ))}
        </div>
      )}

      {data.notes.length > 0 && (
        <ul className="space-y-1 text-sm text-stone-600 dark:text-stone-400">
          {[...new Set(data.notes)].map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      {data.steps.length > 0 && (
        <details className="card group p-4 sm:p-5">
          <summary className="cursor-pointer select-none text-sm font-semibold">
            How the agent got here ({data.steps.length} steps)
          </summary>
          <ol className="mt-3 space-y-3">
            {data.steps.map((s, i) => (
              <li key={i} className="text-sm">
                <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs dark:bg-stone-800">{s.tool}</code>
                <span className="ml-2 text-stone-600 dark:text-stone-400">{s.input}</span>
                <p className="mt-1 break-words text-xs text-stone-500">{s.output}</p>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
