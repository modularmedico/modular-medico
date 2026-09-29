import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronRight,
  BookOpen,
  Layers,
  Play,
  ArrowRight,
  FolderTree,
  Lock,
} from "lucide-react";
import Card from "../components/Card";
import Pill from "../components/Pill";
import Btn from "../components/Btn";
import SubjectIcon from "../components/SubjectIcon";
import Spinner from "../components/Spinner";
import { THEME, FONT_DISPLAY, FONT_MONO } from "../theme";
import { useAppStore, useIsLoggedIn, useIsPremium } from "../store/useAppStore";
import {
  SUBJECT_LIST,
  SUBJECT_META,
  DEFAULT_BLOCK_DEFINITIONS,
  TOTAL_BLOCKS,
  type BlockDefinition,
  type SubjectId,
} from "../data/subjects";
import {
  subscribeBlockDefinitions,
  subscribeBlockCounts,
  subscribeBlockOutline,
  subscribeSubjectCounts,
  subscribeFreeSubjects,
  isSubjectFree,
  blockHasFreeSubject,
  type BlockOutline,
  type FreeSubjectsMap,
} from "../services/adminContent";

export default function Subjects() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("view") as "block" | "subject") || "block";

  const isDark = useAppStore((s) => s.isDark);
  const isLoggedIn = useIsLoggedIn();
  const isPremium = useIsPremium();
  const isAdmin = useAppStore((s) => s.isAdmin);
  const unlockedBlocks = useAppStore((s) => s.profile?.unlockedBlocks);
  const freeBlocks = useAppStore((s) => s.freeBlocks);
  const isBlockUnlocked = (block: number) =>
    freeBlocks.includes(block) || isAdmin || isPremium || !!unlockedBlocks?.includes(block);
  const t = isDark ? THEME.dark : THEME.light;

  // Admin-chosen free subjects inside otherwise paid blocks.
  const [freeSubjects, setFreeSubjects] = useState<FreeSubjectsMap>({});
  useEffect(() => subscribeFreeSubjects(setFreeSubjects), []);
  // A subject is locked only if its block isn't unlocked AND admin hasn't marked it free.
  const isSubjectLocked = (block: number, subjectId: string) =>
    !isBlockUnlocked(block) && !isSubjectFree(freeSubjects, block, subjectId);
  // Block badge: show the lock only when nothing in the block is free.
  const isBlockBadgeLocked = (block: number) =>
    !isBlockUnlocked(block) && !blockHasFreeSubject(freeSubjects, block);

  const [selectedBlockNum, setSelectedBlockNum] = useState(1);
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [blockDefs, setBlockDefs] = useState<BlockDefinition[]>(DEFAULT_BLOCK_DEFINITIONS);
  // Homepage loads only numbers (block/subject counts). The module -> subject outline of a
  // block is fetched when that block is selected; full MCQs load only when a module or
  // subject is actually opened (on the practice screen).
  const [blockCounts, setBlockCounts] = useState<Record<number, number> | null>(null);
  const [outlines, setOutlines] = useState<Record<number, BlockOutline>>({});
  const [subjectCounts, setSubjectCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => subscribeBlockDefinitions(setBlockDefs), []);

  const blockKey = blockDefs.map((b) => b.block).join(",");
  useEffect(() => {
    const blocks = blockKey ? blockKey.split(",").map(Number) : [];
    return subscribeBlockCounts(blocks, setBlockCounts);
  }, [blockKey]);

  useEffect(
    () =>
      subscribeBlockOutline(selectedBlockNum, (o) =>
        setOutlines((prev) => ({ ...prev, [selectedBlockNum]: o }))
      ),
    [selectedBlockNum]
  );

  useEffect(() => {
    if (activeTab !== "subject") return;
    return subscribeSubjectCounts([...SUBJECT_LIST], setSubjectCounts);
  }, [activeTab]);

  const setView = (v: "block" | "subject") => {
    setSearchParams({ view: v });
  };

  const YEARS = [
    { id: "all", label: "All Blocks" },
    { id: "1st", label: "1st Year (B1–3)" },
    { id: "2nd", label: "2nd Year (B4–6)" },
    { id: "3rd", label: "3rd Year (B7–9)" },
    { id: "4th", label: "4th Year (B10–12)" },
    { id: "5th", label: "Final Year (B13–15)" },
  ];

  const filteredBlockDefs = useMemo(() => {
    return blockDefs.filter((b) => {
      if (yearFilter === "1st") return b.block <= 3;
      if (yearFilter === "2nd") return b.block >= 4 && b.block <= 6;
      if (yearFilter === "3rd") return b.block >= 7 && b.block <= 9;
      if (yearFilter === "4th") return b.block >= 10 && b.block <= 12;
      if (yearFilter === "5th") return b.block >= 13;
      return true;
    });
  }, [blockDefs, yearFilter]);

  const currentBlockDef = blockDefs.find((b) => b.block === selectedBlockNum) || DEFAULT_BLOCK_DEFINITIONS[0];
  const currentBlockLocked = !isBlockUnlocked(currentBlockDef.block);

  // Only modules that actually have published MCQs appear (derived from the block outline).
  const outline = outlines[selectedBlockNum];
  const displayModules = outline?.modules ?? [];
  const outlineLoaded = !!outline;

  const totalQuestionsInSelectedBlock = outline?.total ?? blockCounts?.[selectedBlockNum] ?? 0;
  const selectedTotalKnown = !!outline || !!blockCounts;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Top Header - Minimalist & Clean (Requirement 7) */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em" }}>
            Practice Library
          </h1>
          <p style={{ color: t.textMuted, fontSize: 13.5, marginTop: 2 }}>
            Select an integrated block or medical subject to begin your revision.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div
          className="flex rounded-2xl p-1 self-start sm:self-auto"
          style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}` }}
        >
          <button
            onClick={() => setView("block")}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all"
            style={{
              backgroundColor: activeTab === "block" ? t.purpleStrong : "transparent",
              color: activeTab === "block" ? "#fff" : t.textMuted,
            }}
          >
            <Layers size={14} /> Blocks 1–15
          </button>
          <button
            onClick={() => setView("subject")}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all"
            style={{
              backgroundColor: activeTab === "subject" ? t.purpleStrong : "transparent",
              color: activeTab === "subject" ? "#fff" : t.textMuted,
            }}
          >
            <BookOpen size={14} /> {SUBJECT_LIST.length} Subjects
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. PRIMARY VIEW: BLOCK HIERARCHY                                          */}
      {/* ========================================================================= */}
      {activeTab === "block" && (
        <div className="flex flex-col gap-6">
          {/* Year Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {YEARS.map((y) => (
              <Pill
                key={y.id}
                t={t}
                active={yearFilter === y.id}
                onClick={() => setYearFilter(y.id)}
              >
                {y.label}
              </Pill>
            ))}
          </div>

          {/* Block Selector 1–15 */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-15">
            {filteredBlockDefs.map((b) => {
              const totalInBlock = outlines[b.block]?.total ?? blockCounts?.[b.block] ?? 0;
              const isSelected = selectedBlockNum === b.block;
              const isLocked = isBlockBadgeLocked(b.block);

              return (
                <button
                  key={b.block}
                  onClick={() => setSelectedBlockNum(b.block)}
                  className="flex flex-col items-center justify-center rounded-2xl p-2.5 transition-all text-center relative hover:scale-[1.02]"
                  style={{
                    backgroundColor: isSelected ? t.purpleStrong : t.surfaceAlt,
                    color: isSelected ? "#fff" : t.text,
                    border: `1.5px solid ${isSelected ? t.purpleStrong : t.border}`,
                    boxShadow: isSelected ? `0 4px 14px ${t.purpleStrong}40` : "none",
                  }}
                >
                  {/* Fixed Lock Icon (Requirement 10) */}
                  {isLocked && (
                    <div
                      className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full shadow-md z-10"
                      style={{ backgroundColor: t.gold, color: "#241A08" }}
                      title="Requires Full Access"
                    >
                      <Lock size={10} strokeWidth={2.5} />
                    </div>
                  )}

                  <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>
                    B{b.block}
                  </span>
                  <span
                    className="truncate max-w-[65px] text-[10px] font-semibold mt-0.5"
                    style={{ color: isSelected ? "#ffffffdd" : t.teal }}
                  >
                    {b.title.split(" ")[0]}
                  </span>
                  <span
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 10,
                      color: isSelected ? "#ffffffcc" : t.textFaint,
                      marginTop: 2,
                    }}
                  >
                    {blockCounts || outlines[b.block] ? `${totalInBlock} Qs` : "Loading\u2026"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Block Card */}
          <Card
            t={t}
            className="flex flex-col gap-6 p-6"
            style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}
          >
            {/* Block Header */}
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start border-b pb-5" style={{ borderColor: t.border }}>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold"
                    style={{ backgroundColor: `${t.teal}22`, color: t.teal }}
                  >
                    Block {currentBlockDef.block} of 15
                  </span>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold"
                    style={{ backgroundColor: `${t.purple}22`, color: t.purple }}
                  >
                    {currentBlockDef.year}
                  </span>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold"
                    style={{ backgroundColor: t.surfaceAlt, color: t.textMuted }}
                  >
                    {displayModules.length} {displayModules.length === 1 ? "Module" : "Modules"}
                  </span>
                  <span
                    className="rounded-full px-3 py-1 font-mono text-xs font-bold"
                    style={{ backgroundColor: t.surfaceAlt, color: t.textMuted }}
                  >
                    {selectedTotalKnown ? `${totalQuestionsInSelectedBlock} Questions` : "Loading\u2026"}
                  </span>
                </div>

                <h2
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 700,
                    fontSize: 22,
                    marginTop: 10,
                    marginBottom: 4,
                  }}
                >
                  {currentBlockDef.title}
                </h2>
                <p style={{ color: t.textMuted, fontSize: 13.5, lineHeight: 1.5, maxWidth: "750px" }}>
                  {currentBlockDef.description}
                </p>
              </div>

              {/* Start Comprehensive Full Block Exam CTA */}
              <div className="flex flex-col gap-1.5 shrink-0 md:w-60">
                <Btn
                  t={t}
                  full
                  icon={currentBlockLocked ? Lock : Play}
                  onClick={() =>
                    navigate(
                      currentBlockLocked
                        ? (isLoggedIn ? "/paywall" : "/signup")
                        : `/subjects/all/all/${currentBlockDef.block}?fullBlock=true`
                    )
                  }
                >
                  {currentBlockLocked ? `Unlock Block ${currentBlockDef.block}` : `Start Block ${currentBlockDef.block} Exam`}
                </Btn>
                <span className="text-center text-[11px]" style={{ color: t.textFaint }}>
                  {currentBlockLocked && blockHasFreeSubject(freeSubjects, currentBlockDef.block)
                    ? "Some subjects in this block are free"
                    : "Full multi-module exam"}
                </span>
              </div>
            </div>

            {/* Modules List inside this Block (Requirement 3: Dynamic Module Display) */}
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderTree size={16} color={t.purple} />
                  <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>
                    Modules in Block {currentBlockDef.block} ({displayModules.length})
                  </h3>
                </div>
              </div>

              {!outlineLoaded && (
                <div
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl p-10 text-center"
                  style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}` }}
                >
                  <Spinner t={t} size={22} label="Loading modules\u2026" />
                </div>
              )}

              {outlineLoaded && displayModules.length === 0 && (
                <div
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl p-10 text-center"
                  style={{ backgroundColor: t.surfaceAlt, border: `1.5px dashed ${t.border}` }}
                >
                  <FolderTree size={22} color={t.textFaint} />
                  <h4 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>Coming Soon</h4>
                  <p className="max-w-sm text-xs" style={{ color: t.textMuted }}>
                    No MCQ banks have been added to Block {currentBlockDef.block} yet. Modules will appear here
                    automatically as soon as questions are published for this block.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-4">
                {displayModules.map((mod, modIdx) => {
                  const modQuestions = mod.total;
                  // Whole-module practice needs every subject in it to be accessible.
                  const modLocked = mod.subjects.some((sj) => isSubjectLocked(currentBlockDef.block, sj.subjectId));

                  return (
                    <div
                      key={mod.id}
                      className="rounded-2xl p-5 transition-all"
                      style={{
                        backgroundColor: t.surfaceAlt,
                        border: `1.5px solid ${t.border}`,
                      }}
                    >
                      {/* Module Header */}
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center border-b pb-3 mb-3" style={{ borderColor: t.border }}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                              style={{ backgroundColor: `${t.purple}22`, color: isDark ? "#d8b4fe" : t.purpleStrong }}
                            >
                              Module {modIdx + 1}
                            </span>
                            <span
                              className="rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold"
                              style={{ backgroundColor: `${t.green}20`, color: t.green }}
                            >
                              {modQuestions} Questions
                            </span>
                          </div>
                          <h4 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17 }}>
                            {mod.name}
                          </h4>
                          {mod.description && (
                            <p style={{ color: t.textMuted, fontSize: 12.5, marginTop: 2 }}>
                              {mod.description}
                            </p>
                          )}
                        </div>

                        {/* Module Exam CTA */}
                        <div className="shrink-0">
                          <button
                            onClick={() =>
                              navigate(
                                modLocked
                                  ? (isLoggedIn ? "/paywall" : "/signup")
                                  : `/subjects/all/${mod.id}/${currentBlockDef.block}`
                              )
                            }
                            className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all hover:scale-[1.02]"
                            style={{
                              backgroundColor: modLocked ? t.gold : t.purpleStrong,
                              color: "#fff",
                            }}
                          >
                            {modLocked ? <Lock size={13} fill="#fff" /> : <Play size={13} fill="#fff" />}
                            {modLocked ? "Unlock Module" : `Practice Module`}
                          </button>
                        </div>
                      </div>

                      {/* Subjects in this Module */}
                      <div>
                        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                          {mod.subjects.map(({ subjectId, count: countInModule }) => {
                            const subjId = subjectId as SubjectId;
                            const meta = SUBJECT_META[subjId] || { label: subjId, tag: "MBBS" };
                            const color = t.teal;
                            const subjLocked = isSubjectLocked(currentBlockDef.block, subjId);
                            const subjFree = currentBlockLocked && !subjLocked;

                            return (
                              <div
                                key={subjId}
                                onClick={() =>
                                  navigate(
                                    subjLocked
                                      ? (isLoggedIn ? "/paywall" : "/signup")
                                      : `/subjects/${subjId}/${mod.id}/${currentBlockDef.block}`
                                  )
                                }
                                className="flex cursor-pointer items-center gap-3 rounded-xl p-3 transition-all hover:scale-[1.01]"
                                style={{
                                  backgroundColor: t.surface,
                                  border: `1px solid ${t.border}`,
                                }}
                              >
                                <div
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl relative"
                                  style={{ backgroundColor: `${color}22` }}
                                >
                                  {subjLocked && (
                                    <div
                                      className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full shadow-sm"
                                      style={{ backgroundColor: t.gold, color: "#241A08" }}
                                    >
                                      <Lock size={8} strokeWidth={3} />
                                    </div>
                                  )}
                                  <SubjectIcon id={subjId} color={color} size={15} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13 }}>
                                    {meta.label}
                                  </span>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                  {subjFree && (
                                    <span
                                      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                                      style={{ backgroundColor: `${t.teal}22`, color: t.teal }}
                                    >
                                      FREE
                                    </span>
                                  )}
                                  <span
                                    className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold"
                                    style={{
                                      backgroundColor: countInModule > 0 ? `${t.green}20` : t.surfaceAlt,
                                      color: countInModule > 0 ? t.green : t.textFaint,
                                    }}
                                  >
                                    {countInModule} Qs
                                  </span>
                                  <ArrowRight size={12} color={t.textFaint} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SUBJECT DIRECTORY VIEW                                                 */}
      {/* ========================================================================= */}
      {activeTab === "subject" && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SUBJECT_LIST.map((id, i) => {
              const meta = SUBJECT_META[id];
              const color = t.chip[i % t.chip.length];
              const qCount = subjectCounts?.[id] ?? 0;

              return (
                <Card
                  key={id}
                  t={t}
                  onClick={() => navigate(`/subjects/${id}`)}
                  className="flex cursor-pointer items-center gap-4 transition-all hover:scale-[1.01]"
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: `${color}22` }}
                  >
                    <SubjectIcon id={id} color={color} size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>
                      {meta.label}
                    </span>
                    <div className="truncate text-xs" style={{ color: t.textFaint }}>
                      {meta.tag}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-1 font-mono text-xs font-bold"
                      style={{ backgroundColor: `${t.gold}18`, color: t.gold }}
                    >
                      {subjectCounts ? `${qCount} Qs` : "Loading\u2026"}
                    </span>
                    <ChevronRight size={16} color={t.textFaint} />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
