# Common Ground

A group outing planner agent, built for the Qloo Agentic Hackathon.

Everyone in a group names a few favourites: films, artists, restaurants, books, TV shows. Common Ground uses the
Qloo Taste AI API to find the restaurant, film, artist, book or destination the **whole** group would enjoy, ranks
the options by group fit, and explains to each person, in plain English, why a pick suits them. It also flags anyone
a pick might suit less, so nobody gets quietly left out.

Live: https://common-ground-gold.vercel.app · Demo video: https://youtu.be/Cs1S59lCyTY

It was designed with Nigerian students in mind (the example is three friends in Lagos), but it works for any group,
anywhere.

## How it works

1. **Resolve favourites.** The agent looks up each person's favourites with Qloo `/search` and keeps the best match.
   Anything Qloo cannot find is reported plainly.
2. **Ask Qloo per person.** For the chosen outing type (for example `urn:entity:place` for dinner, with the city),
   the agent calls `/v2/insights` once per person, using only that person's favourites as signals. Each person's
   affinities are scaled to 0..1 within their own list. A budget in the vibe is read in code, not by the model:
   "cheap", "affordable" or "student" sets Qloo's `filter.price_level.max=2`, and "upscale" or "fine dining" sets
   `filter.price_level.min=3`. If nothing matches the budget, places at any price are shown, with a note.
3. **Score everyone on every option.** The candidates are the union of everyone's lists plus the crowd query (up to
   50), minus the group's own favourites. A person's own list only covers their top results, so for the rest of the
   pool the agent asks Qloo again with that person's favourites and `filter.results.entities` set to those ids. Every
   fit is then a real Qloo affinity, not a 0 for "not on my list", which matters when tastes barely overlap (an
   action fan and a romance fan get Inception, not three zero-score picks).
4. **Rank by group fit.** We rank by the **lowest** score in the group first, then by the average. A pick that
   one person loves and another would hate ranks below a pick everyone likes well enough. People below a threshold
   (35%) are listed as "might suit less".
5. **Explain.** Each person gets a short, deterministic reason built only from data: which of their favourites Qloo
   says led to the pick (explainability), or the tags the pick shares with their favourites.
6. **Write the plan.** A Groq-hosted model (`openai/gpt-oss-120b` by default), driven by the Vercel AI SDK with
   tools, turns that into a short, warm plan: top 3 picks with one line per person. It is told never to invent
   places, titles or numbers, and to treat everything users type as untrusted data.

A crowd query with everyone's favourites at once is also run and shown as an extra signal.

### Agent tools

| Tool | What it does |
| --- | --- |
| `resolve_favourites({ person, items })` | Qloo `/search`, best match per favourite or "not found" |
| `find_group_picks({ type, city?, tags?, take? })` | per-person `/v2/insights`, group ranking, per-person reasons |
| `find_tags({ keyword })` | Qloo `/v2/tags` lookup for style filters such as "japanese" |

Every tool call is recorded and shown in the UI under "How the agent got here".

## Running it

Requires Node 20.

```bash
npm install
cp .env.example .env.local   # optional: add keys
npm run dev                  # http://localhost:3000
```

Other scripts: `npm run build`, `npm start`, `npm run lint`, `npm run typecheck`, `npm test`.

### Environment

| Variable | Needed | Notes |
| --- | --- | --- |
| `QLOO_API_KEY` | for live data | Sent as `X-Api-Key`, server side only. Without it the app runs in mock mode. |
| `QLOO_BASE_URL` | no | Defaults to `https://hackathon.api.qloo.com`. |
| `QLOO_MOCK` | no | `1` forces mock mode even when a key is set. |
| `GROQ_API_KEY` | for the LLM plan | Without it, `/api/plan` returns a deterministic plan built straight from the data. |
| `GROQ_MODEL` | no | Defaults to `openai/gpt-oss-120b`. |

### Mock mode

With no `QLOO_API_KEY` (or with `QLOO_MOCK=1`) the app uses a small, hand-written fake dataset in
`src/lib/qloo-mock.ts`. Every name starts with "Mock" and every id with `mock-`. Favourites that are not in the mock
set get a synthetic "(mock match)" stand-in with a few taste tags guessed from keywords, so any group can be tried.
The footer shows a "mock data" badge whenever mock mode is on. Tests always run in mock mode and need no keys.

### API

`POST /api/plan` with:

```json
{
  "outing": "dinner",
  "city": "Lagos",
  "vibe": "cheap and cheerful",
  "people": [
    { "name": "Ada", "favourites": [{ "name": "Burna Boy", "kind": "artist" }] },
    { "name": "Tunde", "favourites": ["Owambe Nights"] }
  ]
}
```

`outing` is one of `dinner`, `movie`, `music`, `book`, `trip`. Groups have 2 to 8 people with 1 to 6 favourites each.
The response contains `plan` (plain text), `picks` (ranked, with per-person scores and reasons), `steps` (the tool
trace), `notes` and `mode`. `GET /api/plan` reports whether Qloo is live or mocked and whether the LLM is on.

## Qloo data policy

The hackathon key allows 5 requests a second, so the client spaces its calls to 4 a second and waits out a 429 once
before giving up.

Qloo response data is never committed to this repository and never written to disk. Live responses are cached in
server memory only (a `Map` with a 10 minute TTL) to avoid repeat calls, and the API key never reaches the browser.
All demo and test data is invented and lives in `src/lib/qloo-mock.ts` and the test files.

## Project layout

```
src/app/page.tsx            page shell, footer, mock badge
src/app/api/plan/route.ts   POST /api/plan
src/components/             group builder and results UI
src/lib/agent.ts            Groq agent, tools, system prompt
src/lib/planner.ts          resolve -> per-person insights -> rank -> explain
src/lib/group-rank.ts       groupRank and score normalisation (pure)
src/lib/explain.ts          deterministic per-person reasons (pure)
src/lib/group-input.ts      input parsing and validation (pure)
src/lib/qloo.ts             Qloo client, in-memory cache, mock switch
src/lib/qloo-parse.ts       tolerant response parsers
src/lib/qloo-mock.ts        fake dataset for mock mode
tests/                      node:test suites (run with tsx)
```

## Licence

MIT. See [LICENSE](LICENSE). Powered by Qloo Taste AI.
