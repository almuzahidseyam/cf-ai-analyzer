import { GoogleGenAI } from '@google/genai';
import { readLimited } from './analysis.ts';
import type { Configuration } from './analysis.ts';

export async function source(endpoint:string,parameters:Record<string,string>,signal:AbortSignal):Promise<unknown> {
  if(!['user.info','user.status','problemset.problems'].includes(endpoint))throw new Error('Invalid endpoint.');
  const url=new URL('https://codeforces.com/api/'+endpoint);url.search=new URLSearchParams(parameters).toString();
  const deadline=AbortSignal.any([signal,AbortSignal.timeout(15000)]);
  const response=await fetch(url,{signal:deadline,redirect:'error',cache:'no-store'});
  if(!response.ok)throw new Error('Codeforces unavailable.');
  return JSON.parse(await readLimited(response.body,endpoint==='problemset.problems'?12*1024*1024:1024*1024,deadline));
}
export async function model(prompt:string,config:Configuration,signal:AbortSignal):Promise<string> {
  const ai=new GoogleGenAI({apiKey:config.apiKey,httpOptions:{timeout:40000,retryOptions:{attempts:1}}});
  const response=await ai.models.generateContent({model:config.model,contents:prompt,config:{responseMimeType:'application/json',maxOutputTokens:1200,abortSignal:AbortSignal.any([signal,AbortSignal.timeout(40000)])}});
  if(!response.text)throw new Error('Empty model response.');
  return response.text;
}
