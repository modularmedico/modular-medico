import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, ClipboardCheck, Clock, FolderTree, HelpCircle, Loader2, Lock, Play } from "lucide-react";
import Card from "../components/Card";
import Pill from "../components/Pill";
import Btn from "../components/Btn";
import ContinueBanner from "../components/ContinueBanner";
import { THEME, FONT_DISPLAY, FONT_MONO } from "../theme";
import { useAppStore, useIsLoggedIn, useIsPremium } from "../store/useAppStore";
import { DEFAULT_BLOCK_DEFINITIONS, TOTAL_BLOCKS } from "../data/subjects";
import { subscribeBlockDefinitions } from "../services/adminContent";
import { subscribePublishedMockTests } from "../services/mockTests";
import { useStartGuard } from "../hooks/useStartGuard";
import type { MockTestDoc, PracticeConfig } from "../types";

/**
 * Mock Tests.
 *   /mock-tests          -> Blocks 1-15
 *   /mock-tests/:block   -> Mock Test 1, Mock Test 2, ... for that Block
 * A mock test runs in the strict exam layout (OMR sheet, 1 minute per MCQ, answers revealed only
 * on the results screen). Access follows the same Block rules as the MCQ bank.
 */
export default function MockTests() {
  const navigate = useNavigate();
  const { block: blockParam } = useParams();
  const blockNum = blockParam === undefined ? undefined : Number(blockParam);

  const isDark = useAppStore((s) => s.isDark);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const isLoggedIn = useIsLoggedIn();
  const isPremium = useIsPremium();
  const freeBlocks = useAppStore((s) => s.freeBlocks);
  const unlockedBlocks = useAppStore((s) => s.profile?.unlockedBlocks);
  const startSession = useAppStore((s) => s.startSession);
  const t = isDark ? THEME.dark : THEME.light;
  const { guard, modal } = useStartGuard();

  const [mocks, setMocks] = useState<MockTestDoc[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [blockDefs, setBlockDefs] = useState(DEFAULT_BLOCK_DEFINITIONS);

  useEffect(() => subscribeBlockDefinitions(setBlockDefs), []);
  useEffect(
    () =>
      subscribePublishedMockTests(
        (list) => {
          setMocks(list);
          setLoaded(true);
        },
        () => setLoaded(true)
      ),
    []
  );

  const isBlockOpen = (b: number) => freeBlocks.includes(b) || isAdmin || isPremium || !!unlockedBlocks?.includes(b);
  const goPaywall = () => navigate(isLoggedIn ? "/paywall" : "/signup");

  const countByBlock = useMemo(() => {
    const map: Record<number, number> = {};
    mocks.forEach((m) => (map[m.block] = (map[m.block] ?? 0) + 1));
    return map;
  }, [mocks]);

  const start = (mock: MockTestDoc) => {
    if (!isBlockOpen(mock.block)) return goPaywall();
    const config: PracticeConfig = { mode: "exam", timing: "timed", spacedRep: false, difficultyFilter: "all", deferResults: true };
    guard(() => {
      startSession(
        {
          subjectId: "all",
          moduleId: `mock-${mock.id}`,
          moduleName: "Mock Test",
          block: mock.block,
          setTitle: `Block ${mock.block} · ${mock.name}`,
          questions: mock.questions.map((q) => ({ q: q.q, options: q.options, correct: q.correct, explanation: q.explanation })),
        },
        config
      );
      navigate("/practice");
    }, `Block ${mock.block} · ${mock.name}`);
  };

  if (blockNum !== undefined && (!Number.isInteger(blockNum) || blockNum < 1 || blockNum > TOTAL_BLOCKS)) {
    return (
      <div className="py-16 text-center">
        <p style={{ color: t.textMuted }}>That block couldn't be found.</p>
        <button onClick={() => navigate("/mock-tests")} className="mt-3 text-sm font-bold" style={{ color: t.teal }}>
          Back to Mock Tests
        </button>
      </div>
    );
  }

  /* ----------------------------- Level 0: Blocks ----------------------------- */
  if (blockNum === undefined) {
    const blocks = Array.from({ length: TOTAL_BLOCKS }, (_, i) => i + 1);
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <button onClick={() => navigate("/browse/tests")} className="flex items-center gap-1 self-start text-sm font-bold" style={{ color: t.textMuted }}>
          <ChevronLeft size={15} /> Test Sessions
        </button>
        <ContinueBanner kinds={["mcq"]} />
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${t.gold}22` }}>
              <ClipboardCheck size={18} color={t.gold} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: t.gold }}>
              Mock Tests · Blocks
            </span>
          </div>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em", marginTop: 8 }}>Mock Tests</h1>
          <p style={{ color: t.textMuted, fontSize: 13.5, marginTop: 2 }}>Choose a Block to see its mock tests.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-8">
          {blocks.map((b) => {
            const n = countByBlock[b] ?? 0;
            const def = blockDefs.find((d) => d.block === b);
            return (
              <button
                key={b}
                onClick={() => navigate(`/mock-tests/${b}`)}
                className="relative flex flex-col items-center justify-center rounded-2xl p-2.5 text-center transition-all hover:scale-[1.02]"
                style={{ backgroundColor: t.surfaceAlt, color: t.text, border: `1.5px solid ${t.border}`, opacity: loaded && n === 0 ? 0.55 : 1 }}
              >
                {!isBlockOpen(b) && (
                  <div
                    className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full shadow-md"
                    style={{ backgroundColor: t.gold, color: "#241A08" }}
                    title="Requires Full Access"
                  >
                    <Lock size={11} strokeWidth={2.75} />
                  </div>
                )}
                <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>B{b}</span>
                <span className="mt-0.5 max-w-[65px] truncate text-[10px] font-semibold" style={{ color: t.gold }}>
                  {def?.title.split(" ")[0] ?? `Block ${b}`}
                </span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: t.textFaint, marginTop: 2 }}>
                  {loaded ? `${n} ${n === 1 ? "Mock" : "Mocks"}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* --------------------------- Level 1: Mock Test 1, 2... --------------------------- */
  const list = mocks.filter((m) => m.block === blockNum);
  const blockTitle = blockDefs.find((d) => d.block === blockNum)?.title ?? `Block ${blockNum}`;
  const open = isBlockOpen(blockNum);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <button onClick={() => navigate("/mock-tests")} className="flex items-center gap-1 self-start text-sm font-bold" style={{ color: t.textMuted }}>
        <ChevronLeft size={15} /> Mock Tests
      </button>
      <ContinueBanner kinds={["mcq"]} />
      <div className="flex flex-wrap items-center gap-1 text-xs" style={{ color: t.textFaint }}>
        <button onClick={() => navigate("/mock-tests")} className="font-semibold" style={{ color: t.textMuted }}>
          Mock Tests
        </button>
        <ChevronRight size={11} />
        <span className="font-semibold" style={{ color: t.text }}>Block {blockNum}</span>
      </div>
      <div>
        <div className="flex items-center gap-2">
          <Pill t={t} tone="gold">
            <ClipboardCheck size={12} /> Mock Tests
          </Pill>
          {!open && (
            <Pill t={t} tone="muted">
              <Lock size={11} /> Full Access
            </Pill>
          )}
        </div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em", marginTop: 8 }}>{blockTitle}</h1>
        <p style={{ color: t.textMuted, fontSize: 13.5, marginTop: 2 }}>Choose a mock test. Answers are revealed when you finish.</p>
      </div>

      {!loaded ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm" style={{ color: t.textMuted }}>
          <Loader2 size={16} className="animate-spin" /> Loading mock tests&hellip;
        </div>
      ) : list.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-2xl p-10 text-center"
          style={{ backgroundColor: t.surfaceAlt, border: `1.5px dashed ${t.border}` }}
        >
          <FolderTree size={22} color={t.textFaint} />
          <h4 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>Coming Soon</h4>
          <p className="max-w-sm text-xs" style={{ color: t.textMuted }}>
            No mock tests have been added to Block {blockNum} yet. They appear automatically once published.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((m) => (
            <Card key={m.id} t={t} className="flex flex-col gap-4">
              <div>
                <Pill t={t} tone="gold">
                  <ClipboardCheck size={12} /> Block {m.block}
                </Pill>
                <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, marginTop: 10 }}>{m.name}</h2>
              </div>
              <div className="flex flex-wrap gap-4 text-sm" style={{ color: t.textMuted }}>
                <span className="inline-flex items-center gap-1.5">
                  <HelpCircle size={14} />
                  <span style={{ fontFamily: FONT_MONO }}>{m.questions.length}</span> MCQs
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={14} />
                  <span style={{ fontFamily: FONT_MONO }}>{m.questions.length}</span> min
                </span>
              </div>
              <Btn t={t} full icon={open ? Play : Lock} onClick={() => start(m)}>
                {open ? "Start mock test" : "Unlock to start"}
              </Btn>
            </Card>
          ))}
        </div>
      )}
      {modal}
    </div>
  );
}
