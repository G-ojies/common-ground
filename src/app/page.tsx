import { Planner } from "@/components/Planner";
import { isMockMode } from "@/lib/qloo";

export const dynamic = "force-dynamic";

export default function Home() {
  const mock = isMockMode();
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pb-10 pt-8 sm:pt-12">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Common Ground</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Plan something the whole group will enjoy.</h1>
        <p className="mt-3 max-w-xl text-stone-600 dark:text-stone-400">
          Everyone names a few favourites. Common Ground finds the dinner spot, film, artist, book or trip that fits all of you,
          and tells each person why.
        </p>
      </header>

      <Planner />

      <footer className="mt-auto flex flex-wrap items-center gap-3 pt-12 text-xs text-stone-500 dark:text-stone-400">
        <span>Powered by Qloo Taste AI</span>
        {mock && (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
            mock data
          </span>
        )}
      </footer>
    </main>
  );
}
