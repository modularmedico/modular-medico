import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark, BookmarkX, CheckCircle2, ChevronDown, User } from "lucide-react";
import Card from "../components/Card";
import Btn from "../components/Btn";
import AiExplain from "../components/AiExplain";
import { THEME, FONT_DISPLAY, FONT_MONO } from "../theme";
import { useAppStore } from "../store/useAppStore";
import { subscribeBookmarks, removeBookmark } from "../services/firestore";
import { SUBJECT_META } from "../data/subjects";
import type { BookmarkRecord } from "../types";

const sourceLabel = (b: BookmarkRecord) => {
  if (b.subjectId === "past-paper") return `Past Paper · ${b.moduleName} · Block ${b.block}`;
  const subject = SUBJECT_META[b.subjectId as keyof typeof SUBJECT_META]?.label || b.subjectId;
  return b.block > 0 ? `${subject} · ${b.moduleName} · Block ${b.block}` : `${subject} · ${b.moduleName}`;
};

export default function Bookmarks() {
  const navigate = useNavigate();
  const isDark = useAppStore((s) => s.isDark);
  const uid = useAppStore((s) => s.uid);
  const t = isDark ? THEME.dark : THEME.light;
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    return subscribeBookmarks(uid, setBookmarks);
  }, [uid]);

  if (!uid) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-16 text-center">
        <User size={30} color={t.purple} />
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 21 }}>Sign in to save MCQs</h1>
        <p style={{ color: t.textMuted, fontSize: 14 }}>Saved MCQs sync to your account so they're there on any device.</p>
        <Btn t={t} onClick={() => navigate("/login")}>
          Log in
        </Btn>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26, marginBottom: 4 }}>Saved MCQs</h1>
      <p style={{ color: t.textMuted, fontSize: 14, marginBottom: 18 }}>
        Every MCQ you saved with the Save MCQ button — from practice and past papers. Tap one to see its answer.
      </p>

      {bookmarks.length === 0 ? (
        <Card t={t} className="text-center">
          <Bookmark size={22} color={t.textFaint} className="mx-auto mb-2" />
          <p className="text-sm" style={{ color: t.textMuted }}>
            Nothing saved yet. Tap <b>Save MCQ</b> on any question during practice or in a past paper to keep it here.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {bookmarks.map((b) => {
            const open = openId === b.id;
            return (
              <Card key={b.id} t={t} className="flex flex-col gap-3">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setOpenId(open ? null : b.id)}
                    className="flex min-w-0 flex-1 items-center gap-4 text-left"
                    aria-expanded={open}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${t.purple}22` }}>
                      <Bookmark size={16} color={t.purple} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold ${open ? "" : "truncate"}`}>{b.question.q}</p>
                      <span style={{ fontSize: 12, color: t.textFaint }}>{sourceLabel(b)}</span>
                    </div>
                    <ChevronDown size={16} color={t.textFaint} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 120ms" }} />
                  </button>
                  <button onClick={() => removeBookmark(uid, b.id)} title="Remove from saved" aria-label="Remove from saved">
                    <BookmarkX size={17} color={t.textFaint} />
                  </button>
                </div>

                {open && (
                  <div className="flex flex-col gap-1.5 rounded-2xl p-3" style={{ backgroundColor: t.surfaceAlt }}>
                    {b.question.options.map((opt, oi) => {
                      const isCorrect = oi === b.question.correct;
                      return (
                        <div
                          key={oi}
                          className="flex items-start gap-2 text-xs"
                          style={{ color: isCorrect ? t.green : t.textMuted, fontWeight: isCorrect ? 700 : 500 }}
                        >
                          <span style={{ fontFamily: FONT_MONO }}>{String.fromCharCode(65 + oi)}.</span>
                          <span className="flex-1">{opt}</span>
                          {isCorrect && <CheckCircle2 size={13} className="mt-0.5 shrink-0" />}
                        </div>
                      );
                    })}
                    {b.question.explanation && (
                      <p className="mt-1 text-xs" style={{ color: t.textMuted, lineHeight: 1.6 }}>
                        {b.question.explanation}
                      </p>
                    )}
                    <div className="mt-1">
                      <AiExplain
                        question={b.question.q}
                        options={b.question.options}
                        correct={b.question.correct}
                        selected={null}
                        explanation={b.question.explanation}
                      />
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
