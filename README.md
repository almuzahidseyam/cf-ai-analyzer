# Codeforces AI Analyzer ??

An AI-powered assistant for Competitive Programmers. 
It analyzes your recent failed submissions (WA/TLE) on Codeforces to identify your weak topics and uses Google's Gemini AI to recommend highly personalized practice problems tailored to your exact rating and weaknesses.

## How it works
1. **Fetch:** Pulls your last 100 submissions via the official Codeforces API.
2. **Analyze:** Filters out failed submissions and aggregates the problem tags (e.g., `dp`, `math`, `graphs`).
3. **Recommend:** Prompts Gemini to evaluate those weak points and suggest 5 problems slightly
   above your current rating.

> Two things worth knowing about step 3. The problem names, ratings and links come from the
> model, not from the Codeforces problemset API, so a suggested link can point at a problem that
> does not exist — open them before trusting the list. And step 2 counts tags per *submission*,
> so a problem you failed five times weighs five times as much as one you failed once. Both are
> fixable by checking the recommendations against `problemset.problems` and by counting each
> problem once; neither is done yet.

## Tech Stack
- Next.js 14 (App Router)
- TailwindCSS
- `@google/genai` (Gemini 2.5 Flash)
- Codeforces API

## Setup
1. Clone the repo and run `npm install`.
2. Create a `.env.local` file and add `GEMINI_API_KEY=your_key`.
3. Run `npm run dev`.
