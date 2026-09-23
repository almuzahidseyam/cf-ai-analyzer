# Codeforces AI Analyzer ??

An AI-powered assistant for Competitive Programmers. 
It analyzes your recent failed submissions (WA/TLE) on Codeforces to identify your weak topics and uses Google's Gemini AI to recommend highly personalized practice problems tailored to your exact rating and weaknesses.

## How it works
1. **Fetch:** Pulls your last 100 submissions via the official Codeforces API.
2. **Analyze:** Filters out failed submissions and aggregates the problem tags (e.g., `dp`, `math`, `graphs`).
3. **Recommend:** Prompts Gemini to evaluate those weak points and suggest 5 problems slightly
   above your current rating.

4. **Verify:** every suggestion is matched against `problemset.problems` before you see it. The
   model writes the names and links, and left unchecked it will invent a contest id — so a match
   is rewritten with the canonical name, rating and link, and anything with no match is dropped
   rather than shown as a link that 404s.

> **How weakness is measured.** Tags are counted once per *problem*, not per submission, and any
> problem you went on to solve is excluded. Counting submissions let one problem you retried five
> times outweigh five different problems you each failed once — and a problem you eventually solved
> is not a weakness at all.

## Tech Stack
- Next.js 14 (App Router)
- TailwindCSS
- `@google/genai` (Gemini 2.5 Flash)
- Codeforces API

## Setup
1. Clone the repo and run `npm install`.
2. Create a `.env.local` file and add `GEMINI_API_KEY=your_key`.
3. Run `npm run dev`.
