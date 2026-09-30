import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Clock, HelpCircle, Play, Loader2 } from "lucide-react";
import Card from "../components/Card";
import Pill from "../components/Pill";
import Btn from "../components/Btn";
import { THEME, FONT_DISPLAY, FONT_MONO } from "../theme";
import { useAppStore } from "../store/useAppStore";
import { subscribePublishedTestSessions } from "../services/testSessions";
import type { PracticeConfig, TestSessionDoc } from "../types";

export default function Tests() {
  const navigate = useNavigate();
  const isDark = useAppStore((s) => s.isDark);
  const startSession = useAppStore((s) => s.startSession);
  const t = isDark ? THEME.dark : THEME.light;

  const [tests, setTests] = useState<TestSessionDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      subscribePublishedTestSessions(
        (list) => {
          setTests(list.filter((x) => x.questions.length > 0));
          setLoading(false);
        },
        () => setLoading(false)
      ),
    []
  );

  const start = (test: TestSessionDoc) => {
    // Runs in the existing Mock Exam mode: OMR-style answering, strict countdown
    // (1 minute per MCQ), answers locked until you finish.
    const config: PracticeConfig = {
      mode: "exam",
      timing: "timed",
      spacedRep: false,
      difficultyFilter: "all",
    };
    startSession(
      {
        subjectId: "all",
        moduleId: `test-${test.id}`,
        moduleName: "Test Session",
        block: 0,
        setTitle: test.name,
        questions: test.questions.map((q) => ({
          q: q.q,
          options: q.options,
          correct: q.correct,
          explanation: q.explanation,
        })),
      },
      config
    );
    navigate("/practice");
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26 }}>Test Sessions</h1>
        <p style={{ color: t.textMuted, fontSize: 14, marginTop: 2 }}>
          Timed exam-style tests curated by our faculty. Pick one and join in.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm" style={{ color: t.textMuted }}>
          <Loader2 size={16} className="animate-spin" /> Loading tests&hellip;
        </div>
      ) : tests.length === 0 ? (
        <Card t={t} style={{ textAlign: "center", padding: 32 }}>
          <ClipboardList size={28} color={t.textFaint} style={{ margin: "0 auto 10px" }} />
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 16 }}>No test sessions right now</p>
          <p style={{ color: t.textMuted, fontSize: 13, marginTop: 4 }}>
            New tests are posted regularly. Check back soon!
          </p>
        </Card>
      ) : (
        tests.map((test) => (
          <Card key={test.id} t={t} className="flex flex-col gap-4">
            <div>
              <Pill t={t} tone="teal">
                <ClipboardList size={12} /> Test session
              </Pill>
              <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, marginTop: 10 }}>{test.name}</h2>
            </div>
            <div className="flex flex-wrap gap-4 text-sm" style={{ color: t.textMuted }}>
              <span className="inline-flex items-center gap-1.5">
                <HelpCircle size={14} />
                <span style={{ fontFamily: FONT_MONO }}>{test.questions.length}</span> MCQs
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} />
                <span style={{ fontFamily: FONT_MONO }}>{test.questions.length}</span> min
              </span>
            </div>
            <Btn t={t} full icon={Play} onClick={() => start(test)}>
              Start test
            </Btn>
          </Card>
        ))
      )}
    </div>
  );
}
