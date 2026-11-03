import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, readLimited } from '../src/lib/analysis.ts';
import type { Configuration, Dependencies } from '../src/lib/analysis.ts';
import { evidence, validateModel } from '../src/lib/evidence.ts';
import { source } from '../src/lib/providers.ts';

const config:Configuration={accessKey:'a'.repeat(32),apiKey:'fixture-secret',model:'fixture-model',databasePath:'fixture.sqlite',dailyLimit:10};
const p={contestId:123,index:'A',name:'Fixture problem',rating:1000,tags:['dp']};
const submission={verdict:'WRONG_ANSWER',problem:{...p,contestId:122}};
function setup(overrides:Partial<Dependencies>={}) {
  const calls:string[]=[];
  const deps:Dependencies={config:()=>config,reserve:()=>{calls.push('quota');return {allowed:true,retryAfter:0};},pause:async()=>{},
    source:async(endpoint)=>{calls.push(endpoint);return {status:'OK',result:endpoint==='user.info'?[{rating:900}]:endpoint==='user.status'?[submission]:{problems:[p]}};},
    model:async()=>{calls.push('model');return JSON.stringify({analysis:'Consider practicing this topic.',problem_ids:['123/A']});},...overrides};
  return {handle:createHandler(deps),calls};
}
function request(body:unknown={handle:'tester'},key=config.accessKey) {return new Request('http://localhost/api/analyze',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(body)});}
test('missing/weak server configuration fails closed before usage or providers',async()=>{
  for(const changed of [{accessKey:''},{apiKey:''},{model:''},{databasePath:''},{dailyLimit:101},{dailyLimit:NaN}]) {
    const s=setup({config:()=>({...config,...changed})});assert.equal((await s.handle(request())).status,503);assert.deepEqual(s.calls,[]);
  }
});
test('missing or wrong key never reaches quota or paid providers',async()=>{
  const s=setup();for(const key of ['', 'b'.repeat(32)])assert.equal((await s.handle(request(undefined,key))).status,401);assert.deepEqual(s.calls,[]);
});
test('old GET interface cannot spend quota',async()=>{const s=setup();const r=await s.handle(new Request('http://localhost/api/analyze?handle=x'));assert.equal(r.status,405);assert.equal(r.headers.get('Allow'),'POST');assert.deepEqual(s.calls,[]);});
test('rejects malformed, injected and oversized handles before quota',async()=>{
  const s=setup();for(const handle of ['', 'x&handles=other','x\ny','x'.repeat(51),123,'x'.repeat(2000)])assert.equal((await s.handle(request({handle}))).status,400);assert.deepEqual(s.calls,[]);
});
test('requires JSON content type',async()=>{const s=setup();const r=request();r.headers.set('content-type','text/plain');assert.equal((await s.handle(r)).status,415);});
test('exhausted quota and unavailable quota fail before providers',async()=>{
  const s=setup({reserve:()=>({allowed:false,retryAfter:90})});const r=await s.handle(request());assert.equal(r.status,429);assert.equal(r.headers.get('Retry-After'),'90');assert.deepEqual(s.calls,[]);
  const b=setup({reserve:()=>{throw new Error('private path');}});assert.equal((await b.handle(request())).status,503);assert.deepEqual(b.calls,[]);
});
test('successful response uses checked catalog metadata and never caches',async()=>{
  const s=setup();const r=await s.handle(request());assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');const data=(await r.json()).data;
  assert.equal(data.usedAI,true);assert.equal(data.recommendations[0].link,'https://codeforces.com/problemset/problem/123/A');assert.deepEqual(s.calls,['quota','user.info','user.status','problemset.problems','model']);
});
test('provider failures consume attempt and redact provider secrets',async()=>{
  const s=setup({source:async()=>{throw new Error('fixture-secret');}});const r=await s.handle(request());assert.equal(r.status,502);assert.equal((await r.text()).includes('fixture-secret'),false);assert.deepEqual(s.calls,['quota']);
});
test('rejects malformed provider envelope and rating',async()=>{
  for(const result of [{status:'FAILED'}, {status:'OK',result:[]},{status:'OK',result:[{rating:'900'}]}]){const s=setup({source:async()=>result});assert.equal((await s.handle(request())).status,502);assert.equal(s.calls.includes('model'),false);}
});
test('no unresolved pattern skips AI and makes limited claims',async()=>{
  const s=setup({source:async endpoint=>({status:'OK',result:endpoint==='user.info'?[{}]:endpoint==='user.status'?[]:{problems:[p]}})});
  const data=(await (await s.handle(request())).json()).data;assert.equal(data.rating,null);assert.equal(data.usedAI,false);assert.match(data.note,/does not establish/);assert.equal(s.calls.includes('model'),false);
});
test('no candidate skips AI without inventing problems',async()=>{
  const s=setup({source:async endpoint=>({status:'OK',result:endpoint==='user.info'?[{rating:4900}]:endpoint==='user.status'?[submission]:{problems:[p]}})});
  const data=(await (await s.handle(request())).json()).data;assert.deepEqual(data.recommendations,[]);assert.equal(s.calls.includes('model'),false);
});
test('model invented ID produces failure rather than an unchecked link',async()=>{const s=setup({model:async()=>JSON.stringify({analysis:'x',problem_ids:['999/A']})});assert.equal((await s.handle(request())).status,502);});
test('distinct failed problems count once; accepted problems and ignored verdicts do not count',()=>{
  const result=evidence([submission,submission,{...submission,verdict:'OK'},{verdict:'COMPILATION_ERROR',problem:p},{verdict:'WRONG_ANSWER',problem:{...p,tags:['__proto__','dp','dp']}}],[p],900);
  assert.deepEqual(result.topics,[{name:'__proto__',count:1},{name:'dp',count:1}]);assert.equal(result.sampleSize,5);
});
test('canonical catalog filters solved problems, invalid IDs, duplicate IDs and out-of-range ratings',()=>{
  const result=evidence([{verdict:'OK',problem:p}],[p,{...p,contestId:124,index:'../evil'},{...p,contestId:125,rating:1500},{...p,contestId:126},{...p,contestId:126}],900);
  assert.deepEqual(result.candidates.map(p=>p.id),['126/A']);
});
test('strict model schema rejects duplicate, unknown, non-string and oversized content',()=>{
  const candidates=evidence([], [p],null).candidates;
  for(const input of ['not JSON','[]',JSON.stringify({analysis:'',problem_ids:['123/A']}),JSON.stringify({analysis:'x',problem_ids:['123/A','123/A']}),JSON.stringify({analysis:'x',problem_ids:[123]}),JSON.stringify({analysis:'x',problem_ids:['9/A']}),'x'.repeat(13000)])assert.throws(()=>validateModel(input,candidates));
});
test('stream reader bounds response bytes and cancels on overflow',async()=>{
  let canceled=false;const stream=new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array(20));},cancel(){canceled=true;}});
  await assert.rejects(readLimited(stream,10),/too large/);assert.equal(canceled,true);
});
test('stream reader aborts even when an upstream body stalls',async()=>{
  const controller=new AbortController();const result=readLimited(new ReadableStream<Uint8Array>(),10,controller.signal);controller.abort();await assert.rejects(result);
});
test('source client uses only fixed endpoints, encoded parameters and bounded responses',async(t)=>{
  let captured:URL|undefined;
  t.mock.method(globalThis,'fetch',async(url:URL,options:RequestInit)=>{captured=url;assert.equal(options.redirect,'error');return Response.json({status:'OK',result:[]});});
  await source('user.info',{handles:'x&other=y'},new AbortController().signal);assert.equal(captured?.hostname,'codeforces.com');assert.equal(captured?.searchParams.get('handles'),'x&other=y');assert.equal(captured?.searchParams.has('other'),false);
  await assert.rejects(source('../evil',{},new AbortController().signal));
});
