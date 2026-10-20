import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronRight,
  BookOpen,
  Layers,
  Lock,
  FileStack,
  ArrowRight,
} from "lucide-react";
import Card from "../components/Card";
import Pill from "../components/Pill";
import SubjectIcon from "../components/SubjectIcon";
import { THEME, FONT_DISPLAY, FONT_MONO } from "../theme";
import { useAppStore, useIsPremium } from "../store/useAppStore";
import {
  SUBJECT_LIST,
  SUBJECT_META,
  DEFAULT_BLOCK_DEFINITIONS,
} from "../data/subjects";
import {
  subscribeBlockDefinitions,
  subscribeBlockCounts,
  subscribeSubjectCounts,
} from "../services/adminContent";
import { subscribePublishedPastPapers } from "../services/pastPapers";

export default function Subjects() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("view") as "block" | "subject") || "block";

  const isDark = useAppStore((s) => s.isDark);
  const isPremium = useIsPremium();
  const unlockedBlocks = useAppStore((s) => s.profile?.unlockedBlocks);
  const freeBlocks = useAppStore((s) => s.freeBlocks);
  const t = isDark ? THEME.dark : THEME.light;

  // Block tile badge: any block that isn't in the free list is a paid block and always
  // shows a lock, unless this user has really bought it (premium or granted block).
  // (Admin access and per-subject free unlocks do NOT hide the tile lock.)
  const isBlockBadgeLocked = (block: number) =>
    !freeBlocks.includes(block) && !isPremium && !unlockedBlocks?.includes(block);

  const [yearFilter, setYearFilter] = useState<string>("all");
  const [blockDefs, setBlockDefs] = useState(DEFAULT_BLOCK_DEFINITIONS);
  // Only numbers (block/subject counts) load here. Clicking a block opens it on its own
  // page (BlockDetail), where the module -> subject outline for that one block loads.
  const [blockCounts, setBlockCounts] = useState<Record<number, number> | null>(null);
  const [subjectCounts, setSubjectCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => subscribeBlockDefinitions(setBlockDefs), []);

  // Past Papers count — powers the prominent banner below (student-facing,
  // published-only; counted exactly like the OSPE/Lectures libraries).
  const [pastPaperCount, setPastPaperCount] = useState<number | null>(null);
  useEffect(() => {
    const unsub = subscribePublishedPastPapers((papers) => setPastPaperCount(papers.length));
    return () => unsub();
  }, []);

  const blockKey = blockDefs.map((b) => b.block).join(",");
  useEffect(() => {
    const blocks = blockKey ? blockKey.split(",").map(Number) : [];
    return subscribeBlockCounts(blocks, setBlockCounts);
  }, [blockKey]);

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
      {/* PAST PAPERS — prominent banner, always visible regardless of the Block/  */}
      {/* Subject tab above, so it reads as its own top-level section.             */}
      {/* ========================================================================= */}
      <div
        onClick={() => navigate("/past-papers")}
        className="flex cursor-pointer items-center gap-4 rounded-[22px] p-5 transition-all hover:scale-[1.005]"
        style={{
          background: `linear-gradient(120deg, ${t.gold}26, ${t.purpleStrong}18)`,
          border: `1.5px solid ${t.gold}55`,
        }}
      >
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${t.gold}30` }}
        >
          <FileStack size={22} color={t.gold} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17 }}>Past Papers</h3>
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: t.gold, color: "#241A08" }}
            >
              New
            </span>
          </div>
          <p className="text-xs" style={{ color: t.textMuted, marginTop: 2 }}>
            Previous UHS exams
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="rounded-full px-2.5 py-1 font-mono text-xs font-bold"
            style={{ backgroundColor: `${t.gold}20`, color: t.gold }}
          >
            {pastPaperCount === null ? "Loading\u2026" : `${pastPaperCount} Papers`}
          </span>
          <ArrowRight size={16} color={t.textFaint} />
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
              const totalInBlock = blockCounts?.[b.block] ?? 0;
              const isLocked = isBlockBadgeLocked(b.block);

              return (
                <button
                  key={b.block}
                  onClick={() => navigate(`/subjects/block/${b.block}`)}
                  className="flex flex-col items-center justify-center rounded-2xl p-2.5 transition-all text-center relative hover:scale-[1.02]"
                  style={{
                    backgroundColor: t.surfaceAlt,
                    color: t.text,
                    border: `1.5px solid ${t.border}`,
                  }}
                >
                  {isLocked && (
                    <div
                      className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full shadow-md z-10"
                      style={{ backgroundColor: t.gold, color: "#241A08" }}
                      title="Requires Full Access"
                    >
                      <Lock size={11} strokeWidth={2.75} />
                    </div>
                  )}

                  <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>
                    B{b.block}
                  </span>
                  <span
                    className="truncate max-w-[65px] text-[10px] font-semibold mt-0.5"
                    style={{ color: t.teal }}
                  >
                    {b.title.split(" ")[0]}
                  </span>
                  <span
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 10,
                      color: t.textFaint,
                      marginTop: 2,
                    }}
                  >
                    {blockCounts ? `${totalInBlock} Qs` : "Loading\u2026"}
                  </span>
                </button>
              );
            })}
          </div>
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
