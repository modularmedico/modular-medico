import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ArrowRight, FolderTree } from "lucide-react";
import Card from "../components/Card";
import Spinner from "../components/Spinner";
import SubjectIcon from "../components/SubjectIcon";
import { THEME, FONT_DISPLAY } from "../theme";
import { useAppStore } from "../store/useAppStore";
import { SUBJECT_META, DEFAULT_BLOCK_DEFINITIONS, type SubjectId } from "../data/subjects";
import { subscribeBlockDefinitions } from "../services/adminContent";
import { subscribePublishedPastPapers } from "../services/pastPapers";
import type { FirestorePastPaper } from "../types";

/** Past Papers for one Block — shows every Subject that has at least one published paper. */
export default function PastPaperBlock() {
  const navigate = useNavigate();
  const { block: blockParam = "" } = useParams();
  const blockNum = Number(blockParam);

  const isDark = useAppStore((s) => s.isDark);
  const t = isDark ? THEME.dark : THEME.light;

  const [blockDefs, setBlockDefs] = useState(DEFAULT_BLOCK_DEFINITIONS);
  useEffect(() => subscribeBlockDefinitions(setBlockDefs), []);
  const blockDef = blockDefs.find((b) => b.block === blockNum);

  const [papers, setPapers] = useState<FirestorePastPaper[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const unsub = subscribePublishedPastPapers((p) => {
      setPapers(p);
      setLoaded(true);
    });
    return () => unsub();
  }, []);

  const subjectsInBlock = useMemo(() => {
    const counts = new Map<string, number>();
    papers
      .filter((p) => p.block === blockNum)
      .forEach((p) => counts.set(p.subjectId, (counts.get(p.subjectId) || 0) + 1));
    return Array.from(counts.entries()).map(([subjectId, count]) => ({ subjectId, count }));
  }, [papers, blockNum]);

  if (!Number.isInteger(blockNum)) {
    return (
      <div className="py-16 text-center">
        <p style={{ color: t.textMuted }}>That block couldn't be found.</p>
        <button onClick={() => navigate("/past-papers")} className="mt-3 text-sm font-bold" style={{ color: t.teal }}>
          Back to Past Papers
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <button
        onClick={() => navigate("/past-papers")}
        className="flex items-center gap-1 text-sm font-bold self-start"
        style={{ color: t.textMuted }}
      >
        <ChevronLeft size={15} /> Past Papers
      </button>

      <div>
        <span
          className="inline-block rounded-full px-3 py-1 text-xs font-bold"
          style={{ backgroundColor: `${t.gold}22`, color: t.gold }}
        >
          Block {blockNum} of 15
        </span>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, marginTop: 8 }}>
          {blockDef ? blockDef.title : `Block ${blockNum}`} — Past Papers
        </h1>
        <p style={{ color: t.textMuted, fontSize: 13.5, marginTop: 2 }}>
          Select a subject to view its previous exam papers.
        </p>
      </div>

      {!loaded && (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-2xl p-10 text-center"
          style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}` }}
        >
          <Spinner t={t} size={22} label="Loading subjects\u2026" />
        </div>
      )}

      {loaded && subjectsInBlock.length === 0 && (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-2xl p-10 text-center"
          style={{ backgroundColor: t.surfaceAlt, border: `1.5px dashed ${t.border}` }}
        >
          <FolderTree size={22} color={t.textFaint} />
          <h4 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>Coming Soon</h4>
          <p className="max-w-sm text-xs" style={{ color: t.textMuted }}>
            No Past Papers have been added to Block {blockNum} yet.
          </p>
        </div>
      )}

      {loaded && subjectsInBlock.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subjectsInBlock.map(({ subjectId, count }) => {
            const meta = SUBJECT_META[subjectId as SubjectId] || { label: subjectId, tag: "" };
            return (
              <Card
                key={subjectId}
                t={t}
                onClick={() => navigate(`/past-papers/${blockNum}/${subjectId}`)}
                className="flex cursor-pointer items-center gap-4 transition-all hover:scale-[1.01]"
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `${t.gold}22` }}
                >
                  <SubjectIcon id={subjectId as SubjectId} color={t.gold} size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>{meta.label}</span>
                  <div className="truncate text-xs" style={{ color: t.textFaint }}>{meta.tag}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-1 font-mono text-xs font-bold"
                    style={{ backgroundColor: `${t.gold}18`, color: t.gold }}
                  >
                    {count} {count === 1 ? "Paper" : "Papers"}
                  </span>
                  <ArrowRight size={16} color={t.textFaint} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
