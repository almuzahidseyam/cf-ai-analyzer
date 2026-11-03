export type Problem = { contestId: number; index: string; name: string; rating: number; tags: string[] };
export type Recommendation = Problem & { id: string; link: string };
export type Analysis = {
  handle: string; rating: number | null; sampleSize: number;
  topics: { name: string; count: number }[];
  note: string; usedAI: boolean; recommendations: Recommendation[];
};
