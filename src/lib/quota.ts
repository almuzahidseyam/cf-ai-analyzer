import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function reserve(path: string, limit: number, now = Date.now()): {allowed: boolean; retryAfter: number} {
  if (!path || !Number.isInteger(limit) || limit<1 || limit>100) throw new Error('Invalid quota configuration.');
  const location = resolve(path);
  mkdirSync(dirname(location),{recursive:true});
  const db = new DatabaseSync(location);
  try {
    db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS daily (day TEXT PRIMARY KEY, used INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS gate (id INTEGER PRIMARY KEY CHECK(id=1), next_allowed INTEGER NOT NULL); INSERT OR IGNORE INTO gate VALUES(1,0); BEGIN IMMEDIATE;');
    const day = new Date(now).toISOString().slice(0,10);
    db.prepare('INSERT OR IGNORE INTO daily VALUES(?,0)').run(day);
    const row = db.prepare('SELECT used FROM daily WHERE day=?').get(day) as {used:number};
    const gate = db.prepare('SELECT next_allowed FROM gate WHERE id=1').get() as {next_allowed:number};
    if (row.used >= limit || gate.next_allowed > now) {
      db.exec('COMMIT');
      const midnight = Date.parse(day+'T00:00:00Z') + 86400000;
      return {allowed:false,retryAfter:Math.max(1,Math.ceil(((row.used>=limit?midnight:gate.next_allowed)-now)/1000))};
    }
    db.prepare('UPDATE daily SET used=used+1 WHERE day=?').run(day);
    db.prepare('UPDATE gate SET next_allowed=? WHERE id=1').run(now+90000);
    db.prepare('DELETE FROM daily WHERE day < ?').run(new Date(now-7*86400000).toISOString().slice(0,10));
    db.exec('COMMIT');
    return {allowed:true,retryAfter:0};
  } finally { db.close(); }
}
