import { useEffect, useState } from "react";
import { X, GraduationCap, Play, Loader2 } from "lucide-react";
import { THEME, FONT_DISPLAY, FONT_BODY } from "../theme";
import { useAppStore } from "../store/useAppStore";
import { MAX_COLLEGE_LEN, MAX_NAME_LEN, type Participant } from "../services/testLeaderboard";

interface Props {
  testName: string;
  /** Pre-filled values (last used, or the account name). */
  initial: Participant;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (p: Participant) => void;
}

/** Asks for the student's name and medical college before a test starts (not used for practice MCQs). */
export default function TestStartModal({ testName, initial, busy, onClose, onSubmit }: Props) {
  const isDark = useAppStore((s) => s.isDark);
  const t = isDark ? THEME.dark : THEME.light;
  const [name, setName] = useState(initial.name);
  const [college, setCollege] = useState(initial.college);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const nameOk = name.trim().length >= 2;
  const collegeOk = college.trim().length >= 2;

  const submit = () => {
    setTouched(true);
    if (!nameOk || !collegeOk || busy) return;
    onSubmit({ name: name.trim(), college: college.trim() });
  };

  const inputStyle = (bad: boolean) => ({
    backgroundColor: t.surfaceAlt,
    color: t.text,
    border: `1.5px solid ${bad ? t.red : t.border}`,
    fontFamily: FONT_BODY,
  });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(10,6,20,0.65)", backdropFilter: "blur(4px)" }}
      onClick={() => !busy && onClose()}
    >
      <form
        className="relative w-full max-w-sm rounded-3xl p-6 shadow-2xl"
        style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}`, fontFamily: FONT_BODY }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: t.surfaceAlt, color: t.textMuted }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: `${t.gold}22` }}>
          <GraduationCap size={26} color={t.gold} />
        </div>

        <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: t.text }}>Before you start</h2>
        <p className="mt-1.5 text-sm" style={{ color: t.textMuted }}>
          Your name and college appear on the leaderboard for <strong style={{ color: t.text }}>{testName}</strong>.
        </p>

        <label className="mt-4 block text-xs font-bold" style={{ color: t.textMuted }}>
          Your name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_NAME_LEN}
            autoFocus
            autoComplete="name"
            placeholder="e.g. Ayesha Khan"
            className="mt-1 w-full rounded-2xl px-3.5 py-3 text-sm font-semibold outline-none"
            style={inputStyle(touched && !nameOk)}
          />
        </label>

        <label className="mt-3 block text-xs font-bold" style={{ color: t.textMuted }}>
          Medical college
          <input
            value={college}
            onChange={(e) => setCollege(e.target.value)}
            maxLength={MAX_COLLEGE_LEN}
            placeholder="e.g. King Edward Medical University"
            className="mt-1 w-full rounded-2xl px-3.5 py-3 text-sm font-semibold outline-none"
            style={inputStyle(touched && !collegeOk)}
          />
        </label>

        {touched && (!nameOk || !collegeOk) && (
          <p className="mt-2 text-xs" style={{ color: t.red }}>
            Please enter both your name and your medical college.
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-extrabold disabled:opacity-60"
          style={{ backgroundColor: t.gold, color: "#241A08" }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Start test
        </button>
        <p className="mt-2 text-center text-[11px]" style={{ color: t.textFaint }}>
          The timer starts as soon as you tap Start.
        </p>
      </form>
    </div>
  );
}
