import type { ParseReport, Rec } from '../types';
import { cleanDoi } from '../normalize';
export function csvRows(text: string, d: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === d) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; rows.push(row); row = []; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
const ALIAS: Record<string, string[]> = {
  title: ['title', 'article title', 'document title', 'ti'], abstract: ['abstract', 'ab'],
  authors: ['authors', 'author', 'author full names', 'au'], year: ['year', 'publication year', 'py', 'date'],
  journal: ['journal', 'source title', 'secondary title', 'source', 'so', 'journal/book'], volume: ['volume', 'vl'],
  issue: ['issue', 'number'], pages: ['pages', 'page', 'start page'], doi: ['doi', 'di'], pmid: ['pmid', 'pubmed id'], keywords: ['keywords', 'author keywords', 'kw'],
};
export function parseCsv(text: string, batch: string, sourceDb: string): { records: Rec[]; report: ParseReport } {
  const t = text.replace(/^\uFEFF/, ''), first = t.split(/\r?\n/)[0] || '';
  const rows = csvRows(t, first.split('\t').length > first.split(',').length ? '\t' : ',');
  const report: ParseReport = { parsed: 0, skipped: [] }, records: Rec[] = [];
  if (!rows.length) return { records, report };
  const head = rows[0].map(h => h.trim().toLowerCase()), col: Record<string, number> = {};
  for (const k in ALIAS) col[k] = head.findIndex(h => ALIAS[k].includes(h));
  rows.slice(1).forEach((r, i) => {
    const g = (k: string) => (col[k] >= 0 ? (r[col[k]] || '').trim() : '');
    if (!g('title')) { report.skipped.push({ index: i + 1, reason: 'missing title' }); return; }
    const y = g('year').match(/\d{4}/);
    records.push({
      id: `${batch}-${i + 1}`, title: g('title'), abstract: g('abstract'), authors: g('authors').split(/;|\||\sand\s/).map(s => s.trim()).filter(Boolean),
      year: y ? +y[0] : undefined, journal: g('journal'), volume: g('volume'), issue: g('issue'), pages: g('pages'),
      doi: cleanDoi(g('doi')), pmid: g('pmid'), keywords: g('keywords').split(/;|\|/).map(s => s.trim()).filter(Boolean),
      sourceDb, batch, raw: r.join(','),
    });
    report.parsed++;
  });
  if (col.title < 0) report.skipped.unshift({ index: 0, reason: 'no title column found (headers: ' + head.join(', ') + ')' });
  return { records, report };
}
