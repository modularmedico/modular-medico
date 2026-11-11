import { useEffect, useState } from "react";
import type { PaperProgress } from "../types";

/**
 * "Continue from where you left off" for Past Papers, kept entirely in localStorage.
 * (MCQ-bank practice already lives in the persisted zustand store — see isSessionResumable.)
 *
 * One entry per paper, so each paper remembers its own place; the most recently touched
 * unfinished one is what the "Continue" banners point to.
 */

const KEY = "mm-paper-progress-v1";
const EVENT = "mm-paper-progress-changed";

function readAll(): Record<string, PaperProgress> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PaperProgress>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, PaperProgress>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* storage full / blocked — resuming just won't be available */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function getPaperProgress(paperId: string): PaperProgress | null {
  return readAll()[paperId] ?? null;
}

export function savePaperProgress(p: PaperProgress) {
  const all = readAll();
  all[p.paperId] = p;
  writeAll(all);
}

export function clearPaperProgress(paperId: string) {
  const all = readAll();
  if (!(paperId in all)) return;
  delete all[paperId];
  writeAll(all);
}

/** True when there is something worth resuming: the student moved on or answered at least one MCQ. */
export const paperHasProgress = (p: PaperProgress | null | undefined): p is PaperProgress =>
  !!p && p.total > 0 && (p.index > 0 || Object.keys(p.answers).length > 0 || Object.keys(p.revealed ?? {}).length > 0);

export function latestPaperProgress(): PaperProgress | null {
  const list = Object.values(readAll()).filter(paperHasProgress);
  if (list.length === 0) return null;
  return list.sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

/** Live view of the most recent unfinished paper (updates when it changes in this or another tab). */
export function useLatestPaperProgress(): PaperProgress | null {
  const [latest, setLatest] = useState<PaperProgress | null>(() => latestPaperProgress());
  useEffect(() => {
    const refresh = () => setLatest(latestPaperProgress());
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    refresh();
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return latest;
}

export const paperResumeUrl = (p: PaperProgress) =>
  `/past-papers/${p.block}?topic=${encodeURIComponent(p.topic)}&resume=${encodeURIComponent(p.paperId)}`;
