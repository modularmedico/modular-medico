import { useEffect, useState } from "react";
import { Lock, Unlock, Loader2 } from "lucide-react";
import Card from "../Card";
import Spinner from "../Spinner";
import { THEME, FONT_DISPLAY } from "../../theme";
import { useAppStore } from "../../store/useAppStore";
import { subscribeAllTestSessions } from "../../services/testSessions";
import { subscribeFreeTests, saveFreeTests } from "../../services/adminContent";
import type { TestSessionDoc } from "../../types";

/**
 * Admin > Manage Access > "Free Tests (Paywall Control)".
 * Tap a test to make it free for everyone / paywalled again. Saves instantly.
 */
export default function FreeTestsManager() {
  const isDark = useAppStore((s) => s.isDark);
  const t = isDark ? THEME.dark : THEME.light;

  const [tests, setTests] = useState<TestSessionDoc[] | null>(null);
  const [freeIds, setFreeIds] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => subscribeAllTestSessions(setTests), []);
  useEffect(() => subscribeFreeTests(setFreeIds), []);

  const loading = tests === null || freeIds === null;

  const toggle = async (id: string) => {
    if (!freeIds) return;
    const prev = freeIds;
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    setFreeIds(next); // optimistic
    setSaving(true);
    setError("");
    try {
      await saveFreeTests(next);
    } catch (e) {
      console.error(e);
      setFreeIds(prev);
      setError("Could not save \u2014 check admin permissions");
    } finally {
      setSaving(false);
    }
  };

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
            Free Tests (Paywall Control)
          </h2>
          <p className="mt-1 text-xs" style={{ color: t.textMuted }}>
            Tap a Test to toggle whether it&rsquo;s free for everyone or requires Premium / a manual
            unlock. Changes apply instantly for every student.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 py-6 text-center">
          <Spinner t={t} size={20} label="Loading tests\u2026" />
        </div>
      ) : tests.length === 0 ? (
        <p className="mt-4 text-xs" style={{ color: t.textFaint }}>
          No tests yet. Create one in the Test Sessions tab.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {tests.map((test) => {
            const isFree = freeIds!.includes(test.id);
            return (
              <button
                key={test.id}
                onClick={() => toggle(test.id)}
                disabled={saving}
                title={
                  isFree
                    ? `${test.name} is free \u2014 tap to paywall it`
                    : `${test.name} is paywalled \u2014 tap to make it free`
                }
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all disabled:opacity-50"
                style={{
                  backgroundColor: isFree ? `${t.green}1f` : t.surfaceAlt,
                  border: `1.5px solid ${isFree ? t.green : t.border}`,
                  color: isFree ? t.green : t.textMuted,
                }}
              >
                {isFree ? <Unlock size={12} /> : <Lock size={12} />}
                {test.name}
                {test.status !== "published" && (
                  <span style={{ color: t.textFaint, fontWeight: 600 }}>(draft)</span>
                )}
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
