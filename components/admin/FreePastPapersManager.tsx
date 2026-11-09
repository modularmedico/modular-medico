import { useEffect, useMemo, useState } from "react";
import { Lock, Unlock, Loader2, FileStack } from "lucide-react";
import Card from "../Card";
import Spinner from "../Spinner";
import { THEME, FONT_DISPLAY } from "../../theme";
import { useAppStore } from "../../store/useAppStore";
import { DEFAULT_BLOCK_DEFINITIONS } from "../../data/subjects";
import {
  subscribeBlockDefinitions,
  subscribeFreePastPapers,
  saveFreePastPapers,
  type FreePastPapersConfig,
} from "../../services/adminContent";
import { subscribeAllPastPapers } from "../../services/pastPapers";
import type { FirestorePastPaper } from "../../types";

/**
 * Admin > Manage Access > "Free Past Papers (Paywall Control)".
 *  - Tap a Block to make ALL of its past papers free / paywalled.
 *  - Pick a Block, then tap an individual paper to make just that one free even
 *    though its Block is paid. Saves instantly.
 * Until an admin saves for the first time, nothing is paywalled (all Blocks show as free).
 */
export default function FreePastPapersManager() {
  const isDark = useAppStore((s) => s.isDark);
  const t = isDark ? THEME.dark : THEME.light;

  const [blockDefs, setBlockDefs] = useState(DEFAULT_BLOCK_DEFINITIONS);
  const [papers, setPapers] = useState<FirestorePastPaper[] | null>(null);
  const [cfg, setCfg] = useState<FreePastPapersConfig | null | undefined>(undefined); // undefined = loading
  const [openBlock, setOpenBlock] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => subscribeBlockDefinitions(setBlockDefs), []);
  useEffect(() => subscribeAllPastPapers(setPapers), []);
  useEffect(() => subscribeFreePastPapers(setCfg), []);

  const loading = cfg === undefined || papers === null;
  const allBlocks = useMemo(() => blockDefs.map((b) => b.block), [blockDefs]);

  // Never configured -> every Block is currently open to everyone.
  const effective: FreePastPapersConfig = cfg ?? { blocks: allBlocks, ids: [] };

  const countByBlock = useMemo(() => {
    const m: Record<number, number> = {};
    (papers ?? []).forEach((p) => {
      m[p.block] = (m[p.block] || 0) + 1;
    });
    return m;
  }, [papers]);

  const persist = async (next: FreePastPapersConfig, prev: FreePastPapersConfig | null | undefined) => {
    setCfg(next); // optimistic
    setSaving(true);
    setError("");
    try {
      await saveFreePastPapers(next);
    } catch (e) {
      console.error(e);
      setCfg(prev);
      setError("Could not save \u2014 check admin permissions");
    } finally {
      setSaving(false);
    }
  };

  const toggleBlock = (b: number) => {
    if (loading) return;
    const blocks = effective.blocks.includes(b)
      ? effective.blocks.filter((x) => x !== b)
      : [...effective.blocks, b].sort((x, y) => x - y);
    persist({ ...effective, blocks }, cfg);
  };

  const togglePaper = (id: string) => {
    if (loading) return;
    const ids = effective.ids.includes(id) ? effective.ids.filter((x) => x !== id) : [...effective.ids, id];
    persist({ ...effective, ids }, cfg);
  };

  const papersInOpenBlock = useMemo(
    () =>
      (papers ?? [])
        .filter((p) => p.block === openBlock)
        .sort((a, b) => (a.topicName || "").localeCompare(b.topicName || "", undefined, { numeric: true })),
    [papers, openBlock]
  );
  const openBlockIsFree = openBlock !== null && effective.blocks.includes(openBlock);

  return (
    <Card t={t} style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}>
      <div className="flex items-start gap-3">
        {saving ? (
          <Loader2 size={18} className="animate-spin mt-0.5 shrink-0" color={t.purple} />
        ) : (
          <FileStack size={18} color={t.purple} className="mt-0.5 shrink-0" />
        )}
        <div className="flex-1">
          <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>
            Free Past Papers (Paywall Control)
          </h2>
          <p className="mt-1 text-xs" style={{ color: t.textMuted }}>
            Tap a Block to make all of its Past Papers free for everyone or paywalled (Premium / manual unlock).
            Use &ldquo;Papers&rdquo; to free up individual papers inside a paid Block. Changes apply instantly.
          </p>
          {cfg === null && !loading && (
            <p className="mt-1 text-xs font-semibold" style={{ color: t.gold }}>
              Not configured yet &mdash; every Past Paper is currently free. Tap a Block to paywall it.
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="mt-4 py-6 text-center">
          <Spinner t={t} size={20} label={"Loading Past Papers\u2026"} />
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {allBlocks.map((b) => {
              const isFree = effective.blocks.includes(b);
              const freeCount = (papers ?? []).filter((p) => p.block === b && effective.ids.includes(p.id)).length;
              return (
                <div key={b} className="flex flex-col items-stretch gap-1">
                  <button
                    onClick={() => toggleBlock(b)}
                    disabled={saving}
                    title={
                      isFree
                        ? `Block ${b} past papers are free \u2014 tap to paywall them`
                        : `Block ${b} past papers are paywalled \u2014 tap to make them free`
                    }
                    className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all disabled:opacity-50"
                    style={{
                      backgroundColor: isFree ? `${t.green}1f` : t.surfaceAlt,
                      border: `1.5px solid ${isFree ? t.green : t.border}`,
                      color: isFree ? t.green : t.textMuted,
                    }}
                  >
                    {isFree ? <Unlock size={12} /> : <Lock size={12} />}
                    Block {b}
                    <span style={{ color: t.textFaint, fontWeight: 600 }}>
                      ({countByBlock[b] || 0}
                      {!isFree && freeCount > 0 ? `, ${freeCount} free` : ""})
                    </span>
                  </button>
                  <button
                    onClick={() => setOpenBlock(openBlock === b ? null : b)}
                    className="text-[11px] font-semibold"
                    style={{ color: openBlock === b ? t.purple : t.textFaint }}
                  >
                    {openBlock === b ? "Hide papers" : "Papers"}
                  </button>
                </div>
              );
            })}
          </div>

          {openBlock !== null && (
            <div className="mt-4 rounded-xl p-3" style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}` }}>
              <p className="text-xs font-bold" style={{ color: t.text }}>
                Block {openBlock} &mdash; individual papers
              </p>
              {openBlockIsFree && (
                <p className="mt-1 text-[11px]" style={{ color: t.textMuted }}>
                  This Block is free, so all its papers are open. Paywall the Block above to pick individual free papers.
                </p>
              )}
              {papersInOpenBlock.length === 0 ? (
                <p className="mt-2 text-xs" style={{ color: t.textFaint }}>
                  No Past Papers in this Block yet.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {papersInOpenBlock.map((p) => {
                    const free = openBlockIsFree || effective.ids.includes(p.id);
                    const label = p.description || p.title;
                    return (
                      <button
                        key={p.id}
                        onClick={() => togglePaper(p.id)}
                        disabled={saving || openBlockIsFree}
                        title={
                          free
                            ? `${label} is free \u2014 tap to paywall it`
                            : `${label} is paywalled \u2014 tap to make it free`
                        }
                        className="flex max-w-full items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all disabled:opacity-60"
                        style={{
                          backgroundColor: free ? `${t.green}1f` : t.surface,
                          border: `1.5px solid ${free ? t.green : t.border}`,
                          color: free ? t.green : t.textMuted,
                        }}
                      >
                        {free ? <Unlock size={12} className="shrink-0" /> : <Lock size={12} className="shrink-0" />}
                        <span className="truncate">
                          {p.topicName ? `${p.topicName} \u00b7 ` : ""}
                          {label}
                        </span>
                        {p.status !== "published" && (
                          <span style={{ color: t.textFaint, fontWeight: 600 }}>(draft)</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {error && (
        <p className="mt-3 text-xs font-semibold" style={{ color: t.textMuted }}>
          {error}
        </p>
      )}
    </Card>
  );
}
