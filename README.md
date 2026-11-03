# CF Analyzer

A private Codeforces practice assistant. Review a recent submission sample, see tags on unresolved failed problems, and get up to five suggestions from the real Codeforces problem catalog.

The interface uses a quiet, responsive layout with readable result states. It does not promise a rating increase or diagnose a programmer’s ability.

## Run locally

Use **Node.js 24** (the usage database uses `node:sqlite`).

```sh
npm ci
cp .env.example .env.local
# Fill in the keys and an available Gemini model ID.
npm run dev -- --hostname 127.0.0.1
```

Generate a separate owner access key with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set `ANALYZE_API_KEY` to that value, `GEMINI_API_KEY` to your Google key, and `GEMINI_MODEL` to a model available to your account. Enter only the **owner access key** in the browser, never the Google key. The app stores that input only in page memory, not local storage, cookies or a URL. All configuration stays server-side.

Missing or invalid configuration disables analysis with HTTP 503. The page can still be viewed. No real Gemini requests run in tests.

## What the analysis means

1. Fetch the handle’s rating and latest **up to 100 submissions**, spacing Codeforces requests by at least 2.1 seconds within an analysis.
2. Count each distinct failed problem once for WA, TLE, MLE and runtime errors. Remove problems with an accepted submission anywhere in this sample. Compilation errors and pending verdicts are ignored.
3. Choose up to 40 verified catalog candidates matching the top five unresolved tags, with ratings 100–300 above the user’s rating (minimum 800–1100). Unrated users use 800–1100.
4. When both tags and candidates exist, Gemini writes a short note and selects up to five **candidate IDs**. Reject unknown/duplicate IDs or malformed responses. Names, ratings and HTTPS links are constructed from the checked Codeforces catalog, never model output.
5. Without an unresolved tag pattern, show a limited sample overview and general candidates without calling Gemini. Without matching candidates, show an empty result without a paid call.

Repeated failures can reflect many things besides ability. Accepted submissions older than the sample are unknown, so a previously solved problem may be recommended again. A problem can carry multiple tags. AI notes are suggestions, not verified facts.

## Access, spending and deployment

- `POST /api/analyze` requires `Authorization: Bearer <ANALYZE_API_KEY>` and JSON `{"handle":"..."}`. The old public GET interface is retired. Requests without a valid key never reach providers.
- `ANALYZE_DAILY_LIMIT` defaults to **10 attempts per UTC day**, configurable from 1 to 100. One new attempt per **90 seconds** is allowed across all workers sharing the database. Every authenticated, valid attempt counts, including provider failures, cancellations and results that skip AI. Restarting does not reset the budget.
- `ANALYZE_DB_PATH` is required. Put it on persistent writable storage on a **single host**. SQLite transactions serialize reservations across processes. Do not use ephemeral serverless instances or separate replicas with independent database copies; they cannot share this limit. An unavailable database fails closed.
- Request JSON is limited to 1 KiB and a 10-second body-read deadline. Provider bodies are bounded. Codeforces requests have 15-second deadlines, Gemini 40 seconds with no retry, and the overall analysis has an 80-second deadline. Aborting a request cannot reverse a charge already incurred by a provider.
- Use HTTPS and a reverse proxy with request/body/concurrency limits when exposing the app. Disable authorization-header logging. Keep the access key private; this is an owner-controlled preview, not public multi-user authentication. Apply a separate provider-side spending cap as well.
- The Gemini prompt includes the public handle, rating, sample size, aggregated tags and candidate problems. It does not send submission source code. See Google’s applicable API data terms before sharing access.
- Preserve the usage database across redeploys. Deleting it resets limits. Do not publish `.env.local` or `data/`.

Production build and loopback server:

```sh
npm run build
npm start -- --hostname 127.0.0.1
```

## Verification

```sh
npm test
npm run lint
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

CI runs these checks on Windows and Linux. Regression tests cover authentication before spending, provider failures, strict recommendations, sample counting, response limits, persistent daily quotas, UTC rollover, and six independent processes competing for one reservation. All provider responses are fixtures; paid model quality and live Codeforces availability are not asserted by CI.

The lint setup uses ESLint 10, TypeScript rules, React Hooks rules and the Next.js plugin directly. `minimatch` is pinned through an override to its patched API-compatible version for these consumers; legacy plugins relying on its older callable export are not installed. The lockfile is committed. Dependency checks describe the scan at that time and must continue to run as advisories change.
