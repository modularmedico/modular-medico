import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, CheckCircle2, XCircle, RotateCcw, Trophy, ChevronDown } from "lucide-react";
import Card from "../components/Card";
import Pill from "../components/Pill";
import Btn from "../components/Btn";
import AiExplain from "../components/AiExplain";
import { THEME, FONT_DISPLAY, FONT_MONO } from "../theme";
import { useAppStore, useIsLoggedIn, useIsPremium } from "../store/useAppStore";
import { SUBJECT_META } from "../data/subjects";

export default function Results() {
  const navigate = useNavigate();
  const isDark = useAppStore((s) => s.isDark);
  const isLoggedIn = useIsLoggedIn();
  const isPremium = useIsPremium();
  const lastResult = useAppStore((s) => s.lastResult);
  const t = isDark ? THEME.dark : THEME.light;
  const [openQ, setOpenQ] = useState<number | null>(null);

  if (!lastResult) {
    return (
      <div className="py-16 text-center">
        <p style={{ color: t.textMuted }}>No recent results to show.</p>
        <button onClick={() => navigate("/subjects")} className="mt-3 text-sm font-bold" style={{ color: t.teal }}>
          Practice a block
        </button>
      </div>
    );
  }

  const { setRef, answers } = lastResult;
  const correct = answers.filter((a) => a.correct).length;
  const skipped = answers.filter((a) => !a.correct && a.selected === null).length;
  const incorrect = answers.length - correct - skipped;
  const pct = Math.round((correct / answers.length) * 100);
  const scoreColor = pct >= 80 ? t.green : pct >= 50 ? t.gold : t.red;
  const isCustom = setRef.block === 0;
  const isTest = setRef.moduleId.startsWith("test-");

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="text-center">
        <Pill t={t} tone="muted">
          {SUBJECT_META[setRef.subjectId as keyof typeof SUBJECT_META]?.label || "Quiz"} &bull; {setRef.moduleName}
        </Pill>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, marginTop: 10 }}>{setRef.setTitle} \u2014 complete</h1>
      </div>
      <Card t={t} style={{ textAlign: "center", padding: 32 }}>
        <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 54, color: scoreColor, lineHeight: 1 }}>{pct}%</div>
        <p style={{ color: t.textMuted, fontSize: 13, marginTop: 6 }}>
          {correct} of {answers.length} correct
        </p>
        <div className={`mt-6 grid gap-3 ${skipped > 0 ? "grid-cols-3" : "grid-cols-2"}`}>
          <div className="rounded-2xl p-3" style={{ backgroundColor: t.surfaceAlt }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 19, fontWeight: 700, color: t.green }}>{correct}</div>
            <div style={{ fontSize: 11, color: t.textFaint }}>Correct</div>
          </div>
          <div className="rounded-2xl p-3" style={{ backgroundColor: t.surfaceAlt }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 19, fontWeight: 700, color: t.red }}>{incorrect}</div>
            <div style={{ fontSize: 11, color: t.textFaint }}>Incorrect</div>
          </div>
          {skipped > 0 && (
            <div className="rounded-2xl p-3" style={{ backgroundColor: t.surfaceAlt }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 19, fontWeight: 700, color: t.textFaint }}>{skipped}</div>
              <div style={{ fontSize: 11, color: t.textFaint }}>Skipped</div>
            </div>
          )}
        </div>
      </Card>
      <Card t={t}>
        <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Breakdown</h3>
        <div className="flex flex-col gap-2">
          {setRef.questions.map((q, i) => {
            const a = answers[i];
            const wasSkipped = !a.correct && a.selected === null;
            const isOpen = isTest && openQ === i;
            return (
              <div key={i}>
                {/* Test sessions: tap a question to review it and ask the AI tutor */}
                <button
                  type="button"
                  disabled={!isTest}
                  onClick={() => setOpenQ(isOpen ? null : i)}
                  className="flex w-full items-center gap-2 text-left text-sm"
                  style={{ color: t.textMuted, cursor: isTest ? "pointer" : "default" }}
                >
                  {a.correct ? (
                    <CheckCircle2 size={14} color={t.green} className="shrink-0" />
                  ) : wasSkipped ? (
                    <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-dashed" style={{ borderColor: t.textFaint }} />
                  ) : (
                    <XCircle size={14} color={t.red} className="shrink-0" />
                  )}
                  <span className={isOpen ? "" : "truncate"}>{q.q}</span>
                  {wasSkipped && <span className="shrink-0 text-xs" style={{ color: t.textFaint }}>Skipped</span>}
                  {isTest && (
                    <ChevronDown
                      size={14}
                      className="ml-auto shrink-0"
                      style={{ transform: isOpen ? "rotate(180deg)" : undefined, transition: "transform 120ms" }}
                    />
                  )}
                </button>

                {isOpen && (
                  <div className="mt-2 flex flex-col gap-1.5 rounded-2xl p-3" style={{ backgroundColor: t.surfaceAlt }}>
                    {q.options.map((opt, oi) => {
                      const isCorrectOpt = oi === q.correct;
                      const isPicked = a.selected === oi;
                      return (
                        <div
                          key={oi}
                          className="flex gap-2 text-xs"
                          style={{ color: isCorrectOpt ? t.green : isPicked ? t.red : t.textMuted, fontWeight: isCorrectOpt || isPicked ? 700 : 500 }}
                        >
                          <span style={{ fontFamily: FONT_MONO }}>{String.fromCharCode(65 + oi)}.</span>
                          <span>
                            {opt}
                            {isCorrectOpt && " \u2713"}
                            {isPicked && !isCorrectOpt && " (your answer)"}
                          </span>
                        </div>
                      );
                    })}
                    {q.explanation && (
                      <p className="mt-1 text-xs" style={{ color: t.textMuted, lineHeight: 1.6 }}>
                        {q.explanation}
                      </p>
                    )}
                    <div className="mt-1">
                      <AiExplain question={q.q} options={q.options} correct={q.correct} selected={a.selected} explanation={q.explanation} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
      <div className="flex gap-3">
        <Btn t={t} variant="ghost" full onClick={() => navigate("/subjects")}>
          Subjects
        </Btn>
        <Btn
          t={t}
          full
          icon={RotateCcw}
          onClick={() =>
            navigate(isTest ? "/tests" : isCustom ? "/builder" : `/subjects/${setRef.subjectId}/${setRef.moduleId}/${setRef.block}`)
          }
        >
          {isTest ? "Back to tests" : "Practice again"}
        </Btn>
      </div>
      {isTest && (
        <Btn
          t={t}
          variant="ghost"
          full
          icon={Trophy}
          onClick={() => navigate(`/tests?tab=leaderboard&test=${setRef.moduleId.slice("test-".length)}`)}
        >
          View leaderboard
        </Btn>
      )}
      {isLoggedIn && !isPremium && (
        <Card t={t} style={{ borderColor: t.gold }}>
          <div className="mb-2 flex items-center gap-2">
            <Crown size={15} color={t.gold} />
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14 }}>Keep the momentum going</span>
          </div>
          <p className="mb-4 text-sm" style={{ color: t.textMuted }}>
            Premium unlocks every block in every subject, plus spaced repetition across your whole history.
          </p>
          <Btn t={t} full icon={Crown} onClick={() => navigate("/paywall")}>
            See Premium plans
          </Btn>
        </Card>
      )}
      {!isLoggedIn && (
        <Card t={t} style={{ borderColor: t.gold }}>
          <div className="mb-2 flex items-center gap-2">
            <Crown size={15} color={t.gold} />
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14 }}>Save this progress</span>
          </div>
          <p className="mb-4 text-sm" style={{ color: t.textMuted }}>
            Create a free account to track streaks, save bookmarks, and sync progress across devices.
          </p>
          <Btn t={t} full onClick={() => navigate("/signup")}>
            Create free account
          </Btn>
        </Card>
      )}
    </div>
  );
}
