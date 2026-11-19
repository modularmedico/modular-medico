import { describe, expect, it } from 'vitest';
import { dedupe } from '../src/core/dedup';
import { parseRis } from '../src/core/parsers/ris';
import { authorKey, cleanDoi, normTitle } from '../src/core/normalize';
import type { Rec } from '../src/core/types';

const mk = (id: string, o: Partial<Rec>): Rec => ({ id, title: '', abstract: '', authors: [], journal: '', volume: '', issue: '', pages: '', doi: '', pmid: '', keywords: [], sourceDb: '', batch: 'b', raw: '', ...o });

describe('normalize', () => {
  it('cleans DOIs, titles, authors', () => {
    expect(cleanDoi('https://doi.org/10.1000/ABC.1.')).toBe('10.1000/abc.1');
    expect(normTitle('The <i>Café</i> Effect: A Study')).toBe('cafe effect study');
    expect(authorKey('Smith, John A.')).toBe('smith j');
    expect(authorKey('John A Smith')).toBe('smith j');
  });
});

describe('RIS parser', () => {
  it('parses records and reports skips', () => {
    const ris = 'TY  - JOUR\nTI  - Good paper\nAU  - Doe, Jane\nPY  - 2020/05/01\nSP  - 10\nEP  - 20\nDO  - https://doi.org/10.1000/x\nER  - \n\nTY  - JOUR\nAU  - No Title\nER  - \n';
    const { records, report } = parseRis(ris, 'b1');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ year: 2020, pages: '10-20', doi: '10.1000/x' });
    expect(report.skipped[0].reason).toBe('missing title');
  });
});

describe('dedupe precision/recall', () => {
  const base = { authors: ['Smith, John', 'Lee, Ann'], journal: 'Journal of Testing', year: 2020 };
  const recs = [
    mk('1', { ...base, title: 'Effects of exercise on sleep', doi: '10.1000/a' }),
    mk('2', { ...base, title: 'Effects of Exercise on Sleep.', doi: 'https://doi.org/10.1000/A' }),   // dup of 1 (DOI)
    mk('3', { ...base, title: 'Cognitive therapy for <b>anxiety</b> in adults' }),
    mk('4', { authors: ['John Smith', 'Ann Lee'], journal: 'J Testing', year: 2020, title: 'Cognitive Therapy for Anxiety in Adults' }), // dup of 3 (fuzzy)
    mk('5', { ...base, title: 'Cognitive therapy for anxiety in adults', year: 2010 }),            // same title, other year: separate
    mk('6', { ...base, title: 'Erratum: Effects of exercise on sleep' }),                           // erratum: separate
    mk('7', { authors: ['Khan, R'], journal: 'Other Journal', year: 2018, title: 'Soil carbon dynamics' }),
  ];
  const truth = new Set(['1|2', '3|4']);
  it('meets precision/recall', () => {
    const { clusters } = dedupe(recs);
    const found = new Set<string>();
    for (const c of clusters) for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) found.add([c[i], c[j]].sort().join('|'));
    const tp = [...found].filter(p => truth.has(p)).length;
    expect(tp / found.size).toBe(1);        // precision
    expect(tp / truth.size).toBe(1);        // recall
  });
  it('DOI conflict blocks auto-merge', () => {
    const r = dedupe([mk('a', { ...base, title: 'Same title here', doi: '10.1000/x' }), mk('b', { ...base, title: 'Same title here', doi: '10.1000/y' })]);
    expect(r.clusters.every(c => c.length === 1)).toBe(true);
  });
});
