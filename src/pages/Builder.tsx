import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Wand2, Lock, Loader2 } from "lucide-react";
import Card from "../components/Card";
import Pill from "../components/Pill";
import Btn from "../components/Btn";
import Toggle from "../components/Toggle";
import { THEME, FONT_DISPLAY, FONT_MONO } from "../theme";
import { useAppStore, useIsLoggedIn, useIsPremium } from "../store/useAppStore";
import { SUBJECT_LIST, SUBJECT_META } from "../data/subjects";
import { db } from "../firebase";
import { DEFAULT_QUESTIONS } from "../data/defaultCurriculum";
import { useStartGuard } from "../hooks/useStartGuard";
import type { FirestoreQuestion, PracticeConfig } from "../types";

export default function Builder() {
  const navigate = useNavigate();
  const isDark = useAppStore((s) => s.isDark);
  const startSession = useAppStore((s) => s.startSession);
  const { guard, modal } = useStartGuard();
  const isLoggedIn = useIsLoggedIn();
  const isPremium = useIsPremium();
  const t = isDark ? THEME.dark : THEME.light;

  const [picked, setPicked] = useState<string[]>([SUBJECT_LIST[0]]);
  const [count, setCount] = useState(5);
  const [timeLimit, setTimeLimit] = useState(false);
  const [pool, setPool] = useState<FirestoreQuestion[]>([]);
  const [loading, setLoading] = useState(false);

  const togglePick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  useEffect(() => {
    if (picked.length === 0) {
      setPool([]);
      return;
    }
    setLoading(true);
    const q = query(collection(db, "questions"), where("subjectId", "in", picked.slice(0, 10)), where("status", "==", "published"));
    getDocs(q)
      .then((snap) => {
        const fsQuestions = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FirestoreQuestion, "id">) }));
        const defQuestions = DEFAULT_QUESTIONS.filter((dq) => picked.includes(dq.subjectId) && dq.status === "published");
        const combined = [...fsQuestions];
        const existingIds = new Set(fsQuestions.map((x) => x.q.trim().toLowerCase()));
        defQuestions.forEach((dq) => {
          if (!existingIds.has(dq.q.trim().toLowerCase())) {
            combined.push(dq);
          }
        });
        setPool(combined);
      })
      .catch((err) => {
        console.warn("Firestore builder pool fallback:", err);
        setPool(DEFAULT_QUESTIONS.filter((dq) => picked.includes(dq.subjectId) && dq.status === "published"));
      })
      .finally(() => setLoading(false));
  }, [picked]);

  const available = useMemo(() => pool, [pool]);

  const generate = () => {
    if (!isPremium || available.length === 0) return;
    const shuffled = [...available].sort(() => Math.random() - 0.5).slice(0, count);
    const config: PracticeConfig = { mode: "traditional", timing: timeLimit ? "timed" : "untimed", spacedRep: true, difficultyFilter: "all" };
    guard(() => {
      startSession(
        {
          subjectId: picked[0] || SUBJECT_LIST[0],
          moduleId: "custom",
          moduleName: "Custom quiz",
          block: 0,
          setTitle: "Custom quiz",
          questions: shuffled.map((q) => ({ q: q.q, options: q.options, correct: q.correct, explanation: q.explanation })),
        },
        config
      );
      navigate("/practice");
    }, "a custom quiz");
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26 }}>Build a custom quiz</h1>
        <p style={{ color: t.textMuted, fontSize: 14, marginTop: 2 }}>Mix subjects, set a length, generate. Premium feature.</p>
      </div>

      {!isPremium && (
        <Card t={t} style={{ borderColor: t.gold }}>
          <div className="mb-2 flex items-center gap-2">
            <Lock size={15} color={t.gold} />
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14 }}>Premium feature</span>
          </div>
          <p className="mb-4 text-sm" style={{ color: t.textMuted }}>The custom quiz builder is part of Premium.</p>
          <Btn t={t} full onClick={() => navigate(isLoggedIn ? "/paywall" : "/signup")}>
            {isLoggedIn ? "Upgrade to Premium" : "Create free account"}
          </Btn>
        </Card>
      )}

      <Card t={t} style={!isPremium ? { opacity: 0.5, pointerEvents: "none" } : {}}>
        <span className="mb-3 block text-xs font-bold uppercase tracking-wide" style={{ color: t.textFaint }}>
          Subjects
        </span>
        <div className="flex flex-wrap gap-2">
          {SUBJECT_LIST.map((id, i) => (
            <Pill key={id} t={t} tone={t.chip[i % t.chip.length]} active={picked.includes(id)} onClick={() => togglePick(id)}>
              {SUBJECT_META[id].label}
            </Pill>
          ))}
        </div>
      </Card>

      <Card t={t} className="flex flex-col gap-5" style={!isPremium ? { opacity: 0.5, pointerEvents: "none" } : {}}>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: t.textFaint }}>
              Question count
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 13 }}>{count}</span>
          </div>
          <input
            type="range"
            min={3}
            max={Math.max(3, available.length || 3)}
            value={Math.min(count, Math.max(3, available.length))}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-full"
            style={{ ["--track-color" as string]: t.surfaceAlt, ["--thumb-color" as string]: t.gold, ["--thumb-border" as string]: t.bg }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">Time limit</span>
          <Toggle t={t} checked={timeLimit} onChange={setTimeLimit} />
        </div>
        <p className="text-xs" style={{ color: t.textFaint }}>
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> Loading published questions&hellip;
            </span>
          ) : (
            `${available.length} published question${available.length !== 1 ? "s" : ""} available from your selection.`
          )}
        </p>
      </Card>

      <Btn t={t} full icon={loading ? Loader2 : Wand2} spin={loading} disabled={!isPremium || available.length === 0 || loading} onClick={generate}>
        Generate quiz
      </Btn>
      {modal}
    </div>
  );
}
