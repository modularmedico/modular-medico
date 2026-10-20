import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, FileStack, FolderTree } from "lucide-react";
import Pill from "../components/Pill";
import Spinner from "../components/Spinner";
import { THEME, FONT_DISPLAY, FONT_MONO } from "../theme";
import { useAppStore } from "../store/useAppStore";
import { DEFAULT_BLOCK_DEFINITIONS } from "../data/subjects";
import { subscribeBlockDefinitions } from "../services/adminContent";
import { subscribePublishedPastPapers } from "../services/pastPapers";
import type { FirestorePastPaper } from "../types";

/**
 * Student-facing Past Papers library — organized Block -> Subject (no
 * Module/Topic). This top-level page shows every Block (1-15) with how
 * many published Past Papers it has; tapping one opens that Block's
 * subjects at /past-papers/:block.
 */
export default function PastPapers() {
  const navigate = useNavigate();
  const isDark = useAppStore((s) => s.isDark);
  const t = isDark ? THEME.dark : THEME.light;

  const [yearFilter, setYearFilter] = useState<string>("all");
  const [blockDefs, setBlockDefs] = useState(DEFAULT_BLOCK_DEFINITIONS);
  useEffect(() => subscribeBlockDefinitions(setBlockDefs), []);

  const [papers, setPapers] = useState<FirestorePastPaper[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const unsub = subscribePublishedPastPapers((p) => {
      setPapers(p);
      setLoaded(true);
    });
    return () => unsub();
  }, []);

  const countsByBlock = useMemo(() => {
    const counts: Record<number, number> = {};
    papers.forEach((p) => {
      counts[p.block] = (counts[p.block] || 0) + 1;
    });
    return counts;
  }, [papers]);

  const YEARS = [
    { id: "all", label: "All Blocks" },
    { id: "1st", label: "1st Year (B1\u20133)" },
    { id: "2nd", label: "2nd Year (B4\u20136)" },
    { id: "3rd", label: "3rd Year (B7\u20139)" },
    { id: "4th", label: "4th Year (B10\u201312)" },
    { id: "5th", label: "Final Year (B13\u201315)" },
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
      <button
        onClick={() => navigate("/subjects")}
        className="flex items-center gap-1 text-sm font-bold self-start"
        style={{ color: t.textMuted }}
      >
        <ChevronLeft size={15} /> Practice Library
      </button>

      <div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em" }}>
          Past Papers
        </h1>
        <p style={{ color: t.textMuted, fontSize: 13.5, marginTop: 2 }}>
          Previous university exam papers, organized by Block. Select a Block to see its subjects.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {YEARS.map((y) => (
          <Pill key={y.id} t={t} active={yearFilter === y.id} onClick={() => setYearFilter(y.id)}>
            {y.label}
          </Pill>
        ))}
      </div>

      {!loaded && (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-2xl p-10 text-center"
          style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}` }}
        >
          <Spinner t={t} size={22} label="Loading Past Papers\u2026" />
        </div>
      )}

      {loaded && papers.length === 0 && (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-2xl p-10 text-center"
          style={{ backgroundColor: t.surfaceAlt, border: `1.5px dashed ${t.border}` }}
        >
          <FolderTree size={22} color={t.textFaint} />
          <h4 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>Coming Soon</h4>
          <p className="max-w-sm text-xs" style={{ color: t.textMuted }}>
            No Past Papers have been added yet. Check back soon.
          </p>
        </div>
      )}

      {loaded && papers.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-15">
          {filteredBlockDefs.map((b) => {
            const count = countsByBlock[b.block] || 0;
            return (
              <button
                key={b.block}
                onClick={() => navigate(`/past-papers/${b.block}`)}
                className="flex flex-col items-center justify-center rounded-2xl p-2.5 transition-all text-center hover:scale-[1.02]"
                style={{ backgroundColor: t.surfaceAlt, color: t.text, border: `1.5px solid ${t.border}` }}
              >
                <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>B{b.block}</span>
                <span className="truncate max-w-[65px] text-[10px] font-semibold mt-0.5" style={{ color: t.gold }}>
                  {b.title.split(" ")[0]}
                </span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: t.textFaint, marginTop: 2 }}>
                  {count} {count === 1 ? "Paper" : "Papers"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {loaded && papers.length > 0 && (
        <div className="flex items-center gap-2 text-xs" style={{ color: t.textFaint }}>
          <FileStack size={13} /> {papers.length} total past {papers.length === 1 ? "paper" : "papers"} published
        </div>
      )}
    </div>
  );
}
