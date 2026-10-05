import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import type { TestLeaderboardEntry } from "../types";

/**
 * Test Series leaderboard + retake cooldown.
 *
 * One doc per (test, student): `test_leaderboard/{testId}_{uid}`.
 *  - `startedAt` is a server timestamp written when the student STARTS a test. A new attempt
 *    is refused until COOLDOWN_MS has passed (enforced by firestore.rules, not just the UI).
 *    Locking at start means quitting mid-test to peek at the questions doesn't give a free retry.
 *  - The score fields keep the student's best finished attempt.
 */

const COL = "test_leaderboard";

/** How many rows the leaderboard shows. */
export const LEADERBOARD_TOP_N = 15;

/* ------------------------- participant details (name + college) ------------------------- */

export interface Participant {
  name: string;
  college: string;
}

const PARTICIPANT_KEY = "mm_test_participant";
export const MAX_NAME_LEN = 60;
export const MAX_COLLEGE_LEN = 100;

/** Last name/college the student entered, so the pre-test form comes pre-filled. */
export function loadParticipant(): Participant | null {
  try {
    const raw = localStorage.getItem(PARTICIPANT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Participant>;
    if (typeof p.name === "string" && typeof p.college === "string") return { name: p.name, college: p.college };
  } catch {
    /* storage unavailable or corrupt — just start with an empty form */
  }
  return null;
}

export function saveParticipant(p: Participant): void {
  try {
    localStorage.setItem(PARTICIPANT_KEY, JSON.stringify(p));
  } catch {
    /* non-fatal */
  }
}

/** How long a student must wait before attempting the same test again. */
export const RETAKE_COOLDOWN_MS = 2 * 60 * 60 * 1000;

export const entryId = (testId: string, uid: string) => `${testId}_${uid}`;

/** "1h 23m" / "12m 05s" / "42s" */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

/** Milliseconds left on the cooldown for this entry (0 = free to attempt). */
export function cooldownRemaining(entry: { startedAt: number } | undefined | null, now = Date.now()): number {
  if (!entry) return 0;
  return Math.max(0, entry.startedAt + RETAKE_COOLDOWN_MS - now);
}

const toMillis = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (v && typeof (v as { toMillis?: () => number }).toMillis === "function") return (v as { toMillis: () => number }).toMillis();
  return 0;
};

const fromSnap = (d: { id: string; data: () => unknown }): TestLeaderboardEntry => {
  const x = d.data() as Record<string, unknown>;
  return {
    id: d.id,
    testId: String(x.testId ?? ""),
    testName: String(x.testName ?? "Test"),
    uid: String(x.uid ?? ""),
    displayName: String(x.displayName || "Student"),
    college: String(x.college ?? ""),
    startedAt: toMillis(x.startedAt),
    completed: x.completed === true,
    correct: Number(x.correct ?? 0),
    total: Number(x.total ?? 0),
    scorePct: Number(x.scorePct ?? 0),
    timeTakenSec: Number(x.timeTakenSec ?? 0),
    attempts: Number(x.attempts ?? 1),
  };
};

/** The signed-in student's own entries (one per test) — used to show cooldown timers on /tests. */
export function subscribeMyTestEntries(uid: string, cb: (entries: Record<string, TestLeaderboardEntry>) => void) {
  return onSnapshot(
    query(collection(db, COL), where("uid", "==", uid)),
    (snap) => {
      const map: Record<string, TestLeaderboardEntry> = {};
      snap.docs.forEach((d) => {
        const e = fromSnap(d);
        map[e.testId] = e;
      });
      cb(map);
    },
    (err) => {
      console.warn("Firestore my test entries error:", err.message);
      cb({});
    }
  );
}

/** Finished entries for the leaderboard: one test, or every test when `testId` is null (global). */
export function subscribeLeaderboardEntries(
  testId: string | null,
  cb: (entries: TestLeaderboardEntry[]) => void,
  onError?: (message: string) => void
) {
  const q = testId
    ? query(collection(db, COL), where("testId", "==", testId))
    : query(collection(db, COL), where("completed", "==", true));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map(fromSnap).filter((e) => e.completed)),
    (err) => {
      console.warn("Firestore test_leaderboard error:", err.message);
      onError?.(err.message);
      cb([]);
    }
  );
}

export class CooldownError extends Error {
  remainingMs: number;
  constructor(remainingMs: number) {
    super(`You can retake this test in ${formatRemaining(remainingMs)}.`);
    this.remainingMs = remainingMs;
  }
}

/**
 * Called when a student taps "Start test". Stamps the server-side start time (which begins the
 * 2-hour lock) or throws CooldownError if they're still locked out.
 */
export async function beginTestAttempt(params: {
  testId: string;
  testName: string;
  uid: string;
  displayName: string;
  college: string;
  total: number;
}): Promise<void> {
  const { testId, testName, uid, displayName, college, total } = params;
  const ref = doc(db, COL, entryId(testId, uid));
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      testId,
      testName,
      uid,
      displayName: displayName || "Student",
      college,
      startedAt: serverTimestamp(),
      completed: false,
      correct: 0,
      total,
      scorePct: 0,
      timeTakenSec: 0,
      attempts: 1,
    });
    return;
  }

  const existing = fromSnap(snap);
  const remaining = cooldownRemaining(existing);
  if (remaining > 0) throw new CooldownError(remaining);

  await updateDoc(ref, {
    startedAt: serverTimestamp(),
    displayName: displayName || existing.displayName,
    college: college || existing.college,
    testName,
    attempts: existing.attempts + 1,
  });
}

/** Called when a test ends. Keeps the best score (higher %, then faster time). Never throws. */
export async function finishTestAttempt(params: {
  testId: string;
  uid: string;
  correct: number;
  total: number;
}): Promise<void> {
  try {
    // Name + college were stamped when the attempt started and are deliberately left untouched here.
    const { testId, uid, correct, total } = params;
    const ref = doc(db, COL, entryId(testId, uid));
    const snap = await getDoc(ref);
    if (!snap.exists()) return; // started without a lock doc (e.g. admin preview) — nothing to rank
    const existing = fromSnap(snap);

    const timeTakenSec = Math.max(1, Math.round((Date.now() - existing.startedAt) / 1000));
    const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0;

    const better =
      !existing.completed ||
      correct > existing.correct ||
      (correct === existing.correct && timeTakenSec < existing.timeTakenSec);
    if (!better) return;

    await updateDoc(ref, {
      completed: true,
      correct,
      total,
      scorePct,
      timeTakenSec,
    });
  } catch (err) {
    console.warn("Failed to save test result to leaderboard:", err);
  }
}

/* ------------------------------ ranking helpers ------------------------------ */

export interface GlobalRow {
  uid: string;
  displayName: string;
  college: string;
  correct: number;
  total: number;
  testsTaken: number;
  avgPct: number;
  timeTakenSec: number;
}

/** Rank by score, then fastest time. */
export function rankPerTest(entries: TestLeaderboardEntry[]): TestLeaderboardEntry[] {
  return [...entries].sort((a, b) => b.correct - a.correct || a.timeTakenSec - b.timeTakenSec);
}

/** Sums each student's best result across all tests: most correct answers overall wins. */
export function rankGlobal(entries: TestLeaderboardEntry[]): GlobalRow[] {
  const map = new Map<string, GlobalRow & { pctSum: number }>();
  for (const e of entries) {
    const row =
      map.get(e.uid) ??
      { uid: e.uid, displayName: e.displayName, college: e.college, correct: 0, total: 0, testsTaken: 0, avgPct: 0, timeTakenSec: 0, pctSum: 0 };
    row.correct += e.correct;
    row.total += e.total;
    row.testsTaken += 1;
    row.pctSum += e.scorePct;
    row.timeTakenSec += e.timeTakenSec;
    row.displayName = e.displayName || row.displayName;
    row.college = e.college || row.college;
    map.set(e.uid, row);
  }
  return [...map.values()]
    .map((r) => ({ ...r, avgPct: r.testsTaken ? Math.round(r.pctSum / r.testsTaken) : 0 }))
    .sort((a, b) => b.correct - a.correct || a.timeTakenSec - b.timeTakenSec);
}
