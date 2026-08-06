# Codeforces AI Analyzer ??

An AI-powered assistant for Competitive Programmers. 
It analyzes your recent failed submissions (WA/TLE) on Codeforces to identify your weak topics and uses Google's Gemini AI to recommend highly personalized practice problems tailored to your exact rating and weaknesses.

## How it works
1. **Fetch:** Pulls your last 100 submissions via the official Codeforces API.
2. **Analyze:** Filters out failed submissions and aggregates the problem tags (e.g., `dp`, `math`, `graphs`).
3. **Recommend:** Prompts Gemini AI to evaluate your weak points and suggest 5 new problems that are slightly above your current rating to help you improve.

## Tech Stack
- Next.js 14 (App Router)
- TailwindCSS
- `@google/genai` (Gemini 2.5 Flash)
- Codeforces API

## Setup
1. Clone the repo and run `npm install`.
2. Create a `.env.local` file and add `GEMINI_API_KEY=your_key`.
3. Run `npm run dev`.
