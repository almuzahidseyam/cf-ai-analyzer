import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { reserve } from '../src/lib/quota.ts';
const run=promisify(execFile), moduleUrl=new URL('../src/lib/quota.ts',import.meta.url).href;
function database(t:TestContext) {
  const folder=mkdtempSync(join(tmpdir(),'cf-analyzer-test-'));t.after(()=>rmSync(folder,{recursive:true,force:true}));return join(folder,'usage.sqlite');
}
const now=Date.parse('2026-01-01T10:00:00Z');
test('durable cooldown, daily limit and UTC rollover survive reopening the database',t=>{
  const file=database(t);assert.equal(reserve(file,2,now).allowed,true);assert.deepEqual(reserve(file,2,now),{allowed:false,retryAfter:90});
  assert.equal(reserve(file,2,now+90000).allowed,true);assert.equal(reserve(file,2,now+180000).allowed,false);assert.equal(reserve(file,2,now+86400000).allowed,true);
});
test('independent worker processes cannot spend the same cooldown slot',async t=>{
  const file=database(t);
  const results=await Promise.all(Array.from({length:6},()=>run(process.execPath,['--experimental-strip-types','--input-type=module','-e',`import {reserve} from ${JSON.stringify(moduleUrl)};console.log(JSON.stringify(reserve(${JSON.stringify(file)},10,${now})));`])));
  assert.equal(results.map(r=>JSON.parse(r.stdout)).filter(r=>r.allowed).length,1);
});
test('invalid quotas and unusable database paths cannot grant a reservation',t=>{
  const file=database(t);for(const limit of [0,-1,101,NaN,1.5])assert.throws(()=>reserve(file,limit));assert.throws(()=>reserve('',10));reserve(file,10);assert.throws(()=>reserve(join(file,'nested.sqlite'),10));
});
