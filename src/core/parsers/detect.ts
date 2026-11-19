import { parseRis } from './ris';
import { parseBib } from './bibtex';
import { parseCsv } from './csv';
/** Auto-detects RIS / BibTeX / CSV-TSV from content. */
export function parseAny(text: string, batch: string, sourceDb: string) {
  const t = text.replace(/^\uFEFF/, '').trimStart();
  if (/^TY {2}-/m.test(t.slice(0, 3000))) return parseRis(t, batch, sourceDb);
  if (t.startsWith('@')) return parseBib(t, batch, sourceDb);
  return parseCsv(t, batch, sourceDb);
}
