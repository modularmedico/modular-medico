const toRe = (s: string) => s.split(/[\n,]+/).map(k => k.trim()).filter(Boolean)
  .map(k => k.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '\\w*')).join('|');
export interface Seg { t: string; k?: 'inc' | 'exc' }
/** Splits text into plain / include (green) / exclude (red) segments. Supports phrases and wildcards (random*). */
export function segments(text: string, inc: string, exc: string, cs: boolean): Seg[] {
  const a = toRe(inc), b = toRe(exc);
  if (!text || (!a && !b)) return [{ t: text }];
  const re = new RegExp(`\\b(?:(${a || '(?!)'})|(${b || '(?!)'}))\\b`, cs ? 'g' : 'gi');
  const out: Seg[] = []; let last = 0;
  for (const m of text.matchAll(re)) {
    const s = m.index!; if (s > last) out.push({ t: text.slice(last, s) });
    out.push({ t: m[0], k: m[1] ? 'inc' : 'exc' }); last = s + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last) });
  return out;
}
