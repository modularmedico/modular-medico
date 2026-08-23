import { useEffect, useMemo, useState } from "react";
import { NotebookText, FolderTree, X, ExternalLink } from "lucide-react";
import Card from "../components/Card";
import Pill from "../components/Pill";
import Spinner from "../components/Spinner";
import SubjectIcon from "../components/SubjectIcon";
import { THEME, FONT_DISPLAY } from "../theme";
import { useAppStore } from "../store/useAppStore";
import { SUBJECT_META, type SubjectId } from "../data/subjects";
import { subscribePublishedStudyNotes, toDrivePreviewUrl } from "../services/studyNotes";
import type { FirestoreStudyNote } from "../types";

/**
 * Student-facing Books & Study Notes library — a shelf of Google-Drive-hosted
 * notes/books, organized by Subject and tagged with their Block + Module so
 * students can tell at a glance which part of the syllabus each note covers.
 */
export default function StudyNotes() {
  const isDark = useAppStore((s) => s.isDark);
  const t = isDark ? THEME.dark : THEME.light;

  const [notes, setNotes] = useState<FirestoreStudyNote[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeNote, setActiveNote] = useState<FirestoreStudyNote | null>(null);

  useEffect(() => {
    const unsub = subscribePublishedStudyNotes((ns) => {
      setNotes(ns);
      setLoaded(true);
    });
    return () => unsub();
  }, []);

  const grouped = useMemo(() => {
    const bySubject = new Map<string, FirestoreStudyNote[]>();
    notes.forEach((n) => {
      if (!bySubject.has(n.subjectId)) bySubject.set(n.subjectId, []);
      bySubject.get(n.subjectId)!.push(n);
    });
    return Array.from(bySubject.entries()).map(([subjectId, list]) => ({ subjectId, notes: list }));
  }, [notes]);

  const previewUrl = activeNote ? toDrivePreviewUrl(activeNote.driveUrl) : null;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em" }}>
          Books &amp; Study Notes
        </h1>
        <p style={{ color: t.textMuted, fontSize: 13.5, marginTop: 2 }}>
          Curated books and study notes, organized by Block, Module &amp; Subject. Opens straight from Google Drive.
        </p>
      </div>

      {!loaded && (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-2xl p-10 text-center"
          style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}` }}
        >
          <Spinner t={t} size={22} label="Loading Books & Study Notes\u2026" />
        </div>
      )}

      {loaded && grouped.length === 0 && (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-2xl p-10 text-center"
          style={{ backgroundColor: t.surfaceAlt, border: `1.5px dashed ${t.border}` }}
        >
          <FolderTree size={22} color={t.textFaint} />
          <h4 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>Coming Soon</h4>
          <p className="max-w-sm text-xs" style={{ color: t.textMuted }}>
            No Books or Study Notes have been added yet. Check back soon.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {grouped.map((group) => {
          const meta = SUBJECT_META[group.subjectId as SubjectId] || { label: group.subjectId, tag: "" };
          return (
            <Card key={group.subjectId} t={t} style={{ backgroundColor: t.surfaceAlt }}>
              <div className="mb-3 flex items-center gap-2.5">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${t.teal}22` }}
                >
                  <SubjectIcon id={group.subjectId as SubjectId} color={t.teal} size={17} />
                </div>
                <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>{meta.label}</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.notes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => setActiveNote(n)}
                    className="flex items-center gap-3 rounded-xl p-3 text-left transition-all hover:scale-[1.01]"
                    style={{ backgroundColor: t.surface, border: `1px solid ${t.border}` }}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${t.gold}22` }}
                    >
                      <NotebookText size={18} color={t.gold} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1">
                        <Pill t={t} tone="teal">Block {n.block}</Pill>
                        <Pill t={t} tone="purple">{n.moduleName}</Pill>
                      </div>
                      <div className="truncate text-sm font-bold">{n.title}</div>
                      {n.description && (
                        <div className="truncate text-[11px]" style={{ color: t.textFaint }}>
                          {n.description}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {/* PDF Preview Modal — full screen so the note is actually readable */}
      {activeNote && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: t.surface }}>
          <div
            className="flex items-start justify-between gap-3 p-4"
            style={{ borderBottom: `1.5px solid ${t.border}` }}
          >
            <div className="min-w-0">
              <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }} className="truncate">
                {activeNote.title}
              </h3>
              {activeNote.description && (
                <p className="mt-1 truncate text-xs" style={{ color: t.textMuted }}>{activeNote.description}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={activeNote.driveUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold"
                style={{ backgroundColor: t.surfaceAlt, color: t.teal }}
              >
                Open in Drive <ExternalLink size={12} />
              </a>
              <button
                onClick={() => setActiveNote(null)}
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
              <iframe src={previewUrl} title={activeNote.title} className="h-full w-full" allow="autoplay" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center">
                <NotebookText size={22} color={t.textFaint} />
                <p className="text-xs" style={{ color: t.textMuted }}>Preview isn't available for this link.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
