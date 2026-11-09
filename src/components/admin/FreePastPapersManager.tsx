import { useEffect, useState } from "react";
import { Lock, Unlock, Loader2, FileStack } from "lucide-react";
import Card from "../Card";
import Spinner from "../Spinner";
import { THEME, FONT_DISPLAY } from "../../theme";
import { useAppStore } from "../../store/useAppStore";
import { TOTAL_BLOCKS } from "../../data/subjects";
import { subscribeFreePaperBlocks, saveFreePaperBlocks } from "../../services/adminContent";

/**
 * Admin > Manage Access > "Free Past Papers (Paywall Control)".
 * Tap a Block to make its Past Papers free for everyone / paywalled again.
 * Saves instantly. Until the first save, every Block is free (old behavior).
 */
export default function FreePastPapersManager() {
  const isDark = useAppStore((s) => s.isDark);
  const t = isDark ? THEME.dark : THEME.light;
  const storeSet = useAppStore((s) => s.setFreePaperBlocks);

  const [freeBlocks, setFreeBlocks] = useState<number[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => subscribeFreePaperBlocks(setFreeBlocks), []);

  const toggle = async (block: number) => {
    if (!freeBlocks) return;
    const prev = freeBlocks;
    const next = prev.includes(block)
      ? prev.filter((b) => b !== block)
      : [...prev, block].sort((a, b) => a - b);
    setFreeBlocks(next); // optimistic
    setSaving(true);
    setError("");
    try {
      await saveFreePaperBlocks(next);
      storeSet(next);
    } catch (e) {
      console.error(e);
      setFreeBlocks(prev);
      setError("Could not save \u2014 check admin permissions");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card t={t} style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}>
      <div className="flex items-start gap-3">
        {saving || freeBlocks === null ? (
          <Loader2 size={18} className="animate-spin mt-0.5 shrink-0" color={t.gold} />
        ) : (
          <FileStack size={18} color={t.gold} className="mt-0.5 shrink-0" />
        )}
        <div className="flex-1">
          <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>
            Free Past Papers (Paywall Control)
          </h2>
          <p className="mt-1 text-xs" style={{ color: t.textMuted }}>
            Tap a Block to toggle whether its Past Papers are free for everyone or require Premium /
            a manual unlock. Changes apply instantly for every student. All Blocks are free until you
            lock one.
          </p>
        </div>
      </div>

      {freeBlocks === null ? (
        <div className="mt-4 py-6 text-center">
          <Spinner t={t} size={20} label={"Loading past paper settings\u2026"} />
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: TOTAL_BLOCKS }, (_, i) => i + 1).map((b) => {
            const isFree = freeBlocks.includes(b);
            return (
              <button
                key={b}
                onClick={() => toggle(b)}
                disabled={saving}
                title={
                  isFree
                    ? `Block ${b} past papers are free \u2014 tap to paywall them`
                    : `Block ${b} past papers are paywalled \u2014 tap to make them free`
                }
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all disabled:opacity-50"
                style={{
                  backgroundColor: isFree ? `${t.green}1f` : t.surfaceAlt,
                  border: `1.5px solid ${isFree ? t.green : t.border}`,
                  color: isFree ? t.green : t.textMuted,
                }}
              >
                {isFree ? <Unlock size={12} /> : <Lock size={12} />}
                Block {b}
              </button>
            );
          })}
        </div>
      )}
      {error && (
        <p className="mt-3 text-xs font-semibold" style={{ color: t.textMuted }}>
          {error}
        </p>
      )}
    </Card>
  );
}
