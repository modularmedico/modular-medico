import { useNavigate } from "react-router-dom";
import { FileStack, PlayCircle, BookOpen, X } from "lucide-react";
import { FONT_DISPLAY, THEME } from "../theme";
import { isSessionResumable, useAppStore } from "../store/useAppStore";
import { clearPaperProgress, paperResumeUrl, useLatestPaperProgress } from "../utils/resume";

/**
 * "Continue from last time" card(s) shown on top of the homepage, the MCQ bank and Past Papers.
 * Renders nothing when there is nothing to resume, so it can be dropped in anywhere.
 *   kinds: which kind(s) of unfinished work this page cares about.
 */
export default function ContinueBanner({ kinds }: { kinds: ("mcq" | "paper")[] }) {
  const navigate = useNavigate();
  const isDark = useAppStore((s) => s.isDark);
  const session = useAppStore((s) => s.session);
  const clearSession = useAppStore((s) => s.clearSession);
  const paper = useLatestPaperProgress();
  const t = isDark ? THEME.dark : THEME.light;

  const showMcq = kinds.includes("mcq") && isSessionResumable(session);
  const showPaper = kinds.includes("paper") && !!paper;
  if (!showMcq && !showPaper) return null;

  const isMock = showMcq && session!.setRef.moduleId.startsWith("mock-");

  const Row = ({
    icon: Icon,
    color,
    label,
    title,
    progress,
    pct,
    onContinue,
    onDiscard,
  }: {
    icon: typeof BookOpen;
    color: string;
    label: string;
    title: string;
    progress: string;
    pct: number;
    onContinue: () => void;
    onDiscard: () => void;
  }) => (
    <div
      className="flex items-center gap-3 rounded-2xl p-3 sm:p-4"
      style={{ backgroundColor: t.surface, border: `1.5px solid ${color}`, boxShadow: `0 8px 24px -14px ${color}` }}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}22` }}>
        <Icon size={20} color={color} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
          {label}
        </div>
        <div className="truncate text-sm font-bold" style={{ fontFamily: FONT_DISPLAY }}>
          {title}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: t.border }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
          </div>
          <span className="shrink-0 text-[11px] font-semibold" style={{ color: t.textMuted }}>
            {progress}
          </span>
        </div>
      </div>
      <button
        onClick={onContinue}
        className="flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-extrabold"
        style={{ backgroundColor: t.gold, color: "#241A08" }}
      >
        <PlayCircle size={15} /> Continue
      </button>
      <button onClick={onDiscard} aria-label="Discard progress" title="Discard this progress" style={{ color: t.textFaint }}>
        <X size={16} />
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-2.5">
      {showMcq && session && (
        <Row
          icon={BookOpen}
          color={t.teal}
          label={isMock ? "Continue your mock test" : "Continue from last time"}
          title={session.setRef.setTitle}
          progress={`Q ${Math.min(session.pos + 1, session.queue.length)} / ${session.queue.length}`}
          pct={Math.round((session.pos / Math.max(1, session.queue.length)) * 100)}
          onContinue={() => navigate("/practice")}
          onDiscard={() => {
            if (window.confirm("Discard your unfinished practice? Your progress in it will be lost.")) clearSession();
          }}
        />
      )}
      {showPaper && paper && (
        <Row
          icon={FileStack}
          color={t.gold}
          label="Continue past paper"
          title={paper.title}
          progress={`Q ${Math.min(paper.index + 1, paper.total)} / ${paper.total}`}
          pct={Math.round((paper.index / Math.max(1, paper.total)) * 100)}
          onContinue={() => navigate(paperResumeUrl(paper))}
          onDiscard={() => {
            if (window.confirm("Discard your unfinished past paper progress?")) clearPaperProgress(paper.paperId);
          }}
        />
      )}
    </div>
  );
}
