import { describe, expect, it } from 'vitest';
import { parseAny } from '../src/core/parsers/detect';
import { dedupe } from '../src/core/dedup';
import { mergeGroup, undoMerge } from '../src/merge';
import { segments } from '../src/highlight';
import { SAMPLE } from '../src/sample';

describe('parsers', () => {
  it('CSV with quotes and TSV', () => {
    const { records } = parseAny('Title,Authors,Year,DOI\n"A, B and C",Doe J; Roe R,2021,10.1000/z\n', 'b', 's');
    expect(records[0]).toMatchObject({ title: 'A, B and C', year: 2021, doi: '10.1000/z' });
    expect(records[0].authors).toHaveLength(2);
    expect(parseAny('title\tyear\nX\t1999\n', 'b', 's').records[0].year).toBe(1999);
  });
  it('BibTeX', () => {
    const { records } = parseAny('@article{k, title={{Deep} Learning}, author={Doe, J and Roe, R}, year=2020, doi={10.1000/q}}', 'b', 's');
    expect(records[0]).toMatchObject({ title: 'Deep Learning', year: 2020 });
  });
});
describe('merge + undo', () => {
  it('merges sample duplicates and undoes', () => {
    const { records } = parseAny(SAMPLE, 'b', 's');
    const d = dedupe(records), c = d.clusters.filter(x => x.length > 1);
    expect(c.length).toBeGreaterThanOrEqual(1);
    const r = mergeGroup(records, c[0]);
    expect(r.recs.filter(x => x.mergedInto)).toHaveLength(c[0].length - 1);
    expect(undoMerge(r.recs, r.entry).filter(x => x.mergedInto)).toHaveLength(0);
  });
});
describe('highlight', () => {
  it('wildcards, phrases, case', () => {
    const s = segments('Randomised trial of systematic review; rats', 'random*, systematic review', 'rats', false);
    expect(s.filter(x => x.k === 'inc').map(x => x.t)).toEqual(['Randomised', 'systematic review']);
    expect(s.filter(x => x.k === 'exc')).toHaveLength(1);
    expect(segments('Rats', '', 'rats', true).some(x => x.k)).toBe(false);
  });
});
