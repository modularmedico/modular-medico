import type { ParseReport, Rec } from '../types';
import { cleanDoi } from '../normalize';

export function parseRis(text: string, batch = 'import', sourceDb = ''): { records: Rec[]; report: ParseReport } {
  const records: Rec[] = [], report: ParseReport = { parsed: 0, skipped: [] };
  let cur: Record<string, string[]> = {}, raw: string[] = [], n = 0;
  const flush = () => {
    if (!raw.length) return;
    n++;
    const g = (...k: string[]) => { for (const x of k) if (cur[x]?.length) return cur[x][0].trim(); return ''; };
    const title = g('TI', 'T1');
    if (!title) report.skipped.push({ index: n, reason: 'missing title' });
    else {
      const sp = g('SP'), ep = g('EP'), y = g('PY', 'Y1', 'DA').match(/\d{4}/);
      records.push({
        id: `${batch}-${n}`, title, abstract: g('AB', 'N2'), authors: [...(cur.AU || []), ...(cur.A1 || [])].map(s => s.trim()),
        year: y ? +y[0] : undefined, journal: g('JO', 'JF', 'T2', 'JA'), volume: g('VL'), issue: g('IS'),
        pages: ep ? `${sp}-${ep}` : sp, doi: cleanDoi(g('DO') || g('UR')), pmid: /^\d+$/.test(g('AN')) ? g('AN') : '',
        keywords: cur.KW || [], sourceDb: sourceDb || g('DB', 'DP'), batch, raw: raw.join('\n'),
      });
      report.parsed++;
    }
    cur = {}; raw = [];
  };
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const m = line.match(/^([A-Z][A-Z0-9])  - ?(.*)$/);
    if (!m) { if (raw.length && line.trim()) { raw.push(line); } continue; }
    if (m[1] === 'ER') { flush(); continue; }
    raw.push(line); (cur[m[1]] ||= []).push(m[2]);
  }
  flush();
  return { records, report };
}
