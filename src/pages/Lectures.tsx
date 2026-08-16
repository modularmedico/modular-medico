import { useEffect, useMemo, useState } from "react";
import { PlayCircle, FolderTree, X, ExternalLink } from "lucide-react";
import Card from "../components/Card";
import Pill from "../components/Pill";
import Spinner from "../components/Spinner";
import { THEME, FONT_DISPLAY } from "../theme";
import { useAppStore } from "../store/useAppStore";
import { SUBJECT_META, DEFAULT_BLOCK_DEFINITIONS, TOTAL_BLOCKS, type SubjectId } from "../data/subjects";
import { subscribePublishedLectures, toYouTubeEmbedUrl } from "../services/lectures";
import type { FirestoreLecture } from "../types";

/**
 * Student-facing Lectures library. Mirrors the same content hierarchy as Practice
 * (Block -> Module -> Subject -> Subheading) so lectures live under the exact same
 * scaffold students already use to find MCQs.
 */
export default function Lectures() {
  const isDark = useAppStore((s) => s.isDark);
  const t = isDark ? THEME.dark : THEME.light;

  const [lectures, setLectures] = useState<FirestoreLecture[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<number>(1);
  const [activeLecture, setActiveLecture] = useState<FirestoreLecture | null>(null);

  useEffect(() => {
    const unsub = subscribePublishedLectures((ls) => {
      setLectures(ls);
      setLoaded(true);
    });
    return () => unsub();
  }, []);

  const blockLectures = useMemo(
    () => lectures.filter((l) => l.block === selectedBlock),
    [lectures, selectedBlock]
  );

  // Group: Module -> Subject -> Subheading (matching the exact same 4-tier hierarchy
  // used for MCQs, per (block, moduleId, subjectId, subheading)).
  const grouped = useMemo(() => {
    const moduleMap = new Map<
      string,
      { moduleName: string; subjects: Map<string, { subjectId: string; subheadings: Map<string, FirestoreLecture[]> }> }
    >();

    blockLectures.forEach((l) => {
      if (!moduleMap.has(l.moduleId)) {
        moduleMap.set(l.moduleId, { moduleName: l.moduleName || "General Module", subjects: new Map() });
      }
      const mod = moduleMap.get(l.moduleId)!;
      if (!mod.subjects.has(l.subjectId)) {
        mod.subjects.set(l.subjectId, { subjectId: l.subjectId, subheadings: new Map() });
      }
      const subj = mod.subjects.get(l.subjectId)!;
      const shKey = l.subheadingName || "General";
      if (!subj.subheadings.has(shKey)) subj.subheadings.set(shKey, []);
      subj.subheadings.get(shKey)!.push(l);
    });

    return Array.from(moduleMap.entries()).map(([moduleId, mod]) => ({
      moduleId,
      moduleName: mod.moduleName,
      subjects: Array.from(mod.subjects.values()).map((s) => ({
        subjectId: s.subjectId,
        subheadings: Array.from(s.subheadings.entries()).map(([name, ls]) => ({ name, lectures: ls })),
      })),
    }));
  }, [blockLectures]);

  const embedUrl = activeLecture ? toYouTubeEmbedUrl(activeLecture.youtubeUrl) : null;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em" }}>
          Lectures
        </h1>
        <p style={{ color: t.textMuted, fontSize: 13.5, marginTop: 2 }}>
          Video lectures organized by Block, Module, Subject and Subheading.
        </p>
      </div>

      {/* Block Selector */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-15">
        {Array.from({ length: TOTAL_BLOCKS }, (_, i) => i + 1).map((b) => {
          const isSelected = selectedBlock === b;
          const blockDef = DEFAULT_BLOCK_DEFINITIONS.find((d) => d.block === b);
          return (
            <button
              key={b}
              onClick={() => setSelectedBlock(b)}
              className="flex flex-col items-center justify-center rounded-2xl p-2.5 text-center transition-all hover:scale-[1.02]"
              style={{
                backgroundColor: isSelected ? t.purpleStrong : t.surfaceAlt,
                color: isSelected ? "#fff" : t.text,
                border: `1.5px solid ${isSelected ? t.purpleStrong : t.border}`,
              }}
            >
              <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>B{b}</span>
              <span
                className="truncate max-w-[65px] text-[10px] font-semibold mt-0.5"
                style={{ color: isSelected ? "#ffffffdd" : t.teal }}
              >
                {blockDef?.title.split(" ")[0] || ""}
              </span>
            </button>
          );
        })}
      </div>

      {!loaded && (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-2xl p-10 text-center"
          style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}` }}
        >
          <Spinner t={t} size={22} label="Loading lectures\u2026" />
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
            No lectures have been added to Block {selectedBlock} yet.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {grouped.map((mod) => (
          <Card key={mod.moduleId} t={t} style={{ backgroundColor: t.surfaceAlt }}>
            <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, marginBottom: 12 }}>
              {mod.moduleName}
            </h3>
            <div className="flex flex-col gap-4">
              {mod.subjects.map((subj) => {
                const meta = SUBJECT_META[subj.subjectId as SubjectId] || { label: subj.subjectId, tag: "" };
                return (
                  <div key={subj.subjectId}>
                    <Pill t={t} tone="gold">{meta.label}</Pill>
                    <div className="mt-3 flex flex-col gap-3">
                      {subj.subheadings.map((sh) => (
                        <div key={sh.name}>
                          {sh.name !== "General" && (
                            <span className="mb-1.5 block text-xs font-bold" style={{ color: t.textFaint }}>
                              {sh.name}
                            </span>
                          )}
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {sh.lectures.map((l) => (
                              <button
                                key={l.id}
                                onClick={() => setActiveLecture(l)}
                                className="flex items-center gap-3 rounded-xl p-3 text-left transition-all hover:scale-[1.01]"
                                style={{ backgroundColor: t.surface, border: `1px solid ${t.border}` }}
                              >
                                <div
                                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                                  style={{ backgroundColor: `${t.purple}22` }}
                                >
                                  <PlayCircle size={18} color={t.purple} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-bold">{l.title}</div>
                                  {l.description && (
                                    <div className="truncate text-[11px]" style={{ color: t.textFaint }}>
                                      {l.description}
                                    </div>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      {/* Video Modal */}
      {activeLecture && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setActiveLecture(null)}
        >
          <div className="absolute inset-0" style={{ backgroundColor: "rgba(10,6,20,0.75)", backdropFilter: "blur(4px)" }} />
          <div
            className="relative w-full max-w-3xl rounded-2xl p-4"
            style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>{activeLecture.title}</h3>
                {activeLecture.description && (
                  <p className="mt-1 text-xs" style={{ color: t.textMuted }}>{activeLecture.description}</p>
                )}
              </div>
              <button
                onClick={() => setActiveLecture(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: t.surfaceAlt }}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            {embedUrl ? (
              <div className="overflow-hidden rounded-xl" style={{ aspectRatio: "16 / 9" }}>
                <iframe
                  src={embedUrl}
                  title={activeLecture.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <a
                href={activeLecture.youtubeUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-sm font-bold"
                style={{ color: t.teal }}
              >
                Watch on YouTube <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
