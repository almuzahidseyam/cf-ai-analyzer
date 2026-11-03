import { timingSafeEqual } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { evidence, object, validateModel } from './evidence.ts';
import type { Analysis } from './types.ts';

export type Configuration = {accessKey:string; apiKey:string; model:string; databasePath:string; dailyLimit:number};
export type Dependencies = {
  config: () => Configuration;
  reserve: (path:string,limit:number) => {allowed:boolean;retryAfter:number};
  source: (endpoint:string,parameters:Record<string,string>,signal:AbortSignal) => Promise<unknown>;
  model: (prompt:string,config:Configuration,signal:AbortSignal) => Promise<string>;
  pause?: (signal:AbortSignal) => Promise<unknown>;
};
function json(value: unknown,status=200,headers: Record<string,string>={}) {
  return Response.json(value,{status,headers:{'Cache-Control':'no-store',...headers}});
}
export async function readLimited(body: ReadableStream<Uint8Array> | null,limit:number,signal?:AbortSignal) {
  if (!body) throw new Error('Missing response body.');
  signal?.throwIfAborted();
  const reader=body.getReader();const chunks:Uint8Array[]=[];let total=0;
  const cancel=()=>{void reader.cancel().catch(()=>{});};
  signal?.addEventListener('abort',cancel,{once:true});
  try {
    while(true){const {done,value}=await reader.read();signal?.throwIfAborted();if(done)break;total+=value.length;if(total>limit)throw new Error('Body too large.');chunks.push(value);}
    return Buffer.concat(chunks).toString('utf8');
  } catch(error) {cancel();throw error;} finally {signal?.removeEventListener('abort',cancel);reader.releaseLock();}
}
function result(value: unknown) {
  const envelope=object(value);if(envelope.status!=='OK')throw new Error('Source unavailable.');return envelope.result;
}
export function createHandler(deps: Dependencies) {
  return async function analyze(request:Request) {
    if(request.method!=='POST')return json({success:false,error:'Use POST with an access key.'},405,{'Allow':'POST'});
    const config=deps.config();
    if(config.accessKey.length<32 || !/^[\x21-\x7e]+$/.test(config.accessKey) || !config.apiKey || !config.model || !config.databasePath || !Number.isInteger(config.dailyLimit) || config.dailyLimit<1 || config.dailyLimit>100)
      return json({success:false,error:'Analysis is not configured on this server.'},503);
    const supplied=Buffer.from(request.headers.get('Authorization') || ''), expected=Buffer.from('Bearer '+config.accessKey);
    if(supplied.length!==expected.length || !timingSafeEqual(supplied,expected))return json({success:false,error:'A valid access key is required.'},401);
    if(!request.headers.get('content-type')?.startsWith('application/json'))return json({success:false,error:'Send a JSON request.'},415);
    let handle:string;
    try{
      const body=object(JSON.parse(await readLimited(request.body,1024,AbortSignal.any([request.signal,AbortSignal.timeout(10000)]))));
      if(typeof body.handle!=='string' || !/^[A-Za-z0-9_.-]{1,50}$/.test(body.handle.trim()))throw new Error('Invalid handle.');
      handle=body.handle.trim();
    }catch{return json({success:false,error:'Enter a valid Codeforces handle (up to 50 letters, digits, dots, underscores or hyphens).'},400);}
    try {
      const quota=deps.reserve(config.databasePath,config.dailyLimit);
      if(!quota.allowed)return json({success:false,error:`Analysis limit reached. Retry in ${quota.retryAfter} seconds.`},429,{'Retry-After':String(quota.retryAfter)});
    }catch{return json({success:false,error:'Usage limits could not be checked. Analysis is temporarily disabled.'},503);}
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(80000)]);
    const wait=deps.pause || ((s:AbortSignal)=>pause(2100,undefined,{signal:s}));
    try {
      const info=result(await deps.source('user.info',{handles:handle},signal));
      if(!Array.isArray(info) || info.length!==1)throw new Error('Invalid user data.');
      const user=object(info[0]);
      const rating=user.rating===undefined ? null : user.rating;
      if(rating!==null && (!Number.isSafeInteger(rating) || Number(rating)<0 || Number(rating)>5000))throw new Error('Invalid rating.');
      await wait(signal);
      const submissions=result(await deps.source('user.status',{handle,from:'1',count:'100'},signal));
      await wait(signal);
      const set=object(result(await deps.source('problemset.problems',{},signal)));
      const snapshot=evidence(submissions,set.problems,rating as number|null);
      let note='This sample contains no unresolved failed-problem pattern for the inspected verdicts. That does not establish your overall strengths or weaknesses.';
      let recommendations=snapshot.candidates.slice(0,5), usedAI=false;
      if(snapshot.topics.length && snapshot.candidates.length) {
        const prompt=`Write a cautious practice note based only on this recent sample, not a diagnosis of ability. Choose up to five IDs exclusively from candidates. Return JSON {"analysis":"1–3 short sentences","problem_ids":["123/A"]}. Do not include links or Markdown.\n${JSON.stringify({handle,rating,sampleSize:snapshot.sampleSize,topics:snapshot.topics,candidates:snapshot.candidates.map(({id,name,rating,tags})=>({id,name,rating,tags}))})}`;
        const validated=validateModel(await deps.model(prompt,config,signal),snapshot.candidates);
        note=validated.note;recommendations=validated.recommendations;usedAI=true;
      } else if(snapshot.topics.length) note='The sample contains recurring unresolved tags, but no rated problems matched the requested practice range. No AI request was made.';
      const data:Analysis={handle,rating:rating as number|null,sampleSize:snapshot.sampleSize,topics:snapshot.topics,note,usedAI,recommendations};
      return json({success:true,data});
    }catch{return json({success:false,error:signal.aborted?'Analysis timed out or was canceled. The attempt still counts toward the limit.':'Codeforces or the AI service returned unavailable or invalid data. No unverified recommendations are shown.'},502);}
  };
}
