import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import type { FirestoreLecture, QuestionStatus } from "../types";

/**
 * Lectures service — mirrors the `questions` service in adminContent.ts, including the
 * same Firestore-with-localStorage-fallback pattern, so a lecture link saved while the
 * signed-in account lacks the real Firestore admin claim (or while offline) still shows
 * up in this browser instead of silently vanishing. Lectures follow the identical 4-tier
 * hierarchy as MCQs: Block -> Module -> Subject -> Subheading.
 */

const LOCAL_LECTURES_KEY = "modular_medico_local_lectures";
const LOCAL_DELETED_LECTURES_KEY = "modular_medico_deleted_lectures";

function getLocalLectures(): FirestoreLecture[] {
  try {
    const deleted = getDeletedLectureIds();
    const list: FirestoreLecture[] = JSON.parse(localStorage.getItem(LOCAL_LECTURES_KEY) || "[]");
    return list.filter((l) => !deleted.has(l.id.toLowerCase().trim()));
  } catch {
    return [];
  }
}

function getDeletedLectureIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_DELETED_LECTURES_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    // ignore
  }
  return new Set();
}

// Only ever written when the real Firestore delete fails — see the equivalent comment
// on deleteQuestion() in adminContent.ts for why this must never run unconditionally or
// match by title/text (only by id).
function markLectureDeleted(id: string) {
  try {
    const current = getDeletedLectureIds();
    current.add(id.toLowerCase().trim());
    localStorage.setItem(LOCAL_DELETED_LECTURES_KEY, JSON.stringify(Array.from(current)));
  } catch {
    // ignore
  }
}

/** Extracts a YouTube video id from any common URL shape (watch, youtu.be, embed, shorts). */
export function extractYouTubeId(url: string): string | null {
  const trimmed = url.trim();
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})/,
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m) return m[1];
  }
  // Bare video id pasted directly
  if (/^[a-zA-Z0-9_-]{10,15}$/.test(trimmed)) return trimmed;
  return null;
}

export function toYouTubeEmbedUrl(url: string): string | null {
  const id = extractYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

export interface LectureInput {
  title: string;
  youtubeUrl: string;
  description?: string;
  subjectId: string;
  moduleId: string;
  moduleName: string;
  block: number;
  subheadingId?: string | null;
  subheadingName?: string | null;
  status?: QuestionStatus;
}

export type SaveLectureResult =
  | { source: "firestore" }
  | { source: "local"; reason: "permission-denied" | "offline" | "unknown"; message: string };

function classifyWriteError(err: unknown): "permission-denied" | "offline" | "unknown" {
  const code = (err as { code?: string } | null)?.code;
  if (code === "permission-denied") return "permission-denied";
  if (code === "unavailable" || (typeof navigator !== "undefined" && !navigator.onLine)) return "offline";
  return "unknown";
}

export async function addLecture(input: LectureInput): Promise<SaveLectureResult> {
  const cleanInput = {
    ...input,
    status: input.status ?? "draft",
    createdAt: Date.now(),
  };
  try {
    await addDoc(collection(db, "lectures"), cleanInput);
    return { source: "firestore" };
  } catch (err) {
    console.warn("Firestore addLecture failed, appending to local store:", err);
    const localLectures: FirestoreLecture[] = JSON.parse(localStorage.getItem(LOCAL_LECTURES_KEY) || "[]");
    localLectures.push({ id: `local-${Date.now()}-${Math.random()}`, ...cleanInput });
    localStorage.setItem(LOCAL_LECTURES_KEY, JSON.stringify(localLectures));
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

export async function updateLectureStatus(id: string, status: QuestionStatus) {
  try {
    await updateDoc(doc(db, "lectures", id), { status });
  } catch (err) {
    console.warn("Firestore updateLectureStatus failed:", err);
    const localLectures: FirestoreLecture[] = JSON.parse(localStorage.getItem(LOCAL_LECTURES_KEY) || "[]");
    const found = localLectures.find((l) => l.id === id);
    if (found) {
      found.status = status;
      localStorage.setItem(LOCAL_LECTURES_KEY, JSON.stringify(localLectures));
    }
  }
}

export async function deleteLecture(id: string) {
  const localLectures: FirestoreLecture[] = JSON.parse(localStorage.getItem(LOCAL_LECTURES_KEY) || "[]");
  localStorage.setItem(LOCAL_LECTURES_KEY, JSON.stringify(localLectures.filter((l) => l.id !== id)));

  try {
    await deleteDoc(doc(db, "lectures", id));
  } catch (err) {
    console.warn("Firestore deleteLecture failed, hiding locally instead:", err);
    if (id) markLectureDeleted(id);
  }
}

/** Live view of every lecture in the bank (all statuses) — admin only. */
export function subscribeAllLectures(
  cb: (lectures: FirestoreLecture[]) => void,
  onError?: (reason: "permission-denied" | "offline" | "unknown", message: string) => void
) {
  return onSnapshot(
    collection(db, "lectures"),
    (snap) => {
      const deleted = getDeletedLectureIds();
      const fsLectures = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<FirestoreLecture, "id">) }))
        .filter((fl) => !deleted.has(fl.id.toLowerCase().trim()));
      const localLectures = getLocalLectures();
      const byId = new Map<string, FirestoreLecture>();
      localLectures.forEach((l) => byId.set(l.id, l));
      fsLectures.forEach((l) => byId.set(l.id, l));
      cb(Array.from(byId.values()));
    },
    (err) => {
      console.warn("Firestore all lectures fallback:", err.message);
      const reason = classifyWriteError(err);
      onError?.(
        reason,
        reason === "permission-denied"
          ? "Your account isn't a real Firestore admin yet, so the lecture list can't be loaded — only locally cached lectures are shown."
          : "Couldn't load lectures from Firestore — only locally cached lectures are shown."
      );
      cb(getLocalLectures());
    }
  );
}

/** Live view of every *published* lecture — safe for students/guests. */
export function subscribePublishedLectures(cb: (lectures: FirestoreLecture[]) => void) {
  const q = query(collection(db, "lectures"), where("status", "==", "published"));
  return onSnapshot(
    q,
    (snap) => {
      const deleted = getDeletedLectureIds();
      const fsLectures = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<FirestoreLecture, "id">) }))
        .filter((fl) => !deleted.has(fl.id.toLowerCase().trim()));
      const localLectures = getLocalLectures().filter((l) => l.status === "published");
      const byId = new Map<string, FirestoreLecture>();
      localLectures.forEach((l) => byId.set(l.id, l));
      fsLectures.forEach((l) => byId.set(l.id, l));
      cb(Array.from(byId.values()));
    },
    (err) => {
      console.warn("Firestore published lectures fallback:", err.message);
      cb(getLocalLectures().filter((l) => l.status === "published"));
    }
  );
}
