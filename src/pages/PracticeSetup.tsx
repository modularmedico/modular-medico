import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ArrowRight,
  ListChecks,
  Grid3x3,
  Infinity as InfinityIcon,
  Timer,
  HelpCircle,
  Lock,
  Clock,
  Sliders,
  Loader2,
} from "lucide-react";
import Card from "../components/Card";
import Pill from "../components/Pill";
import Btn from "../components/Btn";
import Segmented from "../components/Segmented";
import Toggle from "../components/Toggle";
import { THEME, FONT_DISPLAY } from "../theme";
import { useAppStore, useIsLoggedIn, useIsPremium } from "../store/useAppStore";
import { SUBJECT_META, isSubjectId, DEFAULT_BLOCK_DEFINITIONS, type BlockDefinition } from "../data/subjects";
import {
  subscribeBlockDefinitions,
  subscribeSubheadings,
  fetchPublishedBlock,
  fetchPublishedBlockExam,
  fetchPublishedModuleExam,
} from "../services/adminContent";
import type { Difficulty, PracticeConfig, SubheadingDoc } from "../types";

// Mirrors the label used in the admin question bank for MCQs with no subheading tag.
const GENERAL_SUBHEADING_LABEL = "General / No subheading";

const TIMER_PRESETS = [
  { label: "3 min", seconds: 180 },
  { label: "5 min", seconds: 300 },
  { label: "10 min", seconds: 600 },
  { label: "15 min", seconds: 900 },
  { label: "30 min", seconds: 1800 },
  { label: "60 min", seconds: 3600 },
];

export default function PracticeSetup() {
  const navigate = useNavigate();
  const { subjectId = "", moduleId = "", block: blockParam = "" } = useParams();
  const [searchParams] = useSearchParams();
  const block = Number(blockParam);
  const isDark = useAppStore((s) => s.isDark);
  const startSession = useAppStore((s) => s.startSession);
  const isLoggedIn = useIsLoggedIn();
  const isPremium = useIsPremium();
  const t = isDark ? THEME.dark : THEME.light;

  const [blockDefs, setBlockDefs] = useState<BlockDefinition[]>(DEFAULT_BLOCK_DEFINITIONS);
  const [mode, setMode] = useState<"traditional" | "omr" | "exam">("traditional");
  const [timing, setTiming] = useState<"untimed" | "timed">("untimed");
  const [timerSeconds, setTimerSeconds] = useState<number>(300); // default 5 minutes
  const [customMinutes, setCustomMinutes] = useState<string>("5");
  const [isCustomTimer, setIsCustomTimer] = useState(false);

  const [spacedRep, setSpacedRep] = useState(true);
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const [showInfo, setShowInfo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  // Subheading picker — 4th tier of the hierarchy (Block -> Module -> Subject -> Subheading).
  // Only relevant when practicing a single Subject within a single Module. We select by
  // *name* rather than the Firestore doc id: the same subheading can legitimately have
  // different ids in Firestore vs. a locally-cached copy (e.g. one created while offline),
  // and filtering by id risked silently matching zero questions even though the subheading
  // pill was visible and selected.
  const [subheadingDocs, setSubheadingDocs] = useState<SubheadingDoc[]>([]);
  const [subheadingNamesFromQuestions, setSubheadingNamesFromQuestions] = useState<string[]>([]);
  const [subheadingsLoaded, setSubheadingsLoaded] = useState(false);
  const [selectedSubheadingName, setSelectedSubheadingName] = useState<string>("");

  // Module-level subheading picker — used when practicing a whole Module ("Practice Module"),
  // which can span several subjects. Subheadings are scoped per (block, module, subject) in
  // Firestore, so two different subjects can legitimately each have a subheading with the same
  // name (e.g. "Introduction"). To avoid silently merging those together, every option here is
  // keyed and filtered by the (subjectId, subheadingName) PAIR, never by name alone — and the
  // subject label is shown alongside the name so it's clear which subject each option belongs to.
  const [moduleSubheadingOptions, setModuleSubheadingOptions] = useState<{ subjectId: string; name: string }[]>([]);
  const [selectedModuleSubheading, setSelectedModuleSubheading] = useState<{ subjectId: string; name: string } | null>(null);
  const [moduleSubheadingsLoaded, setModuleSubheadingsLoaded] = useState(false);

  // Force strict settings in Exam mode
  useEffect(() => {
    if (mode === "exam") {
      setTiming("timed");
      setSpacedRep(false);
    }
  }, [mode]);

  useEffect(() => {
    return subscribeBlockDefinitions(setBlockDefs);
  }, []);

  const blockDef = blockDefs.find((b) => b.block === block) || DEFAULT_BLOCK_DEFINITIONS.find((b) => b.block === block);
  const targetModule = blockDef?.modules?.find((m) => m.id === moduleId);

  const isFullBlock = subjectId === "all" && (moduleId === "all" || searchParams.get("fullBlock") === "true");
  const isModuleExam = subjectId === "all" && moduleId !== "all";
  const isSubjectInModule = isSubjectId(subjectId);

  // Load subheadings scoped to this exact Block + Module + Subject, resetting the
  // selection whenever the underlying scope changes. Two sources are combined:
  // the `subheadings` docs (for order/labels) and the actual subheading names
  // present on published questions (the source of truth for what's practiceable) —
  // so a subheading never fails to appear here just because its doc record didn't
  // sync, and never appears here without actually having any questions to show.
  useEffect(() => {
    setSelectedSubheadingName("");
    setSubheadingDocs([]);
    setSubheadingNamesFromQuestions([]);
    if (!isSubjectInModule) {
      setSubheadingsLoaded(true);
      return;
    }
    setSubheadingsLoaded(false);
    let cancelled = false;

    const unsubDocs = subscribeSubheadings(block, moduleId, subjectId, (docs) => {
      if (!cancelled) setSubheadingDocs(docs);
    });

    fetchPublishedBlock(subjectId, moduleId, block).then((qs) => {
      if (cancelled) return;
      const names = new Set<string>();
      qs.forEach((q) => {
        if (q.subheadingName) names.add(q.subheadingName.trim());
      });
      setSubheadingNamesFromQuestions(Array.from(names));
      setSubheadingsLoaded(true);
    });

    return () => {
      cancelled = true;
      unsubDocs();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSubjectInModule, block, moduleId, subjectId]);

  // Merge the two sources by name, ordered by the subheading docs' `order` where known,
  // then alphabetically for any question-only names that have no matching doc.
  const subheadings = (() => {
    const seen = new Set<string>();
    const merged: { name: string; order: number }[] = [];
    subheadingDocs.forEach((s) => {
      const key = s.name.trim().toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      merged.push({ name: s.name.trim(), order: s.order ?? merged.length });
    });
    subheadingNamesFromQuestions
      .slice()
      .sort()
      .forEach((name) => {
        const key = name.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        merged.push({ name, order: merged.length + 1000 });
      });
    return merged.sort((a, b) => a.order - b.order);
  })();

  // Discover the distinct (subject, subheading) pairs used across every published question in
  // this Module, so the whole-module "Practice Module" flow can offer the same narrowing the
  // per-subject flow already has, instead of always bundling every subject's MCQs together —
  // and without conflating two different subjects' identically-named subheadings.
  useEffect(() => {
    setSelectedModuleSubheading(null);
    setModuleSubheadingOptions([]);
    if (!isModuleExam || !Number.isInteger(block)) {
      setModuleSubheadingsLoaded(true);
      return;
    }
    setModuleSubheadingsLoaded(false);
    let cancelled = false;
    fetchPublishedModuleExam(block, moduleId).then((qs) => {
      if (cancelled) return;
      const seen = new Set<string>();
      const options: { subjectId: string; name: string }[] = [];
      qs.forEach((q) => {
        const name = q.subheadingName || GENERAL_SUBHEADING_LABEL;
        const key = `${q.subjectId}::${name.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        options.push({ subjectId: q.subjectId, name });
      });
      options.sort((a, b) => {
        const subjA = SUBJECT_META[a.subjectId as keyof typeof SUBJECT_META]?.label || a.subjectId;
        const subjB = SUBJECT_META[b.subjectId as keyof typeof SUBJECT_META]?.label || b.subjectId;
        return subjA === subjB ? a.name.localeCompare(b.name) : subjA.localeCompare(subjB);
      });
      setModuleSubheadingOptions(options);
      setModuleSubheadingsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModuleExam, block, moduleId]);

  const moduleDisplayName = isFullBlock
    ? `${blockDef?.title || `Block ${block}`} (All Modules)`
    : isModuleExam
    ? `${targetModule?.name || moduleId}`
    : `${SUBJECT_META[subjectId as keyof typeof SUBJECT_META]?.label || subjectId} \u00b7 ${targetModule?.name || `Block ${block}`}`;

  const locked = block !== 1 && !isPremium;

  const selectedSubheading = selectedSubheadingName
    ? subheadings.find((s) => s.name === selectedSubheadingName) || null
    : null;

  useEffect(() => {
    if (locked) return;
    if (isFullBlock) {
      fetchPublishedBlockExam(block).then((qs) => {
        setCount(qs.length);
        if (mode === "exam") setTimerSeconds(qs.length * 60);
      });
    } else if (isModuleExam) {
      fetchPublishedModuleExam(
        block,
        moduleId,
        undefined,
        selectedModuleSubheading?.name || null,
        selectedModuleSubheading?.subjectId || null
      ).then((qs) => {
        setCount(qs.length);
        if (mode === "exam") setTimerSeconds(qs.length * 60);
      });
    } else if (isSubjectInModule) {
      fetchPublishedBlock(subjectId, moduleId, block, undefined, null, selectedSubheadingName || null).then((qs) => {
        setCount(qs.length);
        if (mode === "exam") setTimerSeconds(qs.length * 60);
      });
    }
  }, [
    locked,
    subjectId,
    moduleId,
    block,
    isFullBlock,
    isModuleExam,
    isSubjectInModule,
    mode,
    selectedSubheadingName,
    selectedModuleSubheading,
  ]);

  if (!Number.isInteger(block) || (!isFullBlock && !isModuleExam && !isSubjectInModule)) {
    return (
      <div className="py-16 text-center">
        <p style={{ color: t.textMuted }}>That session couldn't be found.</p>
        <button onClick={() => navigate("/subjects")} className="mt-3 text-sm font-bold" style={{ color: t.teal }}>
          Back to library
        </button>
      </div>
    );
  }

  // Fixed Lock Screen (Requirement 10)
  if (locked) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg" style={{ backgroundColor: `${t.gold}25` }}>
          <Lock size={28} color={t.gold} strokeWidth={2.5} />
        </div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22 }}>Unlock Block {block}</h1>
        <p style={{ color: t.textMuted, fontSize: 14, lineHeight: 1.5 }}>
          Block 1 is open for free trial practice. Unlock full access to Blocks 1–15 and custom exams.
        </p>
        <Btn t={t} onClick={() => navigate(isLoggedIn ? "/paywall" : "/signup")}>
          {isLoggedIn ? "Unlock Full Access" : "Create Free Account"}
        </Btn>
      </div>
    );
  }

  const start = async () => {
    setLoading(true);
    const diff = difficulty === "all" ? undefined : difficulty;
    let questions = [];
    if (isFullBlock) {
      questions = await fetchPublishedBlockExam(block, diff);
    } else if (isModuleExam) {
      questions = await fetchPublishedModuleExam(
        block,
        moduleId,
        diff,
        selectedModuleSubheading?.name || null,
        selectedModuleSubheading?.subjectId || null
      );
    } else {
      questions = await fetchPublishedBlock(subjectId, moduleId, block, diff, null, selectedSubheadingName || null);
    }
    setLoading(false);
    if (questions.length === 0) return;

    const finalTimerSeconds = timing === "timed" ? (isCustomTimer ? (parseInt(customMinutes, 10) || 5) * 60 : timerSeconds) : null;

    const config: PracticeConfig = {
      mode,
      timing,
      customTimerSeconds: finalTimerSeconds,
      spacedRep,
      difficultyFilter: difficulty,
    };

    const title = isFullBlock
      ? `Block ${block}: Full Exam`
      : isModuleExam
      ? `Block ${block} \u00b7 ${targetModule?.name || moduleId}${
          selectedModuleSubheading
            ? ` \u00b7 ${SUBJECT_META[selectedModuleSubheading.subjectId as keyof typeof SUBJECT_META]?.label || selectedModuleSubheading.subjectId} \u2013 ${selectedModuleSubheading.name}`
            : ""
        }`
      : `${SUBJECT_META[subjectId as keyof typeof SUBJECT_META]?.label || ""} (${targetModule?.name || `B${block}`})${
          selectedSubheading ? ` \u00b7 ${selectedSubheading.name}` : ""
        }`;

    startSession(
      {
        subjectId: isFullBlock || isModuleExam ? "all" : subjectId,
        moduleId: isFullBlock ? `block-${block}-all` : moduleId,
        moduleName: moduleDisplayName,
        block,
        setTitle: title,
        questions: questions.map((q) => ({ q: q.q, options: q.options, correct: q.correct, explanation: q.explanation })),
      },
      config
    );
    navigate("/practice");
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      {/* Clean Back Link (Requirement 7) */}
      <button
        onClick={() => navigate("/subjects?view=block")}
        className="flex items-center gap-1.5 text-xs font-bold transition-opacity hover:opacity-75"
        style={{ color: t.textMuted }}
      >
        <ChevronLeft size={16} /> Back to Library
      </button>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill t={t} tone="teal">
            Block {block}
          </Pill>
          {targetModule && (
            <Pill t={t} tone="purple">
              {targetModule.name}
            </Pill>
          )}
        </div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, marginTop: 8 }}>
          {moduleDisplayName}
        </h1>
        <p style={{ color: t.textMuted, fontSize: 13.5, marginTop: 2 }}>
          {count === null ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin" /> Checking questions&hellip;
            </span>
          ) : (
            `${count} question${count !== 1 ? "s" : ""} available`
          )}
        </p>
      </div>

      <Card t={t} className="flex flex-col gap-5 p-6" style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}>
        {/* Practice Mode */}
        <div>
          <span className="mb-2 block text-xs font-bold uppercase tracking-wide" style={{ color: t.textFaint }}>
            Practice Format
          </span>
          <Segmented
            t={t}
            value={mode}
            onChange={(v) => setMode(v as "traditional" | "omr" | "exam")}
            options={[
              { value: "traditional", label: "Traditional", icon: ListChecks },
              { value: "omr", label: "OMR Sheet", icon: Grid3x3 },
              { value: "exam", label: "Mock Exam", icon: Timer },
            ]}
          />
          {mode === "exam" && (
            <p className="mt-2 text-xs" style={{ color: t.gold }}>
              Mock Exam mode enforces strict timer countdown and delays answers until submission.
            </p>
          )}
        </div>

        {/* Timing Mode & Timer Adjuster (Requirement 8) */}
        <div style={{ opacity: mode === "exam" ? 0.75 : 1 }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: t.textFaint }}>
              Timer Control
            </span>
            {timing === "timed" && (
              <span className="text-xs font-mono font-bold" style={{ color: t.teal }}>
                {isCustomTimer ? `${customMinutes} minutes` : `${Math.round(timerSeconds / 60)} minutes`}
              </span>
            )}
          </div>

          <Segmented
            t={t}
            value={timing}
            onChange={(v) => setTiming(v as "untimed" | "timed")}
            options={[
              { value: "untimed", label: "Untimed", icon: InfinityIcon },
              { value: "timed", label: "Timed Session", icon: Timer },
            ]}
          />

          {/* Timer Duration Adjustment Subpanel */}
          {timing === "timed" && (
            <div className="mt-3 flex flex-col gap-2.5 rounded-xl p-3.5" style={{ backgroundColor: t.surfaceAlt }}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase" style={{ color: t.textMuted }}>
                  Set Time Limit:
                </span>
                <button
                  onClick={() => setIsCustomTimer(!isCustomTimer)}
                  className="text-[11px] font-bold underline"
                  style={{ color: t.purple }}
                >
                  {isCustomTimer ? "Use standard presets" : "Enter custom minutes"}
                </button>
              </div>

              {!isCustomTimer ? (
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {TIMER_PRESETS.map((preset) => {
                    const active = timerSeconds === preset.seconds;
                    return (
                      <button
                        key={preset.seconds}
                        onClick={() => setTimerSeconds(preset.seconds)}
                        className="rounded-lg py-1.5 text-xs font-bold transition-all text-center"
                        style={{
                          backgroundColor: active ? t.purpleStrong : t.surface,
                          color: active ? "#fff" : t.textMuted,
                          border: `1px solid ${active ? t.purpleStrong : t.border}`,
                        }}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Clock size={16} color={t.teal} />
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    placeholder="e.g. 20"
                    className="w-24 rounded-lg px-3 py-1.5 text-xs font-bold outline-none"
                    style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}`, color: t.text }}
                  />
                  <span className="text-xs" style={{ color: t.textMuted }}>Minutes total duration</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Subheading — 4th tier of the hierarchy, only shown when this Subject/Module has any */}
        {isSubjectInModule && (subheadings.length > 0 || !subheadingsLoaded) && (
          <div>
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide" style={{ color: t.textFaint }}>
              Subheading
            </span>
            {!subheadingsLoaded ? (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: t.textFaint }}>
                <Loader2 size={13} className="animate-spin" /> Checking subheadings&hellip;
              </span>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Pill t={t} tone="muted" active={selectedSubheadingName === ""} onClick={() => setSelectedSubheadingName("")}>
                  All Subheadings
                </Pill>
                {subheadings.map((s) => (
                  <Pill
                    key={s.name}
                    t={t}
                    tone="teal"
                    active={selectedSubheadingName === s.name}
                    onClick={() => setSelectedSubheadingName(s.name)}
                  >
                    {s.name}
                  </Pill>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Subheading — Module-wide picker, shown when practicing a whole Module ("Practice
            Module") that has published MCQs tagged with subheadings across its subjects.
            Each option is a (subject, subheading) pair — labelled with its subject — so two
            different subjects' identically-named subheadings are never conflated. */}
        {isModuleExam && (moduleSubheadingOptions.length > 0 || !moduleSubheadingsLoaded) && (
          <div>
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide" style={{ color: t.textFaint }}>
              Subheading
            </span>
            {!moduleSubheadingsLoaded ? (
              <p className="flex items-center gap-1.5 text-xs" style={{ color: t.textMuted }}>
                <Loader2 size={13} className="animate-spin" /> Checking subheadings&hellip;
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Pill
                  t={t}
                  tone="muted"
                  active={selectedModuleSubheading === null}
                  onClick={() => setSelectedModuleSubheading(null)}
                >
                  All Subheadings
                </Pill>
                {moduleSubheadingOptions.map((opt) => {
                  const subjLabel = SUBJECT_META[opt.subjectId as keyof typeof SUBJECT_META]?.label || opt.subjectId;
                  const active =
                    selectedModuleSubheading?.subjectId === opt.subjectId && selectedModuleSubheading?.name === opt.name;
                  return (
                    <Pill
                      key={`${opt.subjectId}::${opt.name}`}
                      t={t}
                      tone="teal"
                      active={active}
                      onClick={() => setSelectedModuleSubheading(opt)}
                    >
                      <span style={{ opacity: 0.65, fontWeight: 600 }}>{subjLabel}:</span> {opt.name}
                    </Pill>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Difficulty */}
        <div>
          <span className="mb-2 block text-xs font-bold uppercase tracking-wide" style={{ color: t.textFaint }}>
            Difficulty
          </span>
          <div className="flex flex-wrap gap-2">
            {(["all", "easy", "medium", "hard"] as const).map((d) => (
              <Pill
                key={d}
                t={t}
                tone={d === "hard" ? "red" : d === "medium" ? "gold" : d === "easy" ? "green" : "muted"}
                active={difficulty === d}
                onClick={() => setDifficulty(d)}
              >
                {d === "all" ? "All Difficulties" : d}
              </Pill>
            ))}
          </div>
        </div>

        {/* Spaced Repetition */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold">Spaced Repetition</span>
            <button onClick={() => setShowInfo(!showInfo)}>
              <HelpCircle size={14} color={t.textFaint} />
            </button>
          </div>
          <Toggle t={t} checked={spacedRep} onChange={setSpacedRep} />
        </div>
        {showInfo && (
          <p className="-mt-3 rounded-xl p-3 text-xs" style={{ backgroundColor: t.surfaceAlt, color: t.textMuted, lineHeight: 1.5 }}>
            Incorrectly answered questions are intelligently rescheduled later in the session for reinforcement.
          </p>
        )}
      </Card>

      <Btn t={t} full icon={loading ? Loader2 : ArrowRight} spin={loading} disabled={loading || count === 0} onClick={start}>
        {loading ? "Preparing session\u2026" : count === 0 ? "No published questions yet" : `Start Practice Session`}
      </Btn>
    </div>
  );
}
