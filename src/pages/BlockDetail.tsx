import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Play, ArrowRight, FolderTree, Lock } from "lucide-react";
import Card from "../components/Card";
import Btn from "../components/Btn";
import SubjectIcon from "../components/SubjectIcon";
import Spinner from "../components/Spinner";
import { THEME, FONT_DISPLAY } from "../theme";
import { useAppStore, useIsLoggedIn, useIsPremium } from "../store/useAppStore";
import { SUBJECT_META, DEFAULT_BLOCK_DEFINITIONS, type BlockDefinition, type SubjectId } from "../data/subjects";
import {
  subscribeBlockDefinitions,
  subscribeBlockOutline,
  subscribeFreeSubjects,
  isSubjectFree,
  blockHasFreeSubject,
  type BlockOutline,
  type FreeSubjectsMap,
} from "../services/adminContent";

export default function BlockDetail() {
  const navigate = useNavigate();
  const { block: blockParam = "" } = useParams();
  const blockNum = Number(blockParam);

  const isDark = useAppStore((s) => s.isDark);
  const isLoggedIn = useIsLoggedIn();
  const isPremium = useIsPremium();
  const isAdmin = useAppStore((s) => s.isAdmin);
  const unlockedBlocks = useAppStore((s) => s.profile?.unlockedBlocks);
  const freeBlocks = useAppStore((s) => s.freeBlocks);
  const isBlockUnlocked = (block: number) =>
    freeBlocks.includes(block) || isAdmin || isPremium || !!unlockedBlocks?.includes(block);
  const t = isDark ? THEME.dark : THEME.light;

  const [freeSubjects, setFreeSubjects] = useState<FreeSubjectsMap>({});
  useEffect(() => subscribeFreeSubjects(setFreeSubjects), []);
  const isSubjectLocked = (block: number, subjectId: string) =>
    !isBlockUnlocked(block) && !isSubjectFree(freeSubjects, block, subjectId);

  const [blockDefs, setBlockDefs] = useState<BlockDefinition[]>(DEFAULT_BLOCK_DEFINITIONS);
  useEffect(() => subscribeBlockDefinitions(setBlockDefs), []);

  const [outline, setOutline] = useState<BlockOutline | null>(null);
  useEffect(() => {
    setOutline(null);
    if (!Number.isInteger(blockNum)) return;
    return subscribeBlockOutline(blockNum, setOutline);
  }, [blockNum]);

  if (!Number.isInteger(blockNum)) {
    return (
      <div className="py-16 text-center">
        <p style={{ color: t.textMuted }}>That block couldn't be found.</p>
        <button onClick={() => navigate("/subjects")} className="mt-3 text-sm font-bold" style={{ color: t.teal }}>
          Back to Practice Library
        </button>
      </div>
    );
  }

  const currentBlockDef = blockDefs.find((b) => b.block === blockNum) || {
    block: blockNum,
    title: `Block ${blockNum}`,
    year: "",
    description: "",
    modules: [],
  };
  const currentBlockLocked = !isBlockUnlocked(currentBlockDef.block);

  const outlineLoaded = !!outline;
  const displayModules = outline?.modules ?? [];
  const totalQuestionsInSelectedBlock = outline?.total ?? 0;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <button
        onClick={() => navigate("/subjects")}
        className="flex items-center gap-1 text-sm font-bold self-start"
        style={{ color: t.textMuted }}
      >
        <ChevronLeft size={15} /> Practice Library
      </button>

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
                {outlineLoaded ? `${totalQuestionsInSelectedBlock} Questions` : "Loading\u2026"}
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

        {/* Modules List inside this Block */}
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
  );
}
