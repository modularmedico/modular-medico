import type { Pair, Rec } from './core/types';
export type Verdict = 'include' | 'exclude' | 'maybe';
export interface Decision { v: Verdict; reason: string; note: string; t: number }
export interface MergeEntry { master: string; before: Rec; merged: string[]; t: number }
export interface Project {
  recs: Rec[]; pairs: Pair[]; kept: string[]; decisions: Record<string, Decision>;
  inc: string; exc: string; cs: boolean; log: MergeEntry[]; th: { auto: number; possible: number };
  imports: { name: string; parsed: number; skipped: number }[];
}
export const empty: Project = { recs: [], pairs: [], kept: [], decisions: {}, inc: '', exc: '', cs: false, log: [], th: { auto: 0.95, possible: 0.8 }, imports: [] };
const open = () => new Promise<IDBDatabase>((res, rej) => {
  const r = indexedDB.open('openscreen', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
export async function load(): Promise<Project> {
  try {
    const db = await open();
    return await new Promise(res => {
      const q = db.transaction('kv').objectStore('kv').get('p');
      q.onsuccess = () => res({ ...empty, ...(q.result || {}) }); q.onerror = () => res(empty);
    });
  } catch { return empty; }
}
export async function save(p: Project) {
  try { (await open()).transaction('kv', 'readwrite').objectStore('kv').put(p, 'p'); } catch { /* ignore */ }
}
