import { useNavigate } from "react-router-dom";
import { Crown, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import Card from "../components/Card";
import Pill from "../components/Pill";
import Btn from "../components/Btn";
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
  const pct = Math.round((correct / answers.length) * 100);
  const scoreColor = pct >= 80 ? t.green : pct >= 50 ? t.gold : t.red;
  const isCustom = setRef.block === 0;

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
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-3" style={{ backgroundColor: t.surfaceAlt }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 19, fontWeight: 700, color: t.green }}>{correct}</div>
            <div style={{ fontSize: 11, color: t.textFaint }}>Correct</div>
          </div>
          <div className="rounded-2xl p-3" style={{ backgroundColor: t.surfaceAlt }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 19, fontWeight: 700, color: t.red }}>{answers.length - correct}</div>
            <div style={{ fontSize: 11, color: t.textFaint }}>Incorrect</div>
          </div>
        </div>
      </Card>
      <Card t={t}>
        <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Breakdown</h3>
        <div className="flex flex-col gap-2">
          {setRef.questions.map((q, i) => (
            <div key={i} className="flex items-center gap-2 text-sm" style={{ color: t.textMuted }}>
              {answers[i].correct ? <CheckCircle2 size={14} color={t.green} /> : <XCircle size={14} color={t.red} />}
              <span className="truncate">{q.q}</span>
            </div>
          ))}
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
          onClick={() => navigate(isCustom ? "/builder" : `/subjects/${setRef.subjectId}/${setRef.moduleId}/${setRef.block}`)}
        >
          Practice again
        </Btn>
      </div>
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
