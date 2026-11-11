import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import { removeBookmark, saveMcq, subscribeBookmarks } from "../services/firestore";
import { mcqKey } from "../utils/mcqKey";
import type { BookmarkRecord, MCQ } from "../types";

/** Anything shaped like an MCQ; explanation may be missing (e.g. typed-in past paper MCQs). */
export type SavableMcq = Omit<MCQ, "explanation"> & { explanation?: string };

export interface SaveContext {
  subjectId: string;
  moduleName: string;
  block: number;
}

/**
 * Saved-MCQ state for the signed-in student: which MCQs are saved, and a toggle that saves /
 * un-saves one. Works from practice, past papers and tests alike; the "Saved" page lists them.
 * `needsLogin` is set when a guest taps Save, so the caller can show a sign-in nudge.
 */
export function useSavedMcqs() {
  const uid = useAppStore((s) => s.uid);
  const [records, setRecords] = useState<BookmarkRecord[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!uid) {
      setRecords([]);
      return;
    }
    return subscribeBookmarks(uid, setRecords);
  }, [uid]);

  // key -> bookmark doc id. Older bookmarks have random doc ids, so match on content, not on id.
  const byKey = useMemo(() => {
    const map = new Map<string, string>();
    records.forEach((r) => map.set(mcqKey(r.question), r.id));
    return map;
  }, [records]);

  const isSaved = useCallback((q: SavableMcq) => byKey.has(mcqKey(q)), [byKey]);

  const toggle = useCallback(
    async (q: SavableMcq, ctx: SaveContext) => {
      if (!uid) {
        setNeedsLogin(true);
        return;
      }
      const key = mcqKey(q);
      if (busyKey === key) return;
      setBusyKey(key);
      setError(null);
      try {
        const existing = byKey.get(key);
        if (existing) await removeBookmark(uid, existing);
        else await saveMcq(uid, key, ctx.subjectId, ctx.moduleName, ctx.block, q);
      } catch (e) {
        console.warn("Save MCQ failed:", e);
        setError("Couldn't save this MCQ. Check your connection and try again.");
      } finally {
        setBusyKey(null);
      }
    },
    [uid, busyKey, byKey]
  );

  const goLogin = useCallback(() => navigate("/login"), [navigate]);

  return {
    isSaved,
    toggle,
    busyKey,
    needsLogin,
    dismissLogin: () => setNeedsLogin(false),
    goLogin,
    error,
    dismissError: () => setError(null),
    count: records.length,
  };
}
