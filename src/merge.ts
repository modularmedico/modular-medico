import type { Rec } from './core/types';
import type { MergeEntry } from './store';
const F = ['title', 'abstract', 'journal', 'volume', 'issue', 'pages', 'doi', 'pmid'] as const;
const rich = (r: Rec) => F.reduce((n, f) => n + (r[f] ? 1 : 0), 0) + r.authors.length * 0.1 + r.keywords.length * 0.05 + (r.year ? 1 : 0) + r.abstract.length / 1000;
export const byId = (recs: Rec[]) => new Map(recs.map(r => [r.id, r]));
export function rootOf(m: Map<string, Rec>, id: string): Rec | undefined {
  let r = m.get(id); while (r?.mergedInto) r = m.get(r.mergedInto); return r;
}
/** Keep richest record as master, fill gaps field-by-field, keep provenance; fully reversible via undoMerge. */
export function mergeGroup(recs: Rec[], ids: string[]) {
  const grp = ids.map(i => recs.find(r => r.id === i)).filter((r): r is Rec => !!r && !r.mergedInto);
  const master = [...grp].sort((a, b) => rich(b) - rich(a))[0];
  const others = grp.filter(r => r.id !== master.id);
  const m: Rec = { ...master, sources: [...new Set(grp.flatMap(r => r.sources || [r.sourceDb || r.batch]))] };
  for (const o of others) {
    for (const f of F) if (!m[f]) (m as unknown as Record<string, string>)[f] = o[f];
    if (!m.year) m.year = o.year;
    if (o.authors.length > m.authors.length) m.authors = o.authors;
    m.keywords = [...new Set([...m.keywords, ...o.keywords])];
  }
  const s = new Set(others.map(o => o.id));
  const entry: MergeEntry = { master: m.id, before: master, merged: [...s], t: Date.now() };
  return { recs: recs.map(r => (r.id === m.id ? m : s.has(r.id) ? { ...r, mergedInto: m.id } : r)), entry };
}
export function undoMerge(recs: Rec[], e: MergeEntry): Rec[] {
  const s = new Set(e.merged);
  return recs.map(r => (r.id === e.master ? e.before : s.has(r.id) ? { ...r, mergedInto: undefined } : r));
}
