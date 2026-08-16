import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Lock, Crown, Layers, ArrowRight, FolderTree } from "lucide-react";
import Card from "../components/Card";
import Btn from "../components/Btn";
import SubjectIcon from "../components/SubjectIcon";
import Spinner from "../components/Spinner";
import { THEME, FONT_DISPLAY } from "../theme";
import { useAppStore, useIsLoggedIn, useIsPremium } from "../store/useAppStore";
import {
  SUBJECT_LIST,
  SUBJECT_META,
  DEFAULT_BLOCK_DEFINITIONS,
  type SubjectId,
  type BlockDefinition,
} from "../data/subjects";
import {
  subscribeBlockDefinitions,
  subscribeCurriculumCounts,
  subscribeAllQuestions,
  type CurriculumCounts,
} from "../services/adminContent";
import type { FirestoreQuestion } from "../types";

export default function SubjectDetail() {
  const navigate = useNavigate();
  const { subjectId = "" } = useParams();
  const isDark = useAppStore((s) => s.isDark);
  const isLoggedIn = useIsLoggedIn();
  const isPremium = useIsPremium();
  const t = isDark ? THEME.dark : THEME.light;
  const [blockDefs, setBlockDefs] = useState<BlockDefinition[]>(DEFAULT_BLOCK_DEFINITIONS);
  const [allQuestions, setAllQuestions] = useState<FirestoreQuestion[]>([]);
  const [questionsLoaded, setQuestionsLoaded] = useState(false);
  const [counts, setCounts] = useState<CurriculumCounts>({
    blockCounts: {},
    moduleCounts: {},
    subjectInModuleCounts: {},
    subjectTotalCounts: {},
  });

  useEffect(() => subscribeBlockDefinitions(setBlockDefs), []);
  useEffect(() => subscribeCurriculumCounts(setCounts), []);
  useEffect(
    () =>
      subscribeAllQuestions((qs) => {
        setAllQuestions(qs);
        setQuestionsLoaded(true);
      }),
    []
  );

  if (!(SUBJECT_LIST as readonly string[]).includes(subjectId)) {
    return (
      <div className="py-16 text-center">
        <p style={{ color: t.textMuted }}>Subject not found.</p>
        <button onClick={() => navigate("/subjects")} className="mt-3 text-sm font-bold" style={{ color: t.teal }}>
          Back to curriculum explorer
        </button>
      </div>
    );
  }

  const meta = SUBJECT_META[subjectId as SubjectId];

  // Only show modules that actually have published MCQs for this subject — nothing is
  // pre-populated from the curriculum scaffold. A module appears here only once real
  // content has been added for it in the admin panel.
  const moduleAppearances: Array<{
    block: BlockDefinition;
    module: { id: string; name: string; description?: string };
    questionCount: number;
    locked: boolean;
  }> = [];

  const seenModuleKeys = new Set<string>();
  allQuestions
    .filter((q) => q.subjectId === subjectId && q.status === "published")
    .forEach((q) => {
      const modId = q.moduleId || q.moduleName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const key = `${q.block}-${modId}`;
      if (seenModuleKeys.has(key)) return;
      seenModuleKeys.add(key);

      const blockDef = blockDefs.find((b) => b.block === q.block);
      const count = counts.subjectInModuleCounts[`${q.block}-${modId}-${subjectId}`] || 0;
      const locked = q.block !== 1 && !isPremium;

      moduleAppearances.push({
        block:
          blockDef || {
            block: q.block,
            title: `Block ${q.block}`,
            year: "",
            description: "",
            modules: [],
          },
        module: { id: modId, name: q.moduleName || "General Module" },
        questionCount: count,
        locked,
      });
    });

  moduleAppearances.sort((a, b) => a.block.block - b.block.block);

  const totalSubjectQuestions = counts.subjectTotalCounts[subjectId] || 0;

  return (
    <div className="flex flex-col gap-6">
      <button
        onClick={() => navigate("/subjects")}
        className="flex items-center gap-1 text-sm font-bold self-start"
        style={{ color: t.textMuted }}
      >
        <ChevronLeft size={15} /> Curriculum Explorer
      </button>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${t.teal}22` }}
          >
            <SubjectIcon id={subjectId as SubjectId} color={t.teal} size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26 }}>{meta.label}</h1>
              <span
                className="rounded-full px-2.5 py-0.5 font-mono text-xs font-bold"
                style={{ backgroundColor: `${t.gold}20`, color: t.gold }}
              >
                {totalSubjectQuestions} Total Qs
              </span>
            </div>
            <p style={{ color: t.textMuted, fontSize: 14 }}>{meta.tag}</p>
          </div>
        </div>

        <Btn
          t={t}
          variant="secondary"
          icon={Layers}
          onClick={() => navigate("/subjects?view=block")}
        >
          View in Block Explorer
        </Btn>
      </div>

      {!isPremium && (
        <div className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs" style={{ backgroundColor: `${t.gold}18`, color: t.goldDeep }}>
          <Lock size={13} /> Block 1 is free in every module. Unlock all Blocks (1–15) free during Beta.
          <button onClick={() => navigate(isLoggedIn ? "/paywall" : "/signup")} className="ml-auto font-bold underline">
            Unlock Full Access
          </button>
        </div>
      )}

      {/* Curriculum Breakdown: Modules & Blocks Teaching This Subject */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18 }}>
              Modular Integration ({moduleAppearances.length} Modules across Blocks)
            </h2>
            <p style={{ color: t.textMuted, fontSize: 13 }}>
              In the modular MBBS system, {meta.label} is integrated into specific Block modules:
            </p>
          </div>
        </div>

        {!questionsLoaded && (
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-2xl p-10 text-center"
            style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}` }}
          >
            <Spinner t={t} size={22} label="Loading modules\u2026" />
          </div>
        )}

        {questionsLoaded && moduleAppearances.length === 0 && (
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-2xl p-10 text-center"
            style={{ backgroundColor: t.surfaceAlt, border: `1.5px dashed ${t.border}` }}
          >
            <FolderTree size={22} color={t.textFaint} />
            <h4 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>Coming Soon</h4>
            <p className="max-w-sm text-xs" style={{ color: t.textMuted }}>
              No MCQ banks have been added for {meta.label} yet. Modules will appear here automatically as soon as
              questions are published for this subject.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {moduleAppearances.map(({ block, module, questionCount, locked }) => (
            <Card
              key={`${block.block}-${module.id}`}
              t={t}
              onClick={
                locked
                  ? () => navigate(isLoggedIn ? "/paywall" : "/signup")
                  : () => navigate(`/subjects/${subjectId}/${module.id}/${block.block}`)
              }
              className="flex flex-col justify-between gap-4 p-5 cursor-pointer transition-all hover:scale-[1.01]"
              style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}` }}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                      style={{ backgroundColor: `${t.teal}22`, color: t.teal }}
                    >
                      Block {block.block}: {block.title}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{ backgroundColor: t.surface, color: t.textFaint }}
                    >
                      {block.year}
                    </span>
                  </div>
                  {locked && <Lock size={14} color={t.gold} />}
                </div>

                <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>
                  {module.name}
                </h3>
                {module.description && (
                  <p style={{ color: t.textMuted, fontSize: 12.5, marginTop: 4, lineHeight: 1.4 }}>
                    {module.description}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: t.border }}>
                <span
                  className="rounded-full px-2.5 py-0.5 font-mono text-xs font-bold"
                  style={{
                    backgroundColor: questionCount > 0 ? `${t.green}20` : t.surface,
                    color: questionCount > 0 ? t.green : t.textFaint,
                  }}
                >
                  {questionCount} {questionCount === 1 ? "Question" : "Questions"}
                </span>

                <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: locked ? t.gold : t.purpleStrong }}>
                  {locked ? "Unlock" : "Practice Set"}
                  <ArrowRight size={13} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {!isPremium && (
        <Btn t={t} full icon={Crown} onClick={() => navigate(isLoggedIn ? "/paywall" : "/signup")}>
          Unlock all blocks & question banks
        </Btn>
      )}
    </div>
  );
}
