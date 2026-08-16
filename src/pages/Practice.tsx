import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Clock,
  Check,
  X,
  CheckCircle2,
  XCircle,
  ClipboardCopy,
  FlagOff,
  Monitor,
} from "lucide-react";
import Card from "../components/Card";
import Pill from "../components/Pill";
import Btn from "../components/Btn";
import { THEME, FONT_DISPLAY, FONT_MONO } from "../theme";
import { useAppStore } from "../store/useAppStore";
import { SUBJECT_META } from "../data/subjects";
import { addBookmark, recordQuizAttempt } from "../services/firestore";
import type { AnswerRecord } from "../types";

export default function Practice() {
  const navigate = useNavigate();
  const isDark = useAppStore((s) => s.isDark);
  const uid = useAppStore((s) => s.uid);
  const session = useAppStore((s) => s.session);
  const updateSession = useAppStore((s) => s.updateSession);
  const clearSession = useAppStore((s) => s.clearSession);
  const setLastResult = useAppStore((s) => s.setLastResult);
  const t = isDark ? THEME.dark : THEME.light;

  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() => {
    if (!session) return null;
    if (session.config.customTimerSeconds) return session.config.customTimerSeconds;
    if (session.config.mode === "exam") return session.queue.length * 60;
    if (session.config.timing === "timed") return 300;
    return null;
  });
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const addTimeSeconds = (sec: number) => {
    setSecondsLeft((curr) => (curr === null ? sec : curr + sec));
  };

  useEffect(() => {
    if (secondsLeft === null || finishing || isTimerPaused) return;
    if (secondsLeft <= 0) {
      finishNow();
      return;
    }
    const id = setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, finishing, isTimerPaused]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (["1", "2", "3", "4"].includes(e.key)) selectOption(Number(e.key) - 1);
      if (e.key === "Enter") (answered ? advance : submitAnswer)();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  if (!session) {
    return (
      <div className="py-16 text-center">
        <p style={{ color: t.textMuted }}>No practice session in progress.</p>
        <button onClick={() => navigate("/subjects")} className="mt-3 text-sm font-bold" style={{ color: t.teal }}>
          Choose a block
        </button>
      </div>
    );
  }

  const { setRef, config, queue, pos, record, bookmarked, requeueCount } = session;
  const isOmr = config.mode === "omr" || config.mode === "exam";
  const qIndex = queue[pos];
  const question = setRef.questions[qIndex];
  const totalSteps = queue.length;

  const selectOption = (i: number) => {
    if (!answered) setSelected(i);
  };

  const submitAnswer = () => {
    if (selected === null || answered || finishing) return;
    const correct = selected === question.correct;
    const newRecord = { ...record, [qIndex]: { selected, correct } };

    // Spaced repetition: requeue a wrong answer, but only ONCE per question — this is
    // what guarantees the set always terminates instead of looping on a question the
    // learner keeps missing.
    let newQueue = queue;
    let newRequeueCount = requeueCount;
    const alreadyRequeued = (requeueCount[qIndex] || 0) >= 1;
    if (!correct && config.spacedRep && !alreadyRequeued) {
      const insertAt = Math.min(pos + 5 + Math.floor(Math.random() * 6), queue.length);
      newQueue = [...queue];
      newQueue.splice(insertAt, 0, qIndex);
      newRequeueCount = { ...requeueCount, [qIndex]: (requeueCount[qIndex] || 0) + 1 };
    }

    updateSession({ record: newRecord, queue: newQueue, requeueCount: newRequeueCount });
    if (isOmr) {
      advanceFrom(newQueue, newRecord);
    } else {
      setAnswered(true);
    }
  };

  const advanceFrom = (q: number[], rec: Record<number, AnswerRecord>) => {
    if (pos + 1 >= q.length) {
      finishNow(rec);
      return;
    }
    updateSession({ pos: pos + 1 });
    setSelected(null);
    setAnswered(false);
    setCopied(false);
  };

  const advance = () => advanceFrom(queue, record);

  const finishNow = (rec: Record<number, AnswerRecord> = record) => {
    if (finishing) return;
    setFinishing(true);
    const answers: AnswerRecord[] = setRef.questions.map((_, i) => rec[i] || { selected: null, correct: false });
    setLastResult(setRef, answers);
    if (uid) {
      const correctCount = answers.filter((a) => a.correct).length;
      recordQuizAttempt(uid, {
        subjectId: setRef.subjectId,
        moduleName: setRef.moduleName,
        block: setRef.block,
        setTitle: setRef.setTitle,
        total: answers.length,
        correct: correctCount,
        scorePct: Math.round((correctCount / answers.length) * 100),
      }).catch(() => {
        /* non-fatal — the local result still shows even if the write fails */
      });
    }
    clearSession();
    navigate("/results");
  };

  const toggleBookmark = () => {
    if (!uid) return;
    if (bookmarked[qIndex]) {
      updateSession({ bookmarked: { ...bookmarked, [qIndex]: false } });
    } else {
      updateSession({ bookmarked: { ...bookmarked, [qIndex]: true } });
      addBookmark(uid, setRef.subjectId, setRef.moduleName, setRef.block, question).catch(() => {});
    }
  };

  const aiExplain = async () => {
    const text = `Question: ${question.q}\nMy answer: ${question.options[selected ?? 0]}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable — non-fatal */
    }
    setCopied(true);
    window.open("https://claude.ai/new", "_blank");
  };

  const mm = secondsLeft !== null ? String(Math.floor(secondsLeft / 60)).padStart(2, "0") : null;
  const ss = secondsLeft !== null ? String(secondsLeft % 60).padStart(2, "0") : null;

  const ExitAndFinishBar = (
    <div className="flex items-center gap-3">
      <button onClick={() => finishNow()} title="End practice now and see results" className="flex items-center gap-1 text-xs font-bold" style={{ color: t.textFaint }}>
        <FlagOff size={13} /> End now
      </button>
    </div>
  );

  if (isOmr) {
    return (
      <>
        {/* Mobile/Tablet warning */}
        <div className="md:hidden flex flex-col items-center justify-center py-20 text-center">
          <Monitor size={48} color={t.purple} className="mb-4" />
          <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20 }}>Desktop Required</h2>
          <p style={{ color: t.textMuted, marginTop: 8 }}>
            This mode features a split-screen layout that requires a wider screen. Please switch to a desktop or tablet device in landscape.
          </p>
          <Btn t={t} onClick={() => { clearSession(); navigate("/subjects"); }} style={{ marginTop: 24 }}>
            Exit Practice
          </Btn>
        </div>

        {/* Desktop Split View */}
        <div className="hidden md:flex gap-8 h-[calc(100vh-140px)]">
          {/* Left Side: MCQs */}
          <div className="flex-1 overflow-y-auto pr-4 pb-10">
            <div className="flex items-center justify-between mb-6 sticky top-0 z-10 py-3" style={{ backgroundColor: `${t.bg}F2`, backdropFilter: "blur(8px)" }}>
               <button onClick={() => { clearSession(); navigate("/subjects"); }} className="flex items-center gap-1 text-sm font-bold" style={{ color: t.textMuted }}>
                 <ChevronLeft size={15} /> Exit
               </button>
               <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: t.textFaint }}>
                 {config.mode === "exam" ? "MOCK EXAM" : "OMR MODE"} &middot; {totalSteps} QUESTIONS
               </span>
            </div>

            {queue.map((qIdx, index) => {
              const q = setRef.questions[qIdx];
              const selectedOption = record[qIdx]?.selected ?? null;
              const isBookmarked = bookmarked[qIdx];
              return (
                <div key={qIdx} className="mb-12">
                  <div className="flex gap-3 mb-5">
                    <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: t.purple }}>{index + 1}.</span>
                    <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, lineHeight: 1.5, flex: 1 }}>{q.q}</h3>
                    <button 
                      onClick={() => {
                        if (!uid) return;
                        updateSession({ bookmarked: { ...bookmarked, [qIdx]: !isBookmarked } });
                        if (!isBookmarked) {
                          addBookmark(uid, setRef.subjectId, setRef.moduleName, setRef.block, q).catch(() => {});
                        }
                      }} 
                      disabled={!uid} 
                      title={uid ? "Bookmark" : "Log in to bookmark"}
                      className="shrink-0 mt-1"
                    >
                      {isBookmarked ? <BookmarkCheck size={18} color={t.gold} /> : <Bookmark size={18} color={t.textFaint} />}
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5 pl-7">
                    {q.options.map((opt, i) => (
                      <div 
                        key={i} 
                        className="flex gap-3 items-start text-sm cursor-pointer p-2 -ml-2 rounded-xl transition-colors hover:bg-opacity-50"
                        style={{ backgroundColor: selectedOption === i ? `${t.purple}15` : "transparent" }}
                        onClick={() => {
                          if (finishing) return;
                          updateSession({ record: { ...record, [qIdx]: { selected: i, correct: i === q.correct } } });
                        }}
                      >
                        <span style={{ fontFamily: FONT_MONO, color: selectedOption === i ? t.purple : t.textFaint, fontWeight: selectedOption === i ? "bold" : "normal" }}>
                          {String.fromCharCode(65 + i)}.
                        </span>
                        <span style={{ color: selectedOption === i ? t.text : t.textMuted }}>{opt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Side: Bubble Sheet */}
          <div className="w-72 shrink-0 rounded-2xl flex flex-col overflow-hidden h-full shadow-lg" style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}>
            <div className="p-4 border-b flex justify-between items-center bg-opacity-50" style={{ borderColor: t.border, backgroundColor: t.surfaceAlt }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 15 }}>Bubble Sheet</span>
              {mm ? (
                <div className="flex items-center gap-1.5">
                  <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: secondsLeft! < 30 ? t.red : t.textMuted }}>
                    <Clock size={12} className="mr-1 inline" />
                    {mm}:{ss}
                  </span>
                  {config.mode !== "exam" && (
                    <button
                      onClick={() => addTimeSeconds(60)}
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold hover:opacity-80"
                      style={{ backgroundColor: `${t.teal}20`, color: t.teal }}
                      title="Add 1 minute"
                    >
                      +1m
                    </button>
                  )}
                </div>
              ) : (
                <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: t.textFaint }}>Untimed</span>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-5" style={{ backgroundImage: `repeating-linear-gradient(0deg, ${t.border}22 0, ${t.border}22 1px, transparent 1px, transparent 40px)` }}>
               {queue.map((qIdx, index) => {
                 const q = setRef.questions[qIdx];
                 const selectedOption = record[qIdx]?.selected ?? null;
                 return (
                   <div key={qIdx} className="flex items-center gap-4 h-[40px]">
                     <span className="w-6 text-right text-sm font-bold" style={{ color: t.textFaint, fontFamily: FONT_MONO }}>{index + 1}.</span>
                     <div className="flex gap-2">
                       {q.options.map((_, i) => (
                         <button
                           key={i}
                           onClick={() => {
                             if (finishing) return;
                             updateSession({ record: { ...record, [qIdx]: { selected: i, correct: i === q.correct } } });
                           }}
                           className="w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all hover:scale-105"
                           style={{ 
                             border: `1.5px solid ${selectedOption === i ? t.purple : t.border}`,
                             backgroundColor: selectedOption === i ? t.purple : t.surfaceAlt,
                             color: selectedOption === i ? "#fff" : t.textFaint,
                             fontFamily: FONT_MONO,
                             fontWeight: 600,
                             boxShadow: selectedOption === i ? `0 0 10px ${t.purple}44` : "none"
                           }}
                         >
                           {String.fromCharCode(65 + i)}
                         </button>
                       ))}
                     </div>
                   </div>
                 );
               })}
            </div>
            
            <div className="p-4 border-t flex flex-col gap-2" style={{ borderColor: t.border, backgroundColor: t.surfaceAlt }}>
              <div className="flex justify-between text-xs mb-1" style={{ color: t.textFaint, fontFamily: FONT_MONO }}>
                <span>Answered: {Object.values(record).filter(r => r && r.selected !== null).length}/{totalSteps}</span>
              </div>
              <Btn t={t} full onClick={() => finishNow()} disabled={finishing}>
                Submit Exam
              </Btn>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="flex items-center justify-between">
        <button onClick={() => { clearSession(); navigate("/subjects"); }} className="flex items-center gap-1 text-sm font-bold" style={{ color: t.textMuted }}>
          <ChevronLeft size={15} /> Exit
        </button>
        <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: t.textFaint }}>
          {pos + 1} / {totalSteps}
        </span>
        <div className="flex items-center gap-3">
          {mm && (
            <div className="flex items-center gap-1.5 rounded-xl px-2 py-1" style={{ backgroundColor: t.surfaceAlt }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: secondsLeft! < 30 ? t.red : t.textMuted }}>
                <Clock size={12} className="mr-1 inline" />
                {mm}:{ss}
              </span>
              {config.mode !== "exam" && (
                <div className="flex items-center gap-1 ml-1 border-l pl-1.5" style={{ borderColor: t.border }}>
                  <button
                    onClick={() => addTimeSeconds(60)}
                    className="rounded px-1 text-[10px] font-bold hover:opacity-80"
                    style={{ backgroundColor: `${t.teal}20`, color: t.teal }}
                    title="Add 1 minute"
                  >
                    +1m
                  </button>
                  <button
                    onClick={() => addTimeSeconds(300)}
                    className="rounded px-1 text-[10px] font-bold hover:opacity-80"
                    style={{ backgroundColor: `${t.purple}20`, color: t.purple }}
                    title="Add 5 minutes"
                  >
                    +5m
                  </button>
                </div>
              )}
            </div>
          )}
          {!mm && ExitAndFinishBar}
          <button onClick={toggleBookmark} disabled={!uid} title={uid ? "Bookmark" : "Log in to bookmark"}>
            {bookmarked[qIndex] ? <BookmarkCheck size={18} color={t.gold} /> : <Bookmark size={18} color={t.textFaint} />}
          </button>
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: t.surfaceAlt }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${(pos / totalSteps) * 100}%`, backgroundColor: t.teal }} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Pill t={t} tone="muted">{SUBJECT_META[setRef.subjectId as keyof typeof SUBJECT_META]?.label || "Quiz"}</Pill>
        <Pill t={t} tone="purple">{setRef.moduleName} \u00b7 Block {setRef.block}</Pill>
        {requeueCount[qIndex] > 0 && <Pill t={t} tone="gold">Review</Pill>}
      </div>

      <Card t={t} style={{ padding: 24 }}>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, lineHeight: 1.4, marginBottom: 20 }}>{question.q}</h2>
        <div className="flex flex-col gap-3">
          {question.options.map((opt, i) => {
            const isSelected = selected === i;
            const isCorrect = i === question.correct;
            let borderColor = t.border;
            let bg = "transparent";
            if (answered) {
              if (isCorrect) {
                borderColor = t.green;
                bg = `${t.green}18`;
              } else if (isSelected) {
                borderColor = t.red;
                bg = `${t.red}18`;
              }
            } else if (isSelected) {
              borderColor = t.purple;
              bg = `${t.purple}18`;
            }
            return (
              <button
                key={i}
                onClick={() => selectOption(i)}
                disabled={answered}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm"
                style={{ border: `1.5px solid ${borderColor}`, backgroundColor: bg, color: t.text }}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    border: `1.5px solid ${answered && isCorrect ? t.green : isSelected ? t.purple : t.textFaint}`,
                    backgroundColor: answered && isCorrect ? t.green : isSelected && !answered ? t.purple : "transparent",
                    color: (answered && isCorrect) || (isSelected && !answered) ? "#fff" : t.textFaint,
                    fontFamily: FONT_MONO,
                  }}
                >
                  {answered ? (isCorrect ? <Check size={13} /> : isSelected ? <X size={13} /> : String.fromCharCode(65 + i)) : String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            );
          })}
        </div>

        {answered && (
          <div className="mt-5 rounded-2xl p-4" style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}` }}>
            <div className="mb-1.5 flex items-center gap-2">
              {selected === question.correct ? <CheckCircle2 size={15} color={t.green} /> : <XCircle size={15} color={t.red} />}
              <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 13 }}>{selected === question.correct ? "Correct" : "Not quite"}</span>
            </div>
            <p style={{ color: t.textMuted, fontSize: 13.5, lineHeight: 1.6, marginBottom: 10 }}>{question.explanation}</p>
            <button onClick={aiExplain} className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: t.teal }}>
              <ClipboardCopy size={13} /> {copied ? "Copied \u2014 opening chatbot\u2026" : "AI Explain"}
            </button>
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        {!answered ? (
          <Btn t={t} onClick={submitAnswer} disabled={selected === null}>
            Submit answer
          </Btn>
        ) : (
          <Btn t={t} onClick={advance} icon={ArrowRight}>
            {pos + 1 >= totalSteps ? "See results" : "Next question"}
          </Btn>
        )}
      </div>
      <p className="hidden text-center text-xs md:block" style={{ color: t.textFaint }}>
        Keyboard: 1\u20134 to select \u00b7 Enter to submit / continue
      </p>
    </div>
  );
}
