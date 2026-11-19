import type { ParseReport, Rec } from '../types';
import { cleanDoi } from '../normalize';
export function parseBib(text: string, batch: string, sourceDb: string): { records: Rec[]; report: ParseReport } {
  const records: Rec[] = [], report: ParseReport = { parsed: 0, skipped: [] };
  text.split(/^\s*@(?=\w+\s*\{)/m).slice(1).forEach((chunk, i) => {
    const f: Record<string, string> = {};
    for (const m of chunk.matchAll(/(\w+)\s*=\s*(?:\{((?:[^{}]|\{[^{}]*\})*)\}|"([^"]*)"|(\d+))/g))
      f[m[1].toLowerCase()] = (m[2] ?? m[3] ?? m[4] ?? '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
    if (!f.title) { report.skipped.push({ index: i + 1, reason: 'missing title' }); return; }
    const y = (f.year || '').match(/\d{4}/);
    records.push({
      id: `${batch}-${i + 1}`, title: f.title, abstract: f.abstract || '', authors: (f.author || '').split(/\sand\s/).map(s => s.trim()).filter(Boolean),
      year: y ? +y[0] : undefined, journal: f.journal || f.booktitle || '', volume: f.volume || '', issue: f.number || '', pages: (f.pages || '').replace('--', '-'),
      doi: cleanDoi(f.doi || ''), pmid: f.pmid || '', keywords: (f.keywords || '').split(/[;,]/).map(s => s.trim()).filter(Boolean), sourceDb, batch, raw: chunk.trim(),
    });
    report.parsed++;
  });
  return { records, report };
}
