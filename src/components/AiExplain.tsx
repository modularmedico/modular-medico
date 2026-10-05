import { useState } from "react";
import { Sparkles, ChevronDown, X as CloseIcon, MessageCircleQuestion, Lightbulb, Brain, Microscope } from "lucide-react";
import Spinner from "./Spinner";
import { THEME, FONT_DISPLAY } from "../theme";
import { useAppStore } from "../store/useAppStore";

type AiMode = "simple" | "analogy" | "mnemonic" | "depth";

const AI_MODE_OPTIONS: { mode: AiMode; label: string; icon: typeof Sparkles }[] = [
  { mode: "simple", label: "Explain in Simple words", icon: MessageCircleQuestion },
  { mode: "analogy", label: "Explain with analogy", icon: Lightbulb },
  { mode: "mnemonic", label: "Make mnemonics", icon: Brain },
  { mode: "depth", label: "In Depth Explanation", icon: Microscope },
];

interface Props {
  question: string;
  options: string[];
  correct: number;
  /** Option index the student picked (null = skipped). */
  selected: number | null;
  explanation?: string;
}

/** "Ask AI" menu + explanation sheet for one MCQ, backed by /api/ai-explain. */
export default function AiExplain({ question, options, correct, selected, explanation }: Props) {
  const isDark = useAppStore((s) => s.isDark);
  const t = isDark ? THEME.dark : THEME.light;
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<AiMode | null>(null);
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = async (m: AiMode) => {
    setMenuOpen(false);
    setMode(m);
    setLoading(true);
    setAnswer(null);
    setError(null);
    try {
      const res = await fetch("/api/ai-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          options,
          correctAnswer: options[correct],
          userAnswer: selected !== null ? options[selected] : null,
          explanation,
          mode: m,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data?.error || "Couldn't get an AI explanation right now. Please try again.");
      else setAnswer(data.answer);
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setMode(null);
    setAnswer(null);
    setError(null);
    setLoading(false);
  };

  const current = mode ? AI_MODE_OPTIONS.find((o) => o.mode === mode) : null;

  return (
    <>
      <div className="relative inline-block">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
          style={{ backgroundColor: `${t.teal}1A`, color: t.teal }}
        >
          <Sparkles size={13} /> Ask AI
          <ChevronDown size={13} style={{ transform: menuOpen ? "rotate(180deg)" : undefined, transition: "transform 120ms" }} />
        </button>
        {menuOpen && (
          <div
            className="absolute left-0 top-full z-30 mt-1.5 w-60 overflow-hidden rounded-2xl shadow-lg"
            style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}
          >
            {AI_MODE_OPTIONS.map(({ mode: m, label, icon: Icon }) => (
              <button
                key={m}
                onClick={() => ask(m)}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-bold hover:opacity-80"
                style={{ color: t.text, borderBottom: `1px solid ${t.border}` }}
              >
                <Icon size={15} color={t.teal} /> {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {mode && current && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 md:items-center md:p-4" onClick={close}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] w-full overflow-y-auto rounded-t-3xl p-5 md:max-w-lg md:rounded-3xl"
            style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <current.icon size={17} color={t.teal} />
                <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>{current.label}</span>
              </div>
              <button onClick={close} style={{ color: t.textFaint }} aria-label="Close">
                <CloseIcon size={18} />
              </button>
            </div>

            {loading && <Spinner t={t} label={"Asking the AI tutor\u2026"} className="py-8" />}

            {!loading && error && (
              <div>
                <p style={{ color: t.red, fontSize: 13.5, lineHeight: 1.6 }}>{error}</p>
                <button onClick={() => ask(mode)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: t.teal }}>
                  <Sparkles size={13} /> Try again
                </button>
              </div>
            )}

            {!loading && !error && answer && (
              <p style={{ color: t.textMuted, fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{answer}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
