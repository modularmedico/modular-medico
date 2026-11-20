import { useEffect, useState } from "react";
import { Lock, Unlock, Loader2 } from "lucide-react";
import Card from "../Card";
import Spinner from "../Spinner";
import { THEME, FONT_DISPLAY } from "../../theme";
import { useAppStore } from "../../store/useAppStore";
import { subscribeAllMockTests } from "../../services/mockTests";
import { subscribeFreeMockTests, saveFreeMockTests } from "../../services/adminContent";
import type { MockTestDoc } from "../../types";

/**
 * Admin > Manage Access > "Free Mock Tests (Paywall Control)".
 * Tap a mock test to make it free for everyone / paywalled again. Saves instantly.
 * Until the first save, mocks follow their Block's free/paid setting (old behaviour), so the
 * first tap starts from that state instead of paywalling everything.
 */
export default function FreeMockTestsManager() {
  const isDark = useAppStore((s) => s.isDark);
  const freeBlocks = useAppStore((s) => s.freeBlocks);
  const t = isDark ? THEME.dark : THEME.light;

  const [mocks, setMocks] = useState<MockTestDoc[] | null>(null);
  const [savedIds, setSavedIds] = useState<string[] | null | undefined>(undefined); // undefined = loading
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => subscribeAllMockTests(setMocks), []);
  useEffect(() => subscribeFreeMockTests(setSavedIds), []);

  const loading = mocks === null || savedIds === undefined;

  // Effective free list: the saved one, or (before the first save) every mock whose Block is free.
  const effectiveFree = (): string[] =>
    savedIds ?? (mocks ?? []).filter((m) => freeBlocks.includes(m.block)).map((m) => m.id);

  const toggle = async (id: string) => {
    const prev = savedIds;
    const cur = effectiveFree();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    setSavedIds(next); // optimistic
    setSaving(true);
    setError("");
    try {
      await saveFreeMockTests(next);
    } catch (e) {
      console.error(e);
      setSavedIds(prev);
      setError("Could not save \u2014 check admin permissions");
    } finally {
      setSaving(false);
    }
  };

  const free = loading ? [] : effectiveFree();
  const blocks = Array.from(new Set((mocks ?? []).map((m) => m.block))).sort((a, b) => a - b);

  return (
    <Card t={t} style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}>
      <div className="flex items-start gap-3">
        {saving ? (
          <Loader2 size={18} className="animate-spin mt-0.5 shrink-0" color={t.purple} />
        ) : (
          <Unlock size={18} color={t.purple} className="mt-0.5 shrink-0" />
        )}
        <div className="flex-1">
          <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>
            Free Mock Tests (Paywall Control)
          </h2>
          <p className="mt-1 text-xs" style={{ color: t.textMuted }}>
            Tap a Mock Test to toggle whether it&rsquo;s free for everyone or requires Premium / a manual
            unlock. Changes apply instantly for every student.
            {savedIds === null && " Not saved yet \u2014 mocks currently follow their Block\u2019s free/paid setting."}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 py-6 text-center">
          <Spinner t={t} size={20} label="Loading mock tests…" />
        </div>
      ) : mocks.length === 0 ? (
        <p className="mt-4 text-xs" style={{ color: t.textFaint }}>
          No mock tests yet. Create one in the Mock Tests tab.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {blocks.map((b) => (
            <div key={b}>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                Block {b}
              </p>
              <div className="flex flex-wrap gap-2">
                {mocks
                  .filter((m) => m.block === b)
                  .map((m) => {
                    const isFree = free.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggle(m.id)}
                        disabled={saving}
                        title={
                          isFree
                            ? `${m.name} is free \u2014 tap to paywall it`
                            : `${m.name} is paywalled \u2014 tap to make it free`
                        }
                        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all disabled:opacity-50"
                        style={{
                          backgroundColor: isFree ? `${t.green}1f` : t.surfaceAlt,
                          border: `1.5px solid ${isFree ? t.green : t.border}`,
                          color: isFree ? t.green : t.textMuted,
                        }}
                      >
                        {isFree ? <Unlock size={12} /> : <Lock size={12} />}
                        {m.name}
                        {m.status !== "published" && (
                          <span style={{ color: t.textFaint, fontWeight: 600 }}>(draft)</span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
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
