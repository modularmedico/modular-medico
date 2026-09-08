import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import type { FirestoreStudyNote, QuestionStatus } from "../types";
import { extractDriveFileId } from "./ospeBooks";
import { cacheFirstSnapshot } from "../utils/localCache";

/**
 * Books & Study Notes service — mirrors the `ospeBooks` service, including the
 * same Firestore-with-localStorage-fallback pattern, so a note link saved
 * while the signed-in account lacks the real Firestore admin claim (or while
 * offline) still shows up in this browser instead of silently vanishing.
 *
 * Unlike OSPE Material (Subject-only), Study Notes follow the full
 * Block -> Module -> Subject hierarchy, same as MCQs and Lectures.
 */

const LOCAL_STUDY_NOTES_KEY = "modular_medico_local_study_notes";
const LOCAL_DELETED_STUDY_NOTES_KEY = "modular_medico_deleted_study_notes";

function getLocalStudyNotes(): FirestoreStudyNote[] {
  try {
    const deleted = getDeletedStudyNoteIds();
    const list: FirestoreStudyNote[] = JSON.parse(localStorage.getItem(LOCAL_STUDY_NOTES_KEY) || "[]");
    return list.filter((n) => !deleted.has(n.id.toLowerCase().trim()));
  } catch {
    return [];
  }
}

function getDeletedStudyNoteIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_DELETED_STUDY_NOTES_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    // ignore
  }
  return new Set();
}

// Only ever written when the real Firestore delete fails — see the equivalent comment
// on deleteQuestion() in adminContent.ts for why this must never run unconditionally or
// match by title/text (only by id).
function markStudyNoteDeleted(id: string) {
  try {
    const current = getDeletedStudyNoteIds();
    current.add(id.toLowerCase().trim());
    localStorage.setItem(LOCAL_DELETED_STUDY_NOTES_KEY, JSON.stringify(Array.from(current)));
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

export interface StudyNoteInput {
  title: string;
  driveUrl: string;
  description?: string;
  subjectId: string;
  moduleId: string;
  moduleName: string;
  block: number;
  status?: QuestionStatus;
}

export type SaveStudyNoteResult =
  | { source: "firestore" }
  | { source: "local"; reason: "permission-denied" | "offline" | "unknown"; message: string };

function classifyWriteError(err: unknown): "permission-denied" | "offline" | "unknown" {
  const code = (err as { code?: string } | null)?.code;
  if (code === "permission-denied") return "permission-denied";
  if (code === "unavailable" || (typeof navigator !== "undefined" && !navigator.onLine)) return "offline";
  return "unknown";
}

export async function addStudyNote(input: StudyNoteInput): Promise<SaveStudyNoteResult> {
  const cleanInput = {
    ...input,
    status: input.status ?? "draft",
    createdAt: Date.now(),
  };
  try {
    await addDoc(collection(db, "study_notes"), cleanInput);
    return { source: "firestore" };
  } catch (err) {
    console.warn("Firestore addStudyNote failed, appending to local store:", err);
    const localNotes: FirestoreStudyNote[] = JSON.parse(localStorage.getItem(LOCAL_STUDY_NOTES_KEY) || "[]");
    localNotes.push({ id: `local-${Date.now()}-${Math.random()}`, ...cleanInput });
    localStorage.setItem(LOCAL_STUDY_NOTES_KEY, JSON.stringify(localNotes));
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

export async function updateStudyNoteStatus(id: string, status: QuestionStatus) {
  try {
    await updateDoc(doc(db, "study_notes", id), { status });
  } catch (err) {
    console.warn("Firestore updateStudyNoteStatus failed:", err);
    const localNotes: FirestoreStudyNote[] = JSON.parse(localStorage.getItem(LOCAL_STUDY_NOTES_KEY) || "[]");
    const found = localNotes.find((n) => n.id === id);
    if (found) {
      found.status = status;
      localStorage.setItem(LOCAL_STUDY_NOTES_KEY, JSON.stringify(localNotes));
    }
  }
}

export async function deleteStudyNote(id: string) {
  const localNotes: FirestoreStudyNote[] = JSON.parse(localStorage.getItem(LOCAL_STUDY_NOTES_KEY) || "[]");
  localStorage.setItem(LOCAL_STUDY_NOTES_KEY, JSON.stringify(localNotes.filter((n) => n.id !== id)));

  try {
    await deleteDoc(doc(db, "study_notes", id));
  } catch (err) {
    console.warn("Firestore deleteStudyNote failed, hiding locally instead:", err);
    if (id) markStudyNoteDeleted(id);
  }
}

/** Live view of every Study Note in the bank (all statuses) — admin only. */
export function subscribeAllStudyNotes(
  cb: (notes: FirestoreStudyNote[]) => void,
  onError?: (reason: "permission-denied" | "offline" | "unknown", message: string) => void
) {
  return onSnapshot(
    collection(db, "study_notes"),
    (snap) => {
      const deleted = getDeletedStudyNoteIds();
      const fsNotes = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<FirestoreStudyNote, "id">) }))
        .filter((fn) => !deleted.has(fn.id.toLowerCase().trim()));
      const localNotes = getLocalStudyNotes();
      const byId = new Map<string, FirestoreStudyNote>();
      localNotes.forEach((n) => byId.set(n.id, n));
      fsNotes.forEach((n) => byId.set(n.id, n));
      cb(Array.from(byId.values()));
    },
    (err) => {
      console.warn("Firestore all Study Notes fallback:", err.message);
      const reason = classifyWriteError(err);
      onError?.(
        reason,
        reason === "permission-denied"
          ? "Your account isn't a real Firestore admin yet, so the Study Notes list can't be loaded — only locally cached notes are shown."
          : "Couldn't load Study Notes from Firestore — only locally cached notes are shown."
      );
      cb(getLocalStudyNotes());
    }
  );
}

/** Live view of every *published* Study Note — safe for students/guests. */
export function subscribePublishedStudyNotes(cb: (notes: FirestoreStudyNote[]) => void) {
  return cacheFirstSnapshot(
    "publishedStudyNotes",
    (innerCb) => {
      const q = query(collection(db, "study_notes"), where("status", "==", "published"));
      return onSnapshot(
        q,
        (snap) => {
          const deleted = getDeletedStudyNoteIds();
          const fsNotes = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<FirestoreStudyNote, "id">) }))
            .filter((fn) => !deleted.has(fn.id.toLowerCase().trim()));
          const localNotes = getLocalStudyNotes().filter((n) => n.status === "published");
          const byId = new Map<string, FirestoreStudyNote>();
          localNotes.forEach((n) => byId.set(n.id, n));
          fsNotes.forEach((n) => byId.set(n.id, n));
          innerCb(Array.from(byId.values()));
        },
        (err) => {
          console.warn("Firestore published Study Notes fallback:", err.message);
          innerCb(getLocalStudyNotes().filter((n) => n.status === "published"));
        }
      );
    },
    cb
  );
}
