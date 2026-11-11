import { FlagOff } from "lucide-react";
import { FONT_DISPLAY, type ThemeTokens } from "../theme";

interface Props {
  t: ThemeTokens;
  open: boolean;
  answered: number;
  total: number;
  /** Shown in the title, e.g. "test", "paper". */
  noun?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation shown before ending a test / practice session early, so a stray tap can't
 * throw away a session. Unanswered questions are counted as not attempted on the results page.
 */
export default function EndTestModal({ t, open, answered, total, noun = "test", onConfirm, onCancel }: Props) {
  if (!open) return null;
  const left = Math.max(0, total - answered);
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={`End ${noun}`}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-5 shadow-2xl"
        style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}`, color: t.text }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <FlagOff size={18} color={t.red} />
          <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18 }}>End this {noun}?</h3>
        </div>
        <p className="mt-2 text-sm" style={{ color: t.textMuted }}>
          You've answered {answered} of {total}.
          {left > 0 ? ` The other ${left} will be counted as unanswered.` : ""} You'll go straight to your results.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl px-4 py-2.5 text-sm font-extrabold"
            style={{ backgroundColor: t.surfaceAlt, color: t.text, border: `1.5px solid ${t.border}` }}
          >
            Keep going
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-2xl px-4 py-2.5 text-sm font-extrabold"
            style={{ backgroundColor: t.red, color: "#fff", border: `1.5px solid ${t.red}` }}
          >
            End {noun}
          </button>
        </div>
      </div>
    </div>
  );
}
