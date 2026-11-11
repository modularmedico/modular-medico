import { PlayCircle, RotateCcw, X } from "lucide-react";
import { FONT_DISPLAY, type ThemeTokens } from "../theme";
import Btn from "./Btn";

interface Props {
  t: ThemeTokens;
  /** What is currently in progress, e.g. "Block 3 · Cardiovascular-I" */
  title: string;
  /** e.g. "Question 12 of 50" */
  progress: string;
  /** Label for the thing the student just picked, shown in the explanation line. */
  newLabel?: string;
  /** Text of the "start over" button. */
  startOverLabel?: string;
  /** Overrides the explanation line under the progress card. */
  description?: string;
  onContinue: () => void;
  onStartOver: () => void;
  onClose: () => void;
}

/**
 * The "do you want to start over or continue from where you left?" popup, shown when a student
 * picks something new while an earlier session/paper is still unfinished.
 */
export default function ResumeModal({ t, title, progress, newLabel, startOverLabel, description, onContinue, onStartOver, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-3xl p-5 sm:max-w-md sm:rounded-3xl"
        style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18 }}>Continue where you left off?</h3>
          <button onClick={onClose} aria-label="Close" style={{ color: t.textFaint }}>
            <X size={18} />
          </button>
        </div>
        <div className="mb-4 rounded-2xl p-3" style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}` }}>
          <div className="text-sm font-bold">{title}</div>
          <div className="mt-0.5 text-xs" style={{ color: t.textMuted }}>
            {progress}
          </div>
        </div>
        <p className="mb-4 text-sm" style={{ color: t.textMuted, lineHeight: 1.55 }}>
          {description ?? (
            <>
              You have an unfinished practice.{" "}
              {newLabel ? <>Starting <b>{newLabel}</b> will replace it.</> : "Starting something new will replace it."}
            </>
          )}
        </p>
        <div className="flex flex-col gap-2">
          <Btn t={t} full icon={PlayCircle} onClick={onContinue}>
            Continue from where I left
          </Btn>
          <Btn t={t} full variant="ghost" icon={RotateCcw} onClick={onStartOver}>
            {startOverLabel ?? "Start over with the new one"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
