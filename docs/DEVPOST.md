# Devpost submission: Common Ground

**Tagline:** An agent that finds the plan your whole group will enjoy, and tells each person why.

## Inspiration

Planning a night out is easy until everyone likes different things. In a group chat the loudest person picks, or the group settles on the place nobody minds and nobody loves. A plain LLM makes this worse in a quiet way: ask it for "a restaurant three friends will like" and it gives you a confident, generic answer that has nothing to do with what those three people actually like.

We wanted an agent that knows each person's taste, finds the overlap, and is honest when someone might be left out. That needs real cultural taste data, which is what Qloo has.

## What it does

Everyone in the group names a few favourites: artists, films, books, TV shows, places. You pick what you are planning (dinner, movie night, music, book club or a trip), and optionally a city and a vibe such as "affordable, somewhere we can talk after exams".

Common Ground then:

- **Finds each favourite on Qloo**, and says plainly when one cannot be found.
- **Asks Qloo what each person would like**, one person at a time, using only that person's favourites as signals.
- **Scores every person on every option.** A person's own list only covers their top results, so for the rest of the shared pool the agent asks Qloo again with that person's favourites and `filter.results.entities` pinned to those options. Every fit is a real Qloo affinity, never a 0 that just means "not on my list".
- **Ranks by group fit**, which is the score of whoever likes a pick least. A place only ranks high if nobody is left out, and anyone below 35% is flagged ("might suit Tunde less, worth a quick check").
- **Explains each pick per person**, with reasons built from Qloo data: which of their favourites Qloo says led to the pick (explainability), or the taste tags it shares with them.
- **Writes a short, warm plan** for the top three picks, with one line per person.
- **Shows its work.** Every tool call is listed under "How the agent got here".

Example: three friends in Lagos who love Burna Boy, Wizkid, Tems, Things Fall Apart and Half of a Yellow Sun get affordable Lagos restaurants, with Burg.Co at 91% group fit. For movie night, an action fan, a romance fan and a Nollywood thriller fan share almost nothing, yet they get Léon: The Professional, with all three between 59% and 68%. Before we scored everyone on every option, that same group got three picks that each suited only one person.

## What makes it Qloo-powered

Without Qloo there is nothing to rank. The ranking, the per-person scores, the "might suit less" flags and the reasons all come from Qloo data:

- `/search` resolves free-text favourites to Qloo entities across artists, films, books, TV, places and destinations.
- `/v2/insights` runs per person with `signal.interests.entities`, plus `filter.location.query` for dinner and `filter.price_level.min/max` for budget.
- `filter.results.entities` scores each person on the whole shared pool.
- `feature.explainability` tells us which favourites led to each result, so a reason is a fact rather than a guess.
- A crowd query with everyone's favourites at once adds extra candidates.
- `/v2/tags` lets the agent turn "japanese" or "jazz" into a tag filter.

The language model never chooses or scores places. It calls the tools, then writes the plan from the ranked data, and it is told never to invent places, titles or numbers.

## How we built it

- **App:** Next.js 14 and TypeScript, deployed on Vercel.
- **Agent:** Vercel AI SDK with tool calling, running `openai/gpt-oss-120b` on Groq. Its tools are `resolve_group`, `find_group_picks` and `find_tags`. Everything users type is wrapped as untrusted data in the prompt.
- **Planner:** a deterministic pipeline in plain functions. It resolves favourites, gets per-person insights, builds a shared pool without the group's own favourites, fills in scores with pinned insights, runs a min-first group ranking, then builds the reasons. If the model is unavailable, the same pipeline writes a plain plan, so the app always answers.
- **Budget in code:** "cheap", "affordable" or "student" in the vibe sets `filter.price_level.max=2`. "Upscale" or "fine dining" sets the minimum to 3. If nothing matches, it falls back to any price with a note. A model never decides that "affordable" means a casino.
- **Qloo client:** server-side only, so the key never reaches the browser. It keeps an in-memory cache with a 10-minute TTL and never writes Qloo data to disk. Calls are spaced to stay under the key's 5 requests a second, a 429 is waited out once, and a dropped request is retried before an item is reported as not found.
- **Tests:** 57 tests run on an invented mock dataset, so they need no keys. They cover the group ranking, score normalisation, the reasons, input validation, the response parsers, the agent tools and the planner, including "never suggest a favourite back" and "everyone is scored on every pick".

## Challenges we ran into

- **Groups whose tastes do not overlap.** Our first version ranked the union of everyone's top lists. When tastes differed, every candidate was missing from somebody's list and scored 0, so the "fair" ranking had nothing to work with. Pinning each person's insights to the shared pool with `filter.results.entities` fixed it.
- **Suggesting your own favourite back.** Qloo can return a signal entity among the results. A group that names Pride and Prejudice does not need to be told to watch it, so favourites are now removed from the pool.
- **Rate limits on two sides.** The Qloo key allows 5 requests a second, and a plan makes about 15 calls. Groq's free tier allows 8,000 tokens a minute. We paced the Qloo calls, cut the model's tool output down to what it needs, and kept the deterministic plan as a fallback.
- **Free-text favourites.** "Pride and Prejudice" is a book, two films and a TV series. Users can say what kind each favourite is, and the trace shows exactly what each one matched.

## Accomplishments that we're proud of

The ranking is fair by construction. A pick one friend loves and another would hate cannot beat a pick everyone likes well enough, and when somebody might be left out, the app says so by name.

## What we learned

"Group fit" is a better question than "best match". Asking Qloo about each person separately and then taking the minimum gave far better plans than one combined query, and it made the explanations honest.

## What's next for Common Ground

- Share a link to the group, so each friend adds their own favourites from their phone.
- Book or buy straight from a pick.
- Remember a group's past outings, so the next plan adds variety.

## Built with

qloo, next.js, typescript, vercel-ai-sdk, groq, gpt-oss-120b, tailwindcss, vercel, node.js

## Links

- Live demo: https://common-ground-gold.vercel.app
- Code (MIT): https://github.com/G-ojies/common-ground
- Video: https://youtu.be/Cs1S59lCyTY
