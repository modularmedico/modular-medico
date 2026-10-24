import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, FileStack, FolderTree, X, ExternalLink } from "lucide-react";
import Spinner from "../components/Spinner";
import { THEME, FONT_DISPLAY } from "../theme";
import { useAppStore } from "../store/useAppStore";
import { SUBJECT_META, type SubjectId } from "../data/subjects";
import { GENERAL_LABEL, GENERAL_KEY, matchesFilter, slugify } from "./hubShared";
import { subscribePublishedPastPapers, toDrivePreviewUrl } from "../services/pastPapers";
import type { FirestorePastPaper } from "../types";

/** Past Papers for one (Block, Subject) pair — the actual list of exam paper links. */
export default function PastPaperSubject() {
  const navigate = useNavigate();
  const { block: blockParam = "", subjectId = "" } = useParams();
  const blockNum = Number(blockParam);
  const [searchParams] = useSearchParams();
  const fModule = searchParams.get("module") || undefined;
  const fTopic = searchParams.get("topic") || undefined;

  const isDark = useAppStore((s) => s.isDark);
  const t = isDark ? THEME.dark : THEME.light;

  const [allPapers, setAllPapers] = useState<FirestorePastPaper[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activePaper, setActivePaper] = useState<FirestorePastPaper | null>(null);

  useEffect(() => {
    const unsub = subscribePublishedPastPapers((p) => {
      setAllPapers(p);
      setLoaded(true);
    });
    return () => unsub();
  }, []);

  const papers = useMemo(
    () =>
      allPapers.filter(
        (p) =>
          p.block === blockNum &&
          p.subjectId === subjectId &&
          matchesFilter(
            {
              block: p.block,
              moduleId: slugify((p.moduleName || "").trim() || GENERAL_LABEL),
              subjectId: p.subjectId,
              topic: (p.topicName || "").trim() || null,
            },
            { module: fModule, topic: fTopic }
          )
      ),
    [allPapers, blockNum, subjectId, fModule, fTopic]
  );

  const meta = SUBJECT_META[subjectId as SubjectId] || { label: subjectId, tag: "" };
  const previewUrl = activePaper ? toDrivePreviewUrl(activePaper.driveUrl) : null;

  if (!Number.isInteger(blockNum) || !subjectId) {
    return (
      <div className="py-16 text-center">
        <p style={{ color: t.textMuted }}>That subject couldn't be found.</p>
        <button onClick={() => navigate("/browse/papers")} className="mt-3 text-sm font-bold" style={{ color: t.teal }}>
          Back to Past Papers
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <button
        onClick={() => navigate(fModule ? `/browse/papers/${blockNum}/${fModule}/${subjectId}` : `/browse/papers/${blockNum}`)}
        className="flex items-center gap-1 text-sm font-bold self-start"
        style={{ color: t.textMuted }}
      >
        <ChevronLeft size={15} /> {fModule ? "Subheadings" : `Block ${blockNum}`}
      </button>

      <div>
        <span
          className="inline-block rounded-full px-3 py-1 text-xs font-bold"
          style={{ backgroundColor: `${t.gold}22`, color: t.gold }}
        >
          Block {blockNum}
        </span>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, marginTop: 8 }}>
          {meta.label} — Past Papers
        </h1>
        {fTopic && (
          <p style={{ color: t.textMuted, fontSize: 13.5, marginTop: 2 }}>
            {fTopic === GENERAL_KEY ? GENERAL_LABEL : fTopic}
          </p>
        )}
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
            No Past Papers have been added for {meta.label} in Block {blockNum} yet.
          </p>
        </div>
      )}

      {loaded && papers.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {papers.map((p) => (
            <button
              key={p.id}
              onClick={() => setActivePaper(p)}
              className="flex items-center gap-3 rounded-xl p-3 text-left transition-all hover:scale-[1.01]"
              style={{ backgroundColor: t.surfaceAlt, border: `1px solid ${t.border}` }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${t.gold}22` }}
              >
                <FileStack size={18} color={t.gold} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{p.title}</div>
                {p.description && (
                  <div className="truncate text-[11px]" style={{ color: t.textFaint }}>{p.description}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* PDF Preview Modal */}
      {activePaper && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: t.surface }}>
          <div className="flex items-start justify-between gap-3 p-4" style={{ borderBottom: `1.5px solid ${t.border}` }}>
            <div className="min-w-0">
              <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }} className="truncate">
                {activePaper.title}
              </h3>
              {activePaper.description && (
                <p className="mt-1 truncate text-xs" style={{ color: t.textMuted }}>{activePaper.description}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={activePaper.driveUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold"
                style={{ backgroundColor: t.surfaceAlt, color: t.teal }}
              >
                Open in Drive <ExternalLink size={12} />
              </a>
              <button
                onClick={() => setActivePaper(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: t.surfaceAlt }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            {previewUrl ? (
              <iframe src={previewUrl} title={activePaper.title} className="h-full w-full" allow="autoplay" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center">
                <FileStack size={22} color={t.textFaint} />
                <p className="text-xs" style={{ color: t.textMuted }}>Preview isn't available for this link.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
