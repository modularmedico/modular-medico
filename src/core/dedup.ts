import type { DedupOptions, Pair, Rec } from './types';
import { authorKey, cleanDoi, firstPage, jaccard, normTitle, tokenSet, trigrams } from './normalize';

const PREPRINT = /arxiv|biorxiv|medrxiv|ssrn|preprint|research square/i;
const ERRATUM = /^(erratum|errata|corrigendum|correction|retraction|retracted|withdrawal)\b/i;
const defaults: DedupOptions = { auto: 0.95, possible: 0.8 };

class UF {
  p = new Map<string, string>();
  find(x: string): string { const q = this.p.get(x) ?? x; if (q === x) return x; const r = this.find(q); this.p.set(x, r); return r; }
  union(a: string, b: string) { this.p.set(this.find(a), this.find(b)); }
}

/** Abbreviation-tolerant: a token matches if one is a prefix of the other ("j" ~ "journal"). */
function journalSim(a: string, b: string): number {
  const A = a.split(' '), B = b.split(' ');
  const hit = A.filter(x => B.some(y => x.startsWith(y) || y.startsWith(x))).length;
  return hit / Math.max(A.length, B.length);
}

/** Weighted confidence in [0,1]. Missing fields are neutral (dropped and weights renormalised). */
export function scorePair(a: Rec, b: Rec): number {
  const parts: [number, number | null][] = [];
  const ta = normTitle(a.title), tb = normTitle(b.title);
  parts.push([0.45, 0.5 * tokenSet(ta, tb) + 0.5 * jaccard(trigrams(ta), trigrams(tb))]);
  const A = new Set(a.authors.map(authorKey)), B = new Set(b.authors.map(authorKey));
  parts.push([0.2, A.size && B.size ? jaccard(A, B) : null]);
  parts.push([0.05, a.year && b.year ? (a.year === b.year ? 1 : 0.5) : null]);
  const ja = normTitle(a.journal), jb = normTitle(b.journal);
  parts.push([0.1, ja && jb ? journalSim(ja, jb) : null]);
  const vp: number[] = [];
  if (a.volume && b.volume) vp.push(a.volume === b.volume ? 1 : 0);
  if (a.pages && b.pages) vp.push(firstPage(a.pages) === firstPage(b.pages) ? 1 : 0);
  parts.push([0.1, vp.length ? vp.reduce((s, x) => s + x, 0) / vp.length : null]);
  parts.push([0.1, a.abstract.length > 50 && b.abstract.length > 50 ? jaccard(trigrams(normTitle(a.abstract)), trigrams(normTitle(b.abstract))) : null]);
  let w = 0, s = 0;
  for (const [wt, v] of parts) if (v !== null) { w += wt; s += wt * v; }
  let score = s / w;
  if (w < 0.6) score = Math.min(score, 0.94);                       // thin evidence never auto-merges
  if (cleanDoi(a.doi) && cleanDoi(b.doi) && cleanDoi(a.doi) !== cleanDoi(b.doi)) score *= 0.5;               // DOI conflict: strong negative
  if (PREPRINT.test(a.journal) !== PREPRINT.test(b.journal)) score = Math.min(score, 0.94); // preprint vs published: human review
  return score;
}

export function dedupe(input: Rec[], opt: Partial<DedupOptions> = {}) {
  const recs = input.map(r => ({ ...r, doi: cleanDoi(r.doi) }));
  const o = { ...defaults, ...opt }, uf = new UF(), pairs: Pair[] = [];
  const seen = new Set<string>(), key = (a: Rec, b: Rec) => (a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id);
  const byId = new Map(recs.map(r => [r.id, r]));
  const bad = (a: Rec, b: Rec) => ERRATUM.test(a.title.trim()) !== ERRATUM.test(b.title.trim());

  // Stage 2: exact identifiers or identical normalised title + year
  const idx = new Map<string, Rec>();
  for (const r of recs) {
    const ks = [r.doi && 'd:' + r.doi, r.pmid && 'p:' + r.pmid, r.year && `t:${normTitle(r.title)}|${r.year}`].filter(Boolean) as string[];
    for (const k of ks) {
      const hit = idx.get(k);
      if (hit && !bad(hit, r) && !(hit.doi && r.doi && hit.doi !== r.doi)) {
        uf.union(hit.id, r.id); seen.add(key(hit, r)); pairs.push({ a: hit.id, b: r.id, score: 1, tier: 'auto', reason: 'exact:' + k[0] });
      } else if (!hit) idx.set(k, r);
    }
  }
  // Stage 3: blocking on first 3 title tokens
  const blocks = new Map<string, Rec[]>();
  for (const r of recs) { const k = normTitle(r.title).split(' ').slice(0, 3).join(' '); if (k) (blocks.get(k) ?? blocks.set(k, []).get(k)!).push(r); }
  // Stage 4-5: fuzzy scoring within blocks, then tiers
  for (const blk of blocks.values())
    for (let i = 0; i < blk.length; i++) for (let j = i + 1; j < blk.length; j++) {
      const a = blk[i], b = blk[j];
      if (seen.has(key(a, b)) || bad(a, b)) continue;
      if (a.year && b.year && Math.abs(a.year - b.year) > 1) continue; // same title, different year: keep separate
      const score = scorePair(a, b);
      if (score < o.possible) continue;
      const tier = score >= o.auto ? 'auto' : 'possible';
      pairs.push({ a: a.id, b: b.id, score, tier, reason: 'fuzzy' });
      if (tier === 'auto') uf.union(a.id, b.id);
    }
  const groups = new Map<string, string[]>();
  for (const r of recs) { const root = uf.find(r.id); (groups.get(root) ?? groups.set(root, []).get(root)!).push(r.id); }
  return { pairs, clusters: [...groups.values()], byId };
}
