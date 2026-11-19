import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { dedupe } from './core/dedup';
import { parseAny } from './core/parsers/detect';
import { byId, mergeGroup, rootOf, undoMerge } from './merge';
import { segments } from './highlight';
import { empty, load, save, type Project, type Verdict } from './store';
import type { Rec } from './core/types';
import { SAMPLE } from './sample';

type Upd = (f: (q: Project) => Project) => void;
type Tab = 'import' | 'dups' | 'screen' | 'table';
const active = (p: Project) => p.recs.filter(r => !r.mergedInto);

function download(name: string, rows: string[][]) {
  const q = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const b = new Blob(['\uFEFF' + rows.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click();
}
const Hl = ({ text, p }: { text: string; p: Project }) => (
  <>{segments(text, p.inc, p.exc, p.cs).map((s, i) => (s.k ? <mark key={i} className={s.k}>{s.t}</mark> : s.t))}</>
);
const hitCount = (r: Rec, p: Project) => {
  const s = segments(`${r.title}\n${r.abstract}`, p.inc, p.exc, p.cs);
  return { inc: s.filter(x => x.k === 'inc').length, exc: s.filter(x => x.k === 'exc').length };
};

export default function App() {
  const [p, setP] = useState<Project>(empty);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('import');
  useEffect(() => { load().then(x => { setP(x); setReady(true); }); }, []);
  useEffect(() => { if (!ready) return; const t = setTimeout(() => save(p), 400); return () => clearTimeout(t); }, [p, ready]);
  const upd: Upd = f => setP(f);
  const act = active(p), dec = (r: Rec) => p.decisions[r.id]?.v;
  const tabs: [Tab, string][] = [['import', 'Import'], ['dups', `Duplicates`], ['screen', 'Screen'], ['table', 'Table & export']];
  return (
    <main>
      <h1>OpenScreen</h1>
      <div className="muted">{p.recs.length} imported · {act.length} unique · {act.filter(r => dec(r)).length} screened · stored locally in your browser</div>
      <nav>{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</nav>
      {!ready ? <p>Loading…</p> : tab === 'import' ? <Import p={p} upd={upd} go={setTab} /> : tab === 'dups' ? <Dups p={p} upd={upd} /> : tab === 'screen' ? <Screen p={p} upd={upd} /> : <Table p={p} />}
    </main>
  );
}

function Import({ p, upd, go }: { p: Project; upd: Upd; go: (t: Tab) => void }) {
  const [msg, setMsg] = useState('');
  const add = (name: string, text: string, db: string) => {
    const batch = `${name}#${Date.now()}`, { records, report } = parseAny(text, batch, db || name);
    upd(q => ({ ...q, recs: [...q.recs, ...records], imports: [...q.imports, { name, parsed: report.parsed, skipped: report.skipped.length }] }));
    setMsg(m => `${m}${name}: ${report.parsed} parsed, ${report.skipped.length} skipped${report.skipped.map(s => ` [#${s.index} ${s.reason}]`).join('')}\n`);
  };
  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    for (const f of Array.from(e.target.files || [])) add(f.name, await f.text(), '');
    e.target.value = '';
  };
  return (
    <div className="card">
      <h2>Import references</h2>
      <p className="muted">RIS, BibTeX, CSV or TSV (format and columns are auto-detected). Nothing leaves your browser.</p>
      <div className="row">
        <input type="file" multiple accept=".ris,.bib,.csv,.tsv,.txt" onChange={onFiles} />
        <button onClick={() => add('sample.ris', SAMPLE, 'Sample')}>Load sample data</button>
        <button onClick={() => { if (confirm('Delete the whole project?')) upd(() => empty); }}>Clear project</button>
      </div>
      {msg && <pre style={{ whiteSpace: 'pre-wrap' }}>{msg}</pre>}
      {p.recs.length > 0 && <button className="pri" onClick={() => go('dups')}>Next: deduplicate →</button>}
    </div>
  );
}

function Diff({ a, b }: { a: Rec; b: Rec }) {
  const rows: [string, string, string][] = [
    ['Title', a.title, b.title], ['Authors', a.authors.join('; '), b.authors.join('; ')], ['Year', String(a.year ?? ''), String(b.year ?? '')],
    ['Journal', a.journal, b.journal], ['Vol/pp', `${a.volume} ${a.pages}`.trim(), `${b.volume} ${b.pages}`.trim()],
    ['DOI', a.doi, b.doi], ['Source', a.sourceDb, b.sourceDb], ['Abstract', a.abstract.slice(0, 250), b.abstract.slice(0, 250)],
  ];
  return <div className="diff">{rows.map(([l, x, y]) => [<b key={l}>{l}</b>, <div key={l + 'a'} className={x !== y ? 'd' : ''}>{x || '—'}</div>, <div key={l + 'b'} className={x !== y ? 'd' : ''}>{y || '—'}</div>])}</div>;
}

function Dups({ p, upd }: { p: Project; upd: Upd }) {
  const m = useMemo(() => byId(p.recs), [p.recs]);
  const queue = useMemo(() => {
    const seen = new Set<string>(), out: { a: Rec; b: Rec; k: string; score: number }[] = [];
    for (const x of p.pairs) {
      const a = rootOf(m, x.a), b = rootOf(m, x.b); if (!a || !b || a.id === b.id) continue;
      const k = [a.id, b.id].sort().join('|'); if (seen.has(k) || p.kept.includes(k)) continue;
      seen.add(k); out.push({ a, b, k, score: x.score });
    }
    return out.sort((x, y) => y.score - x.score);
  }, [p.pairs, p.kept, m]);
  const run = () => upd(q => {
    const d = dedupe(active(q), q.th); let recs = q.recs; const log = [...q.log];
    for (const c of d.clusters) if (c.length > 1) { const r = mergeGroup(recs, c); recs = r.recs; log.push(r.entry); }
    return { ...q, recs, log, pairs: d.pairs.filter(x => x.tier === 'possible') };
  });
  const th = (k: 'auto' | 'possible') => (e: ChangeEvent<HTMLInputElement>) => upd(q => ({ ...q, th: { ...q.th, [k]: +e.target.value } }));
  return (
    <>
      <div className="card">
        <h2>Deduplication</h2>
        <div className="row">
          <label>Auto-merge ≥ <input type="number" step="0.01" min="0" max="1" value={p.th.auto} onChange={th('auto')} style={{ width: 80 }} /></label>
          <label>Review ≥ <input type="number" step="0.01" min="0" max="1" value={p.th.possible} onChange={th('possible')} style={{ width: 80 }} /></label>
          <button className="pri" onClick={run}>Run deduplication</button>
          <button disabled={!p.log.length} onClick={() => upd(q => { const e = q.log[q.log.length - 1]; return { ...q, recs: undoMerge(q.recs, e), log: q.log.slice(0, -1) }; })}>Undo last merge ({p.log.length})</button>
        </div>
        <p className="muted">{p.recs.length - active(p).length} duplicates merged · {queue.length} possible duplicates to review</p>
      </div>
      {queue.map(({ a, b, k, score }) => (
        <div className="card" key={k}>
          <div className="row"><b>Possible duplicate · {score.toFixed(2)}</b></div>
          <Diff a={a} b={b} />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="pri" onClick={() => upd(q => { const r = mergeGroup(q.recs, [a.id, b.id]); return { ...q, recs: r.recs, log: [...q.log, r.entry] }; })}>Merge</button>
            <button onClick={() => upd(q => ({ ...q, kept: [...q.kept, k] }))}>Keep separate</button>
          </div>
        </div>
      ))}
    </>
  );
}

function Screen({ p, upd }: { p: Project; upd: Upd }) {
  const [onlyUn, setOnlyUn] = useState(true), [i, setI] = useState(0), [reason, setReason] = useState(''), [note, setNote] = useState('');
  const list = active(p).filter(r => !onlyUn || !p.decisions[r.id]);
  const idx = Math.min(i, list.length - 1), r = list[idx];
  useEffect(() => { const d = r && p.decisions[r.id]; setReason(d ? d.reason : ''); setNote(d ? d.note : ''); }, [r?.id]); // eslint-disable-line
  const go = (d: number) => setI(Math.max(0, Math.min(list.length - 1, idx + d)));
  const decide = (v: Verdict) => { if (!r) return; upd(q => ({ ...q, decisions: { ...q.decisions, [r.id]: { v, reason, note, t: Date.now() } } })); if (!onlyUn) go(1); };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName) || e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (k === 'i') decide('include'); else if (k === 'e') decide('exclude'); else if (k === 'm') decide('maybe');
      else if (k === 'arrowright' || k === 'j') go(1); else if (k === 'arrowleft' || k === 'k') go(-1);
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  });
  const hc = r ? hitCount(r, p) : { inc: 0, exc: 0 }, cur = r && p.decisions[r.id];
  return (
    <>
      <details className="card"><summary>Keywords (green = include, red = exclude)</summary>
        <p className="muted">One per line or comma-separated. Phrases and wildcards work: <code>random*</code></p>
        <div className="row" style={{ alignItems: 'stretch' }}>
          <textarea rows={4} placeholder="Include keywords" value={p.inc} onChange={e => upd(q => ({ ...q, inc: e.target.value }))} />
          <textarea rows={4} placeholder="Exclude keywords" value={p.exc} onChange={e => upd(q => ({ ...q, exc: e.target.value }))} />
        </div>
        <label><input type="checkbox" checked={p.cs} onChange={e => upd(q => ({ ...q, cs: e.target.checked }))} /> Case-sensitive</label>
      </details>
      <div className="row"><label><input type="checkbox" checked={onlyUn} onChange={e => setOnlyUn(e.target.checked)} /> Undecided only</label>
        <span className="muted">{list.length ? `${idx + 1} / ${list.length}` : ''} · keys: I include, E exclude, M maybe, ←/→ navigate</span></div>
      {!r ? <div className="card">{p.recs.length ? 'Nothing left to screen 🎉' : 'Import records first.'}</div> : (
        <div className="card">
          <h2><Hl text={r.title} p={p} /></h2>
          <div className="muted">{r.authors.slice(0, 6).join('; ')}{r.authors.length > 6 ? ' et al.' : ''} · {r.year} · {r.journal} {r.doi && <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer">DOI</a>}</div>
          <p><Hl text={r.abstract || '(no abstract)'} p={p} /></p>
          <div className="muted"><mark className="inc">{hc.inc} include hits</mark> <mark className="exc">{hc.exc} exclude hits</mark>{r.sources && r.sources.length > 1 ? ` · ${r.sources.length} sources merged` : ''}{cur ? ` · current: ${cur.v}` : ''}</div>
          <div className="row"><input style={{ flex: 1 }} placeholder="Exclusion reason" value={reason} onChange={e => setReason(e.target.value)} /></div>
          <textarea rows={2} placeholder="Notes" value={note} onChange={e => setNote(e.target.value)} style={{ marginTop: 6 }} />
          <div className="row big" style={{ marginTop: 8 }}>
            <button className="b-include" onClick={() => decide('include')}>Include (I)</button>
            <button className="b-maybe" onClick={() => decide('maybe')}>Maybe (M)</button>
            <button className="b-exclude" onClick={() => decide('exclude')}>Exclude (E)</button>
          </div>
          <div className="row" style={{ marginTop: 8 }}><button onClick={() => go(-1)}>← Prev</button><button onClick={() => go(1)}>Next →</button></div>
        </div>
      )}
    </>
  );
}

function Table({ p }: { p: Project }) {
  const [q, setQ] = useState(''), [f, setF] = useState('all'), [sort, setSort] = useState<{ k: string; d: 1 | -1 }>({ k: 'title', d: 1 }), [page, setPage] = useState(0);
  const m = useMemo(() => byId(p.recs), [p.recs]);
  const rows = useMemo(() => {
    const val = (r: Rec, k: string): string | number => k === 'year' ? r.year ?? 0 : k === 'decision' ? p.decisions[r.id]?.v ?? '' : k === 'hits' ? hitCount(r, p).inc : k === 'journal' ? r.journal : r.title;
    return active(p).filter(r => (f === 'all' || (p.decisions[r.id]?.v ?? 'undecided') === f) && (!q || `${r.title} ${r.authors.join(' ')} ${r.doi}`.toLowerCase().includes(q.toLowerCase())))
      .sort((a, b) => (val(a, sort.k) > val(b, sort.k) ? 1 : -1) * sort.d);
  }, [p, q, f, sort]);
  const act = active(p), n = (v: string) => act.filter(r => p.decisions[r.id]?.v === v).length;
  const merged = p.recs.filter(r => r.mergedInto);
  const row = (r: Rec) => [r.title, r.authors.join('; '), r.year ?? '', r.journal, r.doi, r.sourceDb, (r.sources || []).join(' | '), p.decisions[r.id]?.v ?? '', p.decisions[r.id]?.reason ?? '', p.decisions[r.id]?.note ?? ''];
  const H = ['Title', 'Authors', 'Year', 'Journal', 'DOI', 'Source', 'All sources', 'Decision', 'Reason', 'Notes'];
  const th = (k: string, l: string) => <th onClick={() => setSort(s => ({ k, d: s.k === k ? (-s.d as 1 | -1) : 1 }))}>{l}{sort.k === k ? (sort.d > 0 ? ' ▲' : ' ▼') : ''}</th>;
  return (
    <>
      <div className="card">
        <h2>PRISMA counts</h2>
        <div>Identified {p.recs.length} → duplicates removed {merged.length} → screened {act.length} → included {n('include')}, excluded {n('exclude')}, maybe {n('maybe')}, undecided {act.length - n('include') - n('exclude') - n('maybe')}</div>
        <div className="row" style={{ marginTop: 8 }}>
          <button onClick={() => download('deduplicated.csv', [H.slice(0, 7), ...act.map(r => row(r).slice(0, 7).map(String))])}>Export deduplicated CSV</button>
          <button onClick={() => download('screened.csv', [H, ...act.map(r => row(r).map(String))])}>Export screened CSV</button>
          <button onClick={() => download('duplicates-report.csv', [['Removed title', 'DOI', 'Merged into'], ...merged.map(r => [r.title, r.doi, rootOf(m, r.id)?.title ?? ''])])}>Duplicates report</button>
          <button onClick={() => download('prisma.csv', [['Stage', 'Count'], ['Identified', String(p.recs.length)], ['Duplicates removed', String(merged.length)], ['Screened', String(act.length)], ['Included', String(n('include'))], ['Excluded', String(n('exclude'))], ['Maybe', String(n('maybe'))]])}>PRISMA CSV</button>
        </div>
      </div>
      <div className="row"><input placeholder="Search title, author, DOI" value={q} onChange={e => { setQ(e.target.value); setPage(0); }} />
        <select value={f} onChange={e => { setF(e.target.value); setPage(0); }}>{['all', 'undecided', 'include', 'exclude', 'maybe'].map(x => <option key={x}>{x}</option>)}</select>
        <span className="muted">{rows.length} records</span></div>
      <div className="scroll"><table><thead><tr>{th('title', 'Title')}<th>Authors</th>{th('year', 'Year')}{th('journal', 'Journal')}<th>DOI</th><th>Source</th>{th('decision', 'Decision')}{th('hits', 'Hits')}</tr></thead>
        <tbody>{rows.slice(page * 100, page * 100 + 100).map(r => { const h = hitCount(r, p); return (
          <tr key={r.id}><td>{r.title}</td><td>{r.authors.slice(0, 2).join('; ')}{r.authors.length > 2 ? ' …' : ''}</td><td>{r.year}</td><td>{r.journal}</td>
            <td>{r.doi && <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer">{r.doi}</a>}</td><td>{(r.sources || [r.sourceDb]).join(', ')}</td>
            <td>{p.decisions[r.id]?.v ?? '—'}</td><td><mark className="inc">{h.inc}</mark> <mark className="exc">{h.exc}</mark></td></tr>); })}</tbody></table></div>
      <div className="row"><button disabled={!page} onClick={() => setPage(page - 1)}>Prev</button><button disabled={(page + 1) * 100 >= rows.length} onClick={() => setPage(page + 1)}>Next</button></div>
    </>
  );
}
