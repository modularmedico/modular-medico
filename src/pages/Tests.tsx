import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Clock, HelpCircle, Play, Loader2, Lock, Layers, BookOpen } from "lucide-react";
import Card from "../components/Card";
import Pill from "../components/Pill";
import Btn from "../components/Btn";
import { THEME, FONT_DISPLAY, FONT_MONO } from "../theme";
import {
  useAppStore,
  useCanAccessTestSeries,
  useIsLoggedIn,
  useIsPremium,
} from "../store/useAppStore";
import { subscribePublishedTestSessions } from "../services/testSessions";
import { subscribeFreeSubjects, isSubjectFree, type FreeSubjectsMap } from "../services/adminContent";
import { SUBJECT_META, type SubjectId } from "../data/subjects";
import type { PracticeConfig, TestSessionDoc, TestSessionSource } from "../types";

/** Unique (block, subjectId) pairs a test touches, de-duplicated and sorted for the badge row. */
function uniqueSources(sources: TestSessionSource[]) {
  const seen = new Set<string>();
  const out: TestSessionSource[] = [];
  for (const s of sources) {
    const key = `${s.block}:${s.subjectId ?? "all"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out.sort((a, b) => a.block - b.block);
}

export default function Tests() {
  const navigate = useNavigate();
  const isDark = useAppStore((s) => s.isDark);
  const startSession = useAppStore((s) => s.startSession);
  const canAccess = useCanAccessTestSeries();
  const isLoggedIn = useIsLoggedIn();
  const isAdmin = useAppStore((s) => s.isAdmin);
  const isPremium = useIsPremium();
  const freeBlocks = useAppStore((s) => s.freeBlocks);
  const unlockedBlocks = useAppStore((s) => s.profile?.unlockedBlocks);
  // Admin-granted "Test" override (Manage Access tab) — bypasses the per-test
  // Block/Subject paywall below entirely, same as it bypasses the global switch.
  const testSeriesUnlocked = useAppStore((s) => s.profile?.testSeriesUnlocked);
  const t = isDark ? THEME.dark : THEME.light;

  const [tests, setTests] = useState<TestSessionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [freeSubjects, setFreeSubjects] = useState<FreeSubjectsMap>({});

  useEffect(() => subscribeFreeSubjects(setFreeSubjects), []);

  useEffect(() => {
    // Access is switched off for students — don't even bother loading the
    // list of tests, just show the locked state below.
    if (!canAccess) {
      setLoading(false);
      return;
    }
    return subscribePublishedTestSessions(
      (list) => {
        setTests(list.filter((x) => x.questions.length > 0));
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [canAccess]);

  // Same unlock rules the MCQ practice library uses (Block/Subject paywall): free
  // blocks, admin, active premium, or an admin-granted block/subject override.
  const isBlockUnlocked = (block: number) =>
    freeBlocks.includes(block) || isAdmin || isPremium || !!unlockedBlocks?.includes(block);
  const isSourceUnlocked = (src: TestSessionSource) => {
    if (isBlockUnlocked(src.block)) return true;
    return !!src.subjectId && isSubjectFree(freeSubjects, src.block, src.subjectId);
  };
  // A test is locked if ANY of the content it draws from isn't unlocked for this user —
  // unless an admin granted this account the standalone "Test" override, which unlocks
  // every test outright regardless of Block/Subject.
  const isTestLocked = (test: TestSessionDoc) =>
    !testSeriesUnlocked && test.sources.some((src) => !isSourceUnlocked(src));

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

  const handleStart = (test: TestSessionDoc) => {
    if (isTestLocked(test)) {
      navigate(isLoggedIn ? "/paywall" : "/signup");
      return;
    }
    start(test);
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26 }}>Test Sessions</h1>
        <p style={{ color: t.textMuted, fontSize: 14, marginTop: 2 }}>
          Timed exam-style tests curated by our faculty. Pick one and join in.
        </p>
      </div>

      {!canAccess ? (
        <Card t={t} style={{ textAlign: "center", padding: 32 }}>
          <Lock size={28} color={t.textFaint} style={{ margin: "0 auto 10px" }} />
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 16 }}>Test Series is locked</p>
          <p style={{ color: t.textMuted, fontSize: 13, marginTop: 4 }}>
            Test Series access is currently switched off. Check back later or reach out to the team.
          </p>
        </Card>
      ) : loading ? (
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
        // Mobile: single stacked column. Desktop (md+): multi-column grid so
        // more tests are visible without scrolling.
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {tests.map((test) => {
            const locked = isTestLocked(test);
            const srcs = uniqueSources(test.sources);

            return (
              <Card key={test.id} t={t} className="flex flex-col gap-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Pill t={t} tone="teal">
                      <ClipboardList size={12} /> Test session
                    </Pill>
                    {locked && (
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: t.gold, color: "#241A08" }}
                        title="Requires unlock"
                      >
                        <Lock size={12} strokeWidth={2.75} />
                      </span>
                    )}
                  </div>
                  <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, marginTop: 10 }}>{test.name}</h2>
                </div>

                {/* Block / Subject demarcation — what this test actually covers */}
                {srcs.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Layers size={12} color={t.textFaint} />
                      {Array.from(new Set(srcs.map((s) => s.block))).map((block) => (
                        <Pill key={block} t={t} tone="purple" style={{ padding: "3px 10px", fontSize: 11 }}>
                          Block {block}
                        </Pill>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <BookOpen size={12} color={t.textFaint} />
                      {srcs.map((s, i) => {
                        const label = s.subjectId
                          ? SUBJECT_META[s.subjectId as SubjectId]?.label ?? s.subjectId
                          : "All subjects";
                        return (
                          <Pill key={`${s.block}-${s.subjectId ?? "all"}-${i}`} t={t} tone="gold" style={{ padding: "3px 10px", fontSize: 11 }}>
                            B{s.block} · {label}
                          </Pill>
                        );
                      })}
                    </div>
                  </div>
                )}

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

                <Btn t={t} full icon={locked ? Lock : Play} onClick={() => handleStart(test)}>
                  {locked ? "Unlock to start" : "Start test"}
                </Btn>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
