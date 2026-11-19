const STOP = new Set('a an the of and or in on for to with by from at as is are was were be this that these those its their'.split(' '));
export const stripHtml = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ');
export const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function normTitle(t: string): string {
  return fold(stripHtml(t)).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w)).join(' ');
}
export function cleanDoi(d: string): string {
  const m = (d || '').toLowerCase().match(/10\.\d{4,9}\/\S+/);
  return m ? m[0].replace(/[.,;)\]]+$/, '') : '';
}
/** "Smith, John A." and "John A Smith" -> "smith j" */
export function authorKey(a: string): string {
  const s = fold(a).replace(/[^a-z,\s.-]/g, '').trim();
  let sur: string, giv = '';
  if (s.includes(',')) { const p = s.split(','); sur = p[0].trim(); giv = (p[1] || '').trim(); }
  else { const p = s.split(/\s+/); sur = p.pop() || ''; giv = p.join(' '); }
  return `${sur.replace(/[\s-]+/g, '')} ${giv.replace(/[^a-z]/g, '')[0] || ''}`.trim();
}
export const firstPage = (p: string) => (p || '').split(/[-–]/)[0].trim().toLowerCase();

export const trigrams = (s: string) => {
  const p = `  ${s} `, o = new Set<string>();
  for (let i = 0; i < p.length - 2; i++) o.add(p.slice(i, i + 3));
  return o;
};
export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (!a.size || !b.size) return 0;
  let i = 0; for (const x of a) if (b.has(x)) i++;
  return i / (a.size + b.size - i);
}
export function tokenSet(a: string, b: string): number {
  const A = new Set(a.split(' ').filter(Boolean)), B = new Set(b.split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  let i = 0; for (const x of A) if (B.has(x)) i++;
  return (2 * i) / (A.size + B.size);
}
