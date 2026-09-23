import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

type CodeforcesProblem = {
  contestId?: number;
  index?: string;
  name?: string;
  rating?: number;
  tags?: string[];
};

type CodeforcesSubmission = {
  verdict?: string;
  problem?: CodeforcesProblem;
};

type Recommendation = {
  name: string;
  link: string;
  rating?: number;
  tags?: string[];
  verified?: boolean;
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get('handle');

    if (!handle) {
      return NextResponse.json({ success: false, error: 'Handle is required' }, { status: 400 });
    }

    // 1. Fetch Codeforces Info
    const userInfoRes = await fetch(`https://codeforces.com/api/user.info?handles=${handle}`);
    const userInfoData = await userInfoRes.json();
    if (userInfoData.status !== 'OK') {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    const userRating = userInfoData.result[0].rating || 0;

    // 2. Fetch User Submissions
    const statusRes = await fetch(`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=100`);
    const statusData = await statusRes.json();
    
    if (statusData.status !== 'OK') {
      return NextResponse.json({ success: false, error: 'Failed to fetch submissions' }, { status: 500 });
    }

    // 3. Extract Failed Tags
    //
    // Counted once per PROBLEM, not per submission. Counting submissions let a
    // single problem you retried five times outweigh five different problems
    // you each failed once -- the opposite of what a weakness profile should
    // say. A problem you went on to solve is not a weakness either, so anything
    // later accepted is dropped.
    const submissions: CodeforcesSubmission[] = statusData.result;

    const problemKey = (p: CodeforcesProblem) =>
      `${p.contestId ?? 'x'}-${p.index ?? ''}-${p.name ?? ''}`;

    const solved = new Set<string>();
    for (const sub of submissions) {
      if (sub.verdict === 'OK' && sub.problem) solved.add(problemKey(sub.problem));
    }

    const failedProblems = new Map<string, string[]>();
    for (const sub of submissions) {
      if (!sub.problem?.tags) continue;
      if (sub.verdict === 'OK' || sub.verdict === 'TESTING') continue;
      const key = problemKey(sub.problem);
      if (solved.has(key)) continue;          // failed, then solved: not a weakness
      if (!failedProblems.has(key)) failedProblems.set(key, sub.problem.tags);
    }

    const failedTags: Record<string, number> = {};
    for (const tags of failedProblems.values()) {
      for (const tag of tags) failedTags[tag] = (failedTags[tag] || 0) + 1;
    }

    const sortedTags = Object.entries(failedTags)
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0])
      .slice(0, 5); // Top 5 weak tags

    // 4. Prompt Gemini AI
    const prompt = `
      You are an expert Competitive Programming Coach. 
      Analyze this user:
      - Handle: ${handle}
      - Current Rating: ${userRating}
      - Weak Topics (based on recent failed submissions): ${sortedTags.join(', ')}

      Task:
      1. Write a short, encouraging 2-3 sentence analysis of their weakness and what they should focus on.
      2. Suggest EXACTLY 5 Codeforces problems for them to solve to improve. The problems should match their rating level (+100 to +300 of their rating) and focus on their weak tags.

      Return ONLY valid JSON in this exact format:
      {
        "handle": "${handle}",
        "rating": ${userRating},
        "weakness_analysis": "Your encouraging analysis here...",
        "recommendations": [
          {
            "name": "Problem Name (e.g. 154B - Colliders)",
            "link": "https://codeforces.com/problemset/problem/154/B",
            "rating": 1500,
            "tags": ["number theory", "math"]
          }
        ]
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
          responseMimeType: "application/json"
      }
    });

    const parsedData = JSON.parse(response.text || "{}");

    // 5. Check the recommendations against the real problemset.
    //
    // The names, ratings and links above are the model's, not Codeforces'.
    // Left unchecked it will cheerfully invent a contest id, and the tool's
    // whole output is a list of links that must open. Each recommendation is
    // matched against problemset.problems; a match is rewritten with the
    // canonical name, rating and link, and anything with no match is dropped
    // rather than shown with a fabricated link.
    const recommendations: Recommendation[] = Array.isArray(parsedData?.recommendations)
      ? parsedData.recommendations
      : [];

    if (recommendations.length > 0) {
      try {
        const setRes = await fetch('https://codeforces.com/api/problemset.problems');
        const setData = await setRes.json();
        if (setData.status === 'OK') {
          const real: CodeforcesProblem[] = setData.result.problems;
          const byName = new Map<string, CodeforcesProblem>();
          const byId = new Map<string, CodeforcesProblem>();
          for (const p of real) {
            if (p.name) byName.set(p.name.trim().toLowerCase(), p);
            if (p.contestId && p.index) byId.set(`${p.contestId}${p.index}`.toLowerCase(), p);
          }

          const verified: Recommendation[] = [];
          for (const rec of recommendations) {
            // The model writes names like "154B - Colliders", so try the id
            // embedded in the name and the link, then the name itself.
            const idFromText = (`${rec.name ?? ''} ${rec.link ?? ''}`.match(/(\d{1,4})\s*\/?\s*([A-Z]\d?)\b/) || []);
            const idKey = idFromText[1] ? `${idFromText[1]}${idFromText[2]}`.toLowerCase() : '';
            const nameKey = (rec.name ?? '').replace(/^\s*\d+\s*[A-Z]\d?\s*[-–]\s*/, '').trim().toLowerCase();

            const match = byId.get(idKey) || byName.get(nameKey);
            if (!match || !match.contestId || !match.index) continue;

            verified.push({
              name: `${match.contestId}${match.index} - ${match.name}`,
              link: `https://codeforces.com/problemset/problem/${match.contestId}/${match.index}`,
              rating: match.rating,
              tags: match.tags,
              verified: true,
            });
          }
          parsedData.recommendations = verified;
          parsedData.unverified_dropped = recommendations.length - verified.length;
        }
      } catch {
        // The problemset endpoint is the only thing that can fail here, and a
        // rating analysis without verification still beats no answer -- but say
        // so rather than implying the links were checked.
        parsedData.recommendations = recommendations.map((r) => ({ ...r, verified: false }));
      }
    }

    return NextResponse.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to analyze data.' }, { status: 500 });
  }
}
