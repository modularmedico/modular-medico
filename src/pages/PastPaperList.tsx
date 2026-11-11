import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, FileStack, FolderTree, X, ExternalLink, ChevronRight, CheckCircle2, XCircle, Eye, Flag, FlagOff, RotateCcw, PartyPopper } from "lucide-react";
import Spinner from "../components/Spinner";
import AiExplain from "../components/AiExplain";
import SaveMcqButton from "../components/SaveMcqButton";
import ReviewPrompt from "../components/ReviewPrompt";
import ResumeModal from "../components/ResumeModal";
import ContinueBanner from "../components/ContinueBanner";
import Btn from "../components/Btn";
import EndTestModal from "../components/EndTestModal";
import { useSavedMcqs } from "../hooks/useSavedMcqs";
import { mcqKey } from "../utils/mcqKey";
import {
  clearPaperProgress,
  getPaperProgress,
  latestPaperProgress,
  paperHasProgress,
  paperResumeUrl,
  savePaperProgress,
} from "../utils/resume";
import { THEME, FONT_DISPLAY } from "../theme";
import { useAppStore, useIsLoggedIn, useIsPaperBlockUnlocked } from "../store/useAppStore";
import { paperIsPlaceable } from "./hubShared";
import { subscribePublishedPastPapers, toDrivePreviewUrl } from "../services/pastPapers";
import type { FirestorePastPaper, PaperProgress } from "../types";

/** Past Papers for one (Block, Subheading) pair — the actual list of exam papers. */
export default function PastPaperList() {
  const navigate = useNavigate();
  const { block: blockParam = "" } = useParams();
  const blockNum = Number(blockParam);
  const [searchParams, setSearchParams] = useSearchParams();
  const fTopic = searchParams.get("topic") || undefined;

  const isDark = useAppStore((s) => s.isDark);
  const isLoggedIn = useIsLoggedIn();
  const paperBlockOpen = useIsPaperBlockUnlocked(blockNum);
  const t = isDark ? THEME.dark : THEME.light;

  const [allPapers, setAllPapers] = useState<FirestorePastPaper[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activePaper, setActivePaper] = useState<FirestorePastPaper | null>(null);

  // Quiz state — only used when the active paper has manually-entered MCQs
  // instead of (or alongside) a Google Drive link.
  const [mcqIndex, setMcqIndex] = useState(0);
  // Picked option per MCQ index, and which MCQs had "Show answer" tapped. Both are saved to
  // localStorage so a student can leave mid-paper and continue from the same question later.
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [finished, setFinished] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  // Waiting on the student's "continue or start over?" choice before opening a paper.
  const [resumePrompt, setResumePrompt] = useState<{ paper: FirestorePastPaper; prog: PaperProgress; same: boolean } | null>(null);
  const saved = useSavedMcqs();

  const resetViewer = (paper: FirestorePastPaper | null, from?: PaperProgress | null) => {
    setActivePaper(paper);
    setMcqIndex(from ? Math.min(from.index, Math.max(0, (paper?.mcqs?.length ?? 1) - 1)) : 0);
    setAnswers(from?.answers ?? {});
    setRevealed(from?.revealed ?? {});
    setFinished(false);
    setShowEndConfirm(false);
  };

  const closePaper = () => resetViewer(null);

  const goToMcq = (idx: number) => setMcqIndex(idx);

  // Tapping a paper: if it (or another paper) has unfinished progress, ask first.
  const pickPaper = (p: FirestorePastPaper) => {
    if (!p.mcqs || p.mcqs.length === 0) {
      resetViewer(p);
      return;
    }
    const own = getPaperProgress(p.id);
    if (paperHasProgress(own)) {
      setResumePrompt({ paper: p, prog: own, same: true });
      return;
    }
    const other = latestPaperProgress();
    if (other && other.paperId !== p.id) {
      setResumePrompt({ paper: p, prog: other, same: false });
      return;
    }
    resetViewer(p);
  };

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
        (p) => paperIsPlaceable(p) && p.block === blockNum && (p.topicName || "").trim() === fTopic
      ),
    [allPapers, blockNum, fTopic]
  );

  const activeMcqsForSave = activePaper?.mcqs || [];

  // Keep the student's place in localStorage while a paper with MCQs is open, so leaving halfway
  // (closing the paper, the tab, or the whole app) can be continued later from the same MCQ.
  useEffect(() => {
    if (!activePaper || finished || activeMcqsForSave.length === 0) return;
    savePaperProgress({
      paperId: activePaper.id,
      title: activePaper.description || activePaper.title,
      block: blockNum,
      topic: fTopic || "",
      index: mcqIndex,
      answers,
      revealed,
      total: activeMcqsForSave.length,
      updatedAt: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePaper, mcqIndex, answers, revealed, finished]);

  // Arriving from a "Continue" banner (?resume=<paperId>): reopen that paper where it was left.
  const resumeId = searchParams.get("resume");
  useEffect(() => {
    if (!resumeId || !loaded || activePaper) return;
    const paper = papers.find((p) => p.id === resumeId);
    const prog = getPaperProgress(resumeId);
    if (paper && paper.mcqs && paper.mcqs.length > 0) resetViewer(paper, prog);
    // Drop the param so closing the paper doesn't reopen it.
    const next = new URLSearchParams(searchParams);
    next.delete("resume");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId, loaded, papers]);

  const previewUrl = activePaper?.driveUrl ? toDrivePreviewUrl(activePaper.driveUrl) : null;
  const activeMcqs = activePaper?.mcqs || [];
  const currentMcq = activeMcqs[mcqIndex];
  const mcqSelected: number | null = answers[mcqIndex] ?? null;

  // This Block's Past Papers are paywalled (direct links included).
  if (Number.isInteger(blockNum) && !paperBlockOpen) {
    return <Navigate to={isLoggedIn ? "/paywall" : "/signup"} replace />;
  }

  // No subheading picked (e.g. an old /past-papers/:block link) -> send them to the Block's subheadings.
  if (Number.isInteger(blockNum) && !fTopic) {
    return <Navigate to={`/browse/papers/${blockNum}`} replace />;
  }

  if (!Number.isInteger(blockNum)) {
    return (
      <div className="py-16 text-center">
        <p style={{ color: t.textMuted }}>That subheading couldn't be found.</p>
        <button onClick={() => navigate("/browse/papers")} className="mt-3 text-sm font-bold" style={{ color: t.teal }}>
          Back to Past Papers
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <button
        onClick={() => navigate(`/browse/papers/${blockNum}`)}
        className="flex items-center gap-1 text-sm font-bold self-start"
        style={{ color: t.textMuted }}
      >
        <ChevronLeft size={15} /> Block {blockNum}
      </button>

      <ContinueBanner kinds={["paper"]} />

      <div>
        <span
          className="inline-block rounded-full px-3 py-1 text-xs font-bold"
          style={{ backgroundColor: `${t.gold}22`, color: t.gold }}
        >
          Block {blockNum}
        </span>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, marginTop: 8 }}>
          {fTopic}
        </h1>
        <p style={{ color: t.textMuted, fontSize: 13.5, marginTop: 2 }}>Past Papers</p>
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
            No Past Papers have been added under {fTopic} in Block {blockNum} yet.
          </p>
        </div>
      )}

      {loaded && papers.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {papers.map((p) => (
            <button
              key={p.id}
              onClick={() => pickPaper(p)}
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
                <div className="truncate text-sm font-bold">{p.description || p.title}</div>
                {p.description && (
                  <div className="truncate text-[11px]" style={{ color: t.textFaint }}>{p.title}</div>
                )}
                {p.mcqs && p.mcqs.length > 0 && (
                  <div className="truncate text-[11px] font-semibold" style={{ color: t.teal }}>
                    {p.mcqs.length} MCQ{p.mcqs.length !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* "Continue or start over?" popup */}
      {resumePrompt && (
        <ResumeModal
          t={t}
          title={resumePrompt.prog.title}
          progress={`Question ${Math.min(resumePrompt.prog.index + 1, resumePrompt.prog.total)} of ${resumePrompt.prog.total}`}
          description={
            resumePrompt.same
              ? "You already started this paper. Pick up from the question you stopped at, or begin it again from the start."
              : `You have another paper in progress. Starting "${resumePrompt.paper.description || resumePrompt.paper.title}" will replace it.`
          }
          startOverLabel={resumePrompt.same ? "Start this paper over" : "Start the new paper"}
          onClose={() => setResumePrompt(null)}
          onContinue={() => {
            const { paper, prog, same } = resumePrompt;
            setResumePrompt(null);
            if (same) resetViewer(paper, prog);
            else navigate(paperResumeUrl(prog));
          }}
          onStartOver={() => {
            const { paper, prog } = resumePrompt;
            setResumePrompt(null);
            clearPaperProgress(prog.paperId);
            resetViewer(paper);
          }}
        />
      )}

      {/* PDF Preview Modal */}
      {activePaper && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: t.surface }}>
          <div className="flex items-start justify-between gap-3 p-4" style={{ borderBottom: `1.5px solid ${t.border}` }}>
            <div className="min-w-0">
              <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }} className="truncate">
                {activePaper.description || activePaper.title}
              </h3>
              {activePaper.description && (
                <p className="mt-1 truncate text-xs" style={{ color: t.textMuted }}>{activePaper.title}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {activePaper.driveUrl && (
                <a
                  href={activePaper.driveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold"
                  style={{ backgroundColor: t.surfaceAlt, color: t.teal }}
                >
                  Open in Drive <ExternalLink size={12} />
                </a>
              )}
              <button
                onClick={closePaper}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: t.surfaceAlt }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {activeMcqs.length > 0 && finished ? (
              <div className="mx-auto flex max-w-2xl flex-col gap-4 p-5">
                {(() => {
                  const picked = Object.keys(answers).length;
                  const correctCount = activeMcqs.filter((m, i) => answers[i] === m.correct).length;
                  const pct = picked > 0 ? Math.round((correctCount / activeMcqs.length) * 100) : 0;
                  return (
                    <div
                      className="flex flex-col items-center gap-2 rounded-2xl p-6 text-center"
                      style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}` }}
                    >
                      <PartyPopper size={28} color={t.gold} />
                      <h4 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20 }}>Paper complete</h4>
                      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 44, color: pct >= 80 ? t.green : pct >= 50 ? t.gold : t.red, lineHeight: 1 }}>
                        {pct}%
                      </div>
                      <p className="text-sm" style={{ color: t.textMuted }}>
                        {correctCount} correct out of {activeMcqs.length} MCQs
                        {picked < activeMcqs.length ? ` · ${activeMcqs.length - picked} unanswered` : ""}
                      </p>
                    </div>
                  );
                })()}
                <ReviewPrompt source="past_paper" context={`Block ${blockNum} · ${fTopic ?? ""} · ${activePaper.description || activePaper.title}`} />
                <div className="flex gap-3">
                  <Btn t={t} variant="ghost" full icon={RotateCcw} onClick={() => resetViewer(activePaper)}>
                    Try again
                  </Btn>
                  <Btn t={t} full onClick={closePaper}>
                    Done
                  </Btn>
                </div>
              </div>
            ) : activeMcqs.length > 0 && currentMcq ? (
              <div className="mx-auto flex max-w-2xl flex-col gap-4 p-5">
                <div className="flex items-center gap-3">
                  <span className="shrink-0 whitespace-nowrap text-xs font-bold" style={{ color: t.textMuted }}>
                    Question {mcqIndex + 1} of {activeMcqs.length}
                  </span>
                  {/* Always fits the screen: segments share the width (flex-1) for short sets,
                      and become one continuous bar for long ones. */}
                  {activeMcqs.length <= 15 ? (
                    <div className="flex min-w-0 flex-1 gap-1" aria-hidden>
                      {activeMcqs.map((_, i) => (
                        <span
                          key={i}
                          className="h-1.5 min-w-0 flex-1 rounded-full"
                          style={{ backgroundColor: i <= mcqIndex ? t.teal : t.border }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div
                      className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full"
                      style={{ backgroundColor: t.border }}
                      role="progressbar"
                      aria-valuemin={1}
                      aria-valuemax={activeMcqs.length}
                      aria-valuenow={mcqIndex + 1}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${((mcqIndex + 1) / activeMcqs.length) * 100}%`, backgroundColor: t.teal }}
                      />
                    </div>
                  )}
                </div>

                <h4 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>{currentMcq.q}</h4>

                <div className="flex flex-col gap-2">
                  {currentMcq.options.map((opt, optIdx) => {
                    const isCorrect = optIdx === currentMcq.correct;
                    const isPicked = optIdx === mcqSelected;
                    const showAns = mcqSelected !== null || !!revealed[mcqIndex];
                    return (
                      <button
                        key={optIdx}
                        onClick={() => setAnswers((prev) => ({ ...prev, [mcqIndex]: optIdx }))}
                        disabled={showAns}
                        className="flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold transition-all"
                        style={{
                          backgroundColor: showAns && isCorrect ? `${t.green}20` : showAns && isPicked ? `${t.red}15` : t.surfaceAlt,
                          border: `1.5px solid ${showAns && isCorrect ? t.green : showAns && isPicked ? t.red : t.border}`,
                          color: showAns && isCorrect ? t.green : showAns && isPicked ? t.red : t.text,
                        }}
                      >
                        <span>{opt}</span>
                        {showAns && isCorrect && <CheckCircle2 size={16} />}
                        {showAns && isPicked && !isCorrect && <XCircle size={16} />}
                      </button>
                    );
                  })}
                </div>

                {(mcqSelected !== null || revealed[mcqIndex]) && currentMcq.explanation && (
                  <div className="rounded-xl p-3 text-xs" style={{ backgroundColor: t.surfaceAlt, color: t.textMuted }}>
                    {currentMcq.explanation}
                  </div>
                )}

                {mcqSelected !== null && (
                  <div>
                    <AiExplain
                      key={`${activePaper?.id}-${mcqIndex}`}
                      question={currentMcq.q}
                      options={currentMcq.options}
                      correct={currentMcq.correct}
                      selected={mcqSelected}
                      explanation={currentMcq.explanation}
                    />
                  </div>
                )}

                {/* Prominent Save MCQ — saved MCQs live on the Saved page */}
                <SaveMcqButton
                  t={t}
                  full
                  saved={saved.isSaved(currentMcq)}
                  busy={saved.busyKey === mcqKey(currentMcq)}
                  onClick={() =>
                    saved.toggle(currentMcq, {
                      subjectId: "past-paper",
                      moduleName: activePaper.description || activePaper.title,
                      block: blockNum,
                    })
                  }
                />
                {saved.needsLogin && (
                  <div className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-xs" style={{ backgroundColor: `${t.gold}20`, border: `1.5px solid ${t.gold}` }}>
                    <span>Log in to save MCQs and find them later on the Saved page.</span>
                    <div className="flex shrink-0 items-center gap-3">
                      <button onClick={saved.goLogin} className="font-bold" style={{ color: t.teal }}>Log in</button>
                      <button onClick={saved.dismissLogin} aria-label="Dismiss" style={{ color: t.textFaint }}><X size={14} /></button>
                    </div>
                  </div>
                )}
                {saved.error && (
                  <div className="rounded-xl px-3.5 py-2.5 text-xs" style={{ backgroundColor: `${t.red}18`, color: t.red }}>{saved.error}</div>
                )}

                {/* Previous · Show answer · Next */}
                <div className="mt-1 grid grid-cols-3 items-center gap-2">
                  <button
                    onClick={() => goToMcq(Math.max(0, mcqIndex - 1))}
                    disabled={mcqIndex === 0}
                    className="flex items-center justify-center gap-1 rounded-lg px-3 py-2.5 text-xs font-bold disabled:opacity-40"
                    style={{ backgroundColor: t.surfaceAlt, color: t.textMuted }}
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>
                  <button
                    onClick={() => setRevealed((prev) => ({ ...prev, [mcqIndex]: !prev[mcqIndex] }))}
                    disabled={mcqSelected !== null}
                    className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-extrabold disabled:opacity-40"
                    style={{ backgroundColor: `${t.teal}1F`, color: t.teal, border: `1.5px solid ${t.teal}` }}
                  >
                    <Eye size={14} /> {revealed[mcqIndex] && mcqSelected === null ? "Hide answer" : "Show answer"}
                  </button>
                  {mcqIndex === activeMcqs.length - 1 ? (
                    <button
                      onClick={() => {
                        clearPaperProgress(activePaper.id);
                        setFinished(true);
                      }}
                      className="flex items-center justify-center gap-1 rounded-lg px-3 py-2.5 text-xs font-bold"
                      style={{ backgroundColor: t.gold, color: "#241A08" }}
                    >
                      Finish <Flag size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={() => goToMcq(Math.min(activeMcqs.length - 1, mcqIndex + 1))}
                      className="flex items-center justify-center gap-1 rounded-lg px-3 py-2.5 text-xs font-bold"
                      style={{ backgroundColor: t.teal, color: "#fff" }}
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowEndConfirm(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-extrabold"
                  style={{ backgroundColor: `${t.red}14`, color: t.red, border: `1.5px solid ${t.red}66` }}
                >
                  <FlagOff size={14} /> End test
                </button>
                <EndTestModal
                  t={t}
                  open={showEndConfirm}
                  noun="paper"
                  answered={Object.keys(answers).length}
                  total={activeMcqs.length}
                  onCancel={() => setShowEndConfirm(false)}
                  onConfirm={() => {
                    setShowEndConfirm(false);
                    clearPaperProgress(activePaper.id);
                    setFinished(true);
                  }}
                />
              </div>
            ) : previewUrl ? (
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
