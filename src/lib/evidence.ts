import type { Problem, Recommendation } from './types.ts';

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid response object.');
  return value as Record<string, unknown>;
}
function key(problem: Record<string, unknown>): string | null {
  return Number.isSafeInteger(problem.contestId) && Number(problem.contestId) > 0 && typeof problem.index === 'string' && /^[A-Z][0-9A-Z]{0,4}$/.test(problem.index)
    ? `${problem.contestId}/${problem.index}` : null;
}
function tags(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((tag): tag is string => typeof tag === 'string' && tag.length <= 60))].slice(0,20) : [];
}
export function evidence(raw: unknown, problemset: unknown, rating: number | null) {
  if (!Array.isArray(raw) || raw.length > 100 || !Array.isArray(problemset) || problemset.length > 100000) throw new Error('Invalid source data.');
  const solved = new Set<string>(), failed = new Map<string,string[]>();
  const failures = new Set(['WRONG_ANSWER','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED','RUNTIME_ERROR']);
  for (const item of raw) {
    const submission = object(item), problem = object(submission.problem), id = key(problem);
    if (!id) continue;
    if (submission.verdict === 'OK') solved.add(id);
    else if (typeof submission.verdict === 'string' && failures.has(submission.verdict)) failed.set(id,tags(problem.tags));
  }
  const counts = new Map<string,number>();
  for (const [id, values] of failed) if (!solved.has(id)) for (const tag of values) counts.set(tag,(counts.get(tag) || 0)+1);
  const topics = [...counts].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0])).slice(0,5).map(([name,count])=>({name,count}));
  const focus = new Set(topics.map(t=>t.name));
  const lower = rating === null ? 800 : Math.max(800,rating+100), upper = rating === null ? 1100 : Math.max(1100,rating+300);
  const candidates: Recommendation[] = [], seen = new Set<string>();
  for (const item of problemset) {
    const p = object(item), id = key(p);
    if (!id || seen.has(id) || solved.has(id) || typeof p.name !== 'string' || p.name.length > 200 || !Number.isSafeInteger(p.rating) || Number(p.rating)<lower || Number(p.rating)>upper) continue;
    const labels = tags(p.tags);
    if (focus.size && !labels.some(t=>focus.has(t))) continue;
    seen.add(id);
    const problem: Problem = {contestId:Number(p.contestId),index:String(p.index),name:p.name,rating:Number(p.rating),tags:labels};
    candidates.push({...problem,id,link:`https://codeforces.com/problemset/problem/${id}`});
  }
  candidates.sort((a,b)=>a.rating-b.rating || b.contestId-a.contestId || a.index.localeCompare(b.index));
  return {topics,candidates:candidates.slice(0,40),sampleSize:raw.length};
}

export function validateModel(text: string, candidates: Recommendation[]) {
  if (Buffer.byteLength(text)>12000) throw new Error('Model response too large.');
  const result = object(JSON.parse(text));
  if (typeof result.analysis !== 'string' || !result.analysis.trim() || result.analysis.length>1600 || !Array.isArray(result.problem_ids) || result.problem_ids.length<1 || result.problem_ids.length>5) throw new Error('Invalid model response.');
  const byId = new Map(candidates.map(p=>[p.id,p]));
  const selected: Recommendation[] = [];
  for (const id of result.problem_ids) {
    if (typeof id !== 'string' || !byId.has(id) || selected.some(p=>p.id===id)) throw new Error('Model selected an invalid or duplicate problem.');
    selected.push(byId.get(id)!);
  }
  return {note:result.analysis.trim(),recommendations:selected};
}
