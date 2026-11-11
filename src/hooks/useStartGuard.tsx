import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import ResumeModal from "../components/ResumeModal";
import { THEME } from "../theme";
import { isSessionResumable, useAppStore } from "../store/useAppStore";

/**
 * Wrap any "start a new MCQ session" action with guard(start, label). If the student has an
 * unfinished session (kept in localStorage by the persisted store) it first asks whether to
 * continue that one or start over; otherwise it just runs `start`.
 *
 * Test Series sessions are never resumable (they are timed, leaderboard-tracked attempts), so
 * they never trigger this prompt.
 */
export function useStartGuard() {
  const navigate = useNavigate();
  const isDark = useAppStore((s) => s.isDark);
  const clearSession = useAppStore((s) => s.clearSession);
  const t = isDark ? THEME.dark : THEME.light;
  const [pending, setPending] = useState<{ start: () => void; label?: string } | null>(null);

  const guard = (start: () => void, label?: string) => {
    const session = useAppStore.getState().session;
    if (isSessionResumable(session)) setPending({ start, label });
    else start();
  };

  const session = useAppStore((s) => s.session);
  const modal: ReactNode =
    pending && isSessionResumable(session) ? (
      <ResumeModal
        t={t}
        title={session.setRef.setTitle}
        progress={`Question ${Math.min(session.pos + 1, session.queue.length)} of ${session.queue.length}`}
        newLabel={pending.label}
        onClose={() => setPending(null)}
        onContinue={() => {
          setPending(null);
          navigate("/practice");
        }}
        onStartOver={() => {
          const run = pending.start;
          setPending(null);
          clearSession();
          run();
        }}
      />
    ) : null;

  return { guard, modal };
}
