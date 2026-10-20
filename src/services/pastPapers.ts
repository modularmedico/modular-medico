import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import type { FirestorePastPaper, QuestionStatus } from "../types";
import { extractDriveFileId } from "./ospeBooks";
import { cacheFirstSnapshot } from "../utils/localCache";

/**
 * Past Papers service — mirrors the `ospeBooks` service, including the same
 * Firestore-with-localStorage-fallback pattern, so a paper link saved while
 * the signed-in account lacks the real Firestore admin claim (or while
 * offline) still shows up in this browser instead of silently vanishing.
 *
 * Unlike OSPE Material (Subject-only), each Past Paper is scoped to a
 * Block + Subject pair (no Module/Topic) — e.g. "Block 3 / Gross Anatomy /
 * Final Term 2024".
 */

const LOCAL_PAST_PAPERS_KEY = "modular_medico_local_past_papers";
const LOCAL_DELETED_PAST_PAPERS_KEY = "modular_medico_deleted_past_papers";

function getLocalPastPapers(): FirestorePastPaper[] {
  try {
    const deleted = getDeletedPastPaperIds();
    const list: FirestorePastPaper[] = JSON.parse(localStorage.getItem(LOCAL_PAST_PAPERS_KEY) || "[]");
    return list.filter((p) => !deleted.has(p.id.toLowerCase().trim()));
  } catch {
    return [];
  }
}

function getDeletedPastPaperIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_DELETED_PAST_PAPERS_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    // ignore
  }
  return new Set();
}

// Only ever written when the real Firestore delete fails — see the equivalent comment
// on deleteQuestion() in adminContent.ts for why this must never run unconditionally or
// match by title/text (only by id).
function markPastPaperDeleted(id: string) {
  try {
    const current = getDeletedPastPaperIds();
    current.add(id.toLowerCase().trim());
    localStorage.setItem(LOCAL_DELETED_PAST_PAPERS_KEY, JSON.stringify(Array.from(current)));
  } catch {
    // ignore
  }
}

/** Re-exported so pages only need to import from one place. */
export { extractDriveFileId };

export function toDrivePreviewUrl(url: string): string | null {
  const id = extractDriveFileId(url);
  return id ? `https://drive.google.com/file/d/${id}/preview` : null;
}

export interface PastPaperInput {
  title: string;
  driveUrl: string;
  description?: string;
  block: number;
  subjectId: string;
  status?: QuestionStatus;
}

export type SavePastPaperResult =
  | { source: "firestore" }
  | { source: "local"; reason: "permission-denied" | "offline" | "unknown"; message: string };

function classifyWriteError(err: unknown): "permission-denied" | "offline" | "unknown" {
  const code = (err as { code?: string } | null)?.code;
  if (code === "permission-denied") return "permission-denied";
  if (code === "unavailable" || (typeof navigator !== "undefined" && !navigator.onLine)) return "offline";
  return "unknown";
}

export async function addPastPaper(input: PastPaperInput): Promise<SavePastPaperResult> {
  const cleanInput = {
    ...input,
    status: input.status ?? "draft",
    createdAt: Date.now(),
  };
  try {
    await addDoc(collection(db, "past_papers"), cleanInput);
    return { source: "firestore" };
  } catch (err) {
    console.warn("Firestore addPastPaper failed, appending to local store:", err);
    const localPapers: FirestorePastPaper[] = JSON.parse(localStorage.getItem(LOCAL_PAST_PAPERS_KEY) || "[]");
    localPapers.push({ id: `local-${Date.now()}-${Math.random()}`, ...cleanInput });
    localStorage.setItem(LOCAL_PAST_PAPERS_KEY, JSON.stringify(localPapers));
    const reason = classifyWriteError(err);
    return {
      source: "local",
      reason,
      message:
        reason === "permission-denied"
          ? "Your account isn't a real Firestore admin yet, so this only saved to this browser. Run scripts/setAdminClaim.mjs to fix this."
          : reason === "offline"
          ? "You appear to be offline — this was cached locally and needs a real save once you're back online."
          : "Firestore rejected this write for an unknown reason — this only saved to this browser.",
    };
  }
}

export async function updatePastPaperStatus(id: string, status: QuestionStatus) {
  try {
    await updateDoc(doc(db, "past_papers", id), { status });
  } catch (err) {
    console.warn("Firestore updatePastPaperStatus failed:", err);
    const localPapers: FirestorePastPaper[] = JSON.parse(localStorage.getItem(LOCAL_PAST_PAPERS_KEY) || "[]");
    const found = localPapers.find((p) => p.id === id);
    if (found) {
      found.status = status;
      localStorage.setItem(LOCAL_PAST_PAPERS_KEY, JSON.stringify(localPapers));
    }
  }
}

export async function deletePastPaper(id: string) {
  const localPapers: FirestorePastPaper[] = JSON.parse(localStorage.getItem(LOCAL_PAST_PAPERS_KEY) || "[]");
  localStorage.setItem(LOCAL_PAST_PAPERS_KEY, JSON.stringify(localPapers.filter((p) => p.id !== id)));

  try {
    await deleteDoc(doc(db, "past_papers", id));
  } catch (err) {
    console.warn("Firestore deletePastPaper failed, hiding locally instead:", err);
    if (id) markPastPaperDeleted(id);
  }
}

/** Live view of every Past Paper in the bank (all statuses) — admin only. */
export function subscribeAllPastPapers(
  cb: (papers: FirestorePastPaper[]) => void,
  onError?: (reason: "permission-denied" | "offline" | "unknown", message: string) => void
) {
  return onSnapshot(
    collection(db, "past_papers"),
    (snap) => {
      const deleted = getDeletedPastPaperIds();
      const fsPapers = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<FirestorePastPaper, "id">) }))
        .filter((fp) => !deleted.has(fp.id.toLowerCase().trim()));
      const localPapers = getLocalPastPapers();
      const byId = new Map<string, FirestorePastPaper>();
      localPapers.forEach((p) => byId.set(p.id, p));
      fsPapers.forEach((p) => byId.set(p.id, p));
      cb(Array.from(byId.values()));
    },
    (err) => {
      console.warn("Firestore all Past Papers fallback:", err.message);
      const reason = classifyWriteError(err);
      onError?.(
        reason,
        reason === "permission-denied"
          ? "Your account isn't a real Firestore admin yet, so the Past Papers list can't be loaded — only locally cached papers are shown."
          : "Couldn't load Past Papers from Firestore — only locally cached papers are shown."
      );
      cb(getLocalPastPapers());
    }
  );
}

/** Live view of every *published* Past Paper — safe for students/guests. */
export function subscribePublishedPastPapers(cb: (papers: FirestorePastPaper[]) => void) {
  return cacheFirstSnapshot(
    "publishedPastPapers",
    (innerCb) => {
      const q = query(collection(db, "past_papers"), where("status", "==", "published"));
      return onSnapshot(
        q,
        (snap) => {
          const deleted = getDeletedPastPaperIds();
          const fsPapers = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<FirestorePastPaper, "id">) }))
            .filter((fp) => !deleted.has(fp.id.toLowerCase().trim()));
          const localPapers = getLocalPastPapers().filter((p) => p.status === "published");
          const byId = new Map<string, FirestorePastPaper>();
          localPapers.forEach((p) => byId.set(p.id, p));
          fsPapers.forEach((p) => byId.set(p.id, p));
          innerCb(Array.from(byId.values()));
        },
        (err) => {
          console.warn("Firestore published Past Papers fallback:", err.message);
          innerCb(getLocalPastPapers().filter((p) => p.status === "published"));
        }
      );
    },
    cb
  );
}
