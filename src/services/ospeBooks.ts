import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import type { FirestoreOspeBook, QuestionStatus } from "../types";

/**
 * OSPE Books service — mirrors the `lectures` service, including the same
 * Firestore-with-localStorage-fallback pattern, so a book link saved while the
 * signed-in account lacks the real Firestore admin claim (or while offline) still
 * shows up in this browser instead of silently vanishing.
 *
 * Unlike MCQs and Lectures, OSPE Books are scoped to a Subject only — they're
 * whole reference PDFs (e.g. "Anatomy OSPE Guide"), not tied to a specific
 * Block/Module/Topic/Subheading.
 */

const LOCAL_OSPE_BOOKS_KEY = "modular_medico_local_ospe_books";
const LOCAL_DELETED_OSPE_BOOKS_KEY = "modular_medico_deleted_ospe_books";

function getLocalOspeBooks(): FirestoreOspeBook[] {
  try {
    const deleted = getDeletedOspeBookIds();
    const list: FirestoreOspeBook[] = JSON.parse(localStorage.getItem(LOCAL_OSPE_BOOKS_KEY) || "[]");
    return list.filter((b) => !deleted.has(b.id.toLowerCase().trim()));
  } catch {
    return [];
  }
}

function getDeletedOspeBookIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_DELETED_OSPE_BOOKS_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    // ignore
  }
  return new Set();
}

// Only ever written when the real Firestore delete fails — see the equivalent comment
// on deleteQuestion() in adminContent.ts for why this must never run unconditionally or
// match by title/text (only by id).
function markOspeBookDeleted(id: string) {
  try {
    const current = getDeletedOspeBookIds();
    current.add(id.toLowerCase().trim());
    localStorage.setItem(LOCAL_DELETED_OSPE_BOOKS_KEY, JSON.stringify(Array.from(current)));
  } catch {
    // ignore
  }
}

/**
 * Converts any common Google Drive share link (file view, open, or uc?export)
 * into an embeddable /preview URL. Falls back to the original URL if it
 * doesn't look like a recognizable Drive link, so a direct PDF link (or any
 * other host) still gets a usable href even without inline preview.
 */
export function extractDriveFileId(url: string): string | null {
  const trimmed = url.trim();
  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{10,})/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]{10,})/,
    /drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]{10,})/,
    /[?&]id=([a-zA-Z0-9_-]{10,})/,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m) return m[1];
  }
  return null;
}

export function toDrivePreviewUrl(url: string): string | null {
  const id = extractDriveFileId(url);
  return id ? `https://drive.google.com/file/d/${id}/preview` : null;
}

export interface OspeBookInput {
  title: string;
  driveUrl: string;
  description?: string;
  subjectId: string;
  status?: QuestionStatus;
}

export type SaveOspeBookResult =
  | { source: "firestore" }
  | { source: "local"; reason: "permission-denied" | "offline" | "unknown"; message: string };

function classifyWriteError(err: unknown): "permission-denied" | "offline" | "unknown" {
  const code = (err as { code?: string } | null)?.code;
  if (code === "permission-denied") return "permission-denied";
  if (code === "unavailable" || (typeof navigator !== "undefined" && !navigator.onLine)) return "offline";
  return "unknown";
}

export async function addOspeBook(input: OspeBookInput): Promise<SaveOspeBookResult> {
  const cleanInput = {
    ...input,
    status: input.status ?? "draft",
    createdAt: Date.now(),
  };
  try {
    await addDoc(collection(db, "ospe_books"), cleanInput);
    return { source: "firestore" };
  } catch (err) {
    console.warn("Firestore addOspeBook failed, appending to local store:", err);
    const localBooks: FirestoreOspeBook[] = JSON.parse(localStorage.getItem(LOCAL_OSPE_BOOKS_KEY) || "[]");
    localBooks.push({ id: `local-${Date.now()}-${Math.random()}`, ...cleanInput });
    localStorage.setItem(LOCAL_OSPE_BOOKS_KEY, JSON.stringify(localBooks));
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

export async function updateOspeBookStatus(id: string, status: QuestionStatus) {
  try {
    await updateDoc(doc(db, "ospe_books", id), { status });
  } catch (err) {
    console.warn("Firestore updateOspeBookStatus failed:", err);
    const localBooks: FirestoreOspeBook[] = JSON.parse(localStorage.getItem(LOCAL_OSPE_BOOKS_KEY) || "[]");
    const found = localBooks.find((b) => b.id === id);
    if (found) {
      found.status = status;
      localStorage.setItem(LOCAL_OSPE_BOOKS_KEY, JSON.stringify(localBooks));
    }
  }
}

export async function deleteOspeBook(id: string) {
  const localBooks: FirestoreOspeBook[] = JSON.parse(localStorage.getItem(LOCAL_OSPE_BOOKS_KEY) || "[]");
  localStorage.setItem(LOCAL_OSPE_BOOKS_KEY, JSON.stringify(localBooks.filter((b) => b.id !== id)));

  try {
    await deleteDoc(doc(db, "ospe_books", id));
  } catch (err) {
    console.warn("Firestore deleteOspeBook failed, hiding locally instead:", err);
    if (id) markOspeBookDeleted(id);
  }
}

/** Live view of every OSPE Book in the bank (all statuses) — admin only. */
export function subscribeAllOspeBooks(
  cb: (books: FirestoreOspeBook[]) => void,
  onError?: (reason: "permission-denied" | "offline" | "unknown", message: string) => void
) {
  return onSnapshot(
    collection(db, "ospe_books"),
    (snap) => {
      const deleted = getDeletedOspeBookIds();
      const fsBooks = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<FirestoreOspeBook, "id">) }))
        .filter((fb) => !deleted.has(fb.id.toLowerCase().trim()));
      const localBooks = getLocalOspeBooks();
      const byId = new Map<string, FirestoreOspeBook>();
      localBooks.forEach((b) => byId.set(b.id, b));
      fsBooks.forEach((b) => byId.set(b.id, b));
      cb(Array.from(byId.values()));
    },
    (err) => {
      console.warn("Firestore all OSPE books fallback:", err.message);
      const reason = classifyWriteError(err);
      onError?.(
        reason,
        reason === "permission-denied"
          ? "Your account isn't a real Firestore admin yet, so the OSPE Books list can't be loaded — only locally cached books are shown."
          : "Couldn't load OSPE Books from Firestore — only locally cached books are shown."
      );
      cb(getLocalOspeBooks());
    }
  );
}

/** Live view of every *published* OSPE Book — safe for students/guests. */
export function subscribePublishedOspeBooks(cb: (books: FirestoreOspeBook[]) => void) {
  const q = query(collection(db, "ospe_books"), where("status", "==", "published"));
  return onSnapshot(
    q,
    (snap) => {
      const deleted = getDeletedOspeBookIds();
      const fsBooks = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<FirestoreOspeBook, "id">) }))
        .filter((fb) => !deleted.has(fb.id.toLowerCase().trim()));
      const localBooks = getLocalOspeBooks().filter((b) => b.status === "published");
      const byId = new Map<string, FirestoreOspeBook>();
      localBooks.forEach((b) => byId.set(b.id, b));
      fsBooks.forEach((b) => byId.set(b.id, b));
      cb(Array.from(byId.values()));
    },
    (err) => {
      console.warn("Firestore published OSPE books fallback:", err.message);
      cb(getLocalOspeBooks().filter((b) => b.status === "published"));
    }
  );
}
