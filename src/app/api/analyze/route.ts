import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

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
    const submissions = statusData.result;
    const failedTags: Record<string, number> = {};
    
    submissions.forEach((sub: any) => {
      if (sub.verdict !== 'OK' && sub.problem && sub.problem.tags) {
        sub.problem.tags.forEach((tag: string) => {
          failedTags[tag] = (failedTags[tag] || 0) + 1;
        });
      }
    });

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

    return NextResponse.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to analyze data.' }, { status: 500 });
  }
}
