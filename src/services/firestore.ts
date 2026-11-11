import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  Timestamp,
  runTransaction,
} from "firebase/firestore";
import { db } from "../firebase";
import type { AttemptRecord, BookmarkRecord, MCQ, UserProfile } from "../types";

const todayStr = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

/** Creates the user's profile document on first sign-in/sign-up, if it doesn't exist yet. */
export async function ensureUserProfile(uid: string, email: string, displayName: string) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const profile: Omit<UserProfile, "uid"> = {
      displayName: displayName || "Student",
      email,
      createdAt: Date.now(),
      streak: 0,
      lastActiveDate: null,
      dailyGoalTarget: 50,
      dailyGoalDate: null,
      dailyGoalCount: 0,
      premium: false,
      premiumExpiry: null,
    };
    await setDoc(ref, profile);
  }
}

export function subscribeUserProfile(uid: string, cb: (profile: UserProfile | null) => void) {
  const ref = doc(db, "users", uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      cb({ uid, ...(snap.data() as Omit<UserProfile, "uid">) });
    },
    (err) => {
      console.warn("Firestore subscribeUserProfile error:", err.message);
      cb(null);
    }
  );
}

/**
 * Called once a quiz set finishes. Updates the streak (increments if the user was
 * last active yesterday, resets to 1 if they skipped a day, stays the same if this
 * is a second session today) and the daily-goal question count, then logs the attempt.
 */
export async function recordQuizAttempt(
  uid: string,
  attempt: Omit<AttemptRecord, "id" | "createdAt">
) {
  const userRef = doc(db, "users", uid);
  const today = todayStr();

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    const data = snap.data() as UserProfile | undefined;
    const lastActive = data?.lastActiveDate ?? null;

    let streak = data?.streak ?? 0;
    if (!lastActive) streak = 1;
    else {
      const gap = daysBetween(lastActive, today);
      if (gap === 0) streak = Math.max(streak, 1);
      else if (gap === 1) streak = streak + 1;
      else streak = 1;
    }

    const sameDayGoal = data?.dailyGoalDate === today;
    const dailyGoalCount = (sameDayGoal ? data?.dailyGoalCount ?? 0 : 0) + attempt.total;

    tx.set(
      userRef,
      {
        streak,
        lastActiveDate: today,
        dailyGoalDate: today,
        dailyGoalCount,
      },
      { merge: true }
    );
  });

  await addDoc(collection(db, "users", uid, "attempts"), {
    ...attempt,
    createdAt: Date.now(),
  });
}

export function subscribeRecentAttempts(uid: string, cb: (attempts: AttemptRecord[]) => void) {
  const q = query(collection(db, "users", uid, "attempts"), orderBy("createdAt", "desc"), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttemptRecord, "id">) })));
    },
    (err) => {
      console.warn("Firestore subscribeRecentAttempts error:", err.message);
      cb([]);
    }
  );
}

export function subscribeBookmarks(uid: string, cb: (bookmarks: BookmarkRecord[]) => void) {
  const q = query(collection(db, "users", uid, "bookmarks"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BookmarkRecord, "id">) })));
    },
    (err) => {
      console.warn("Firestore subscribeBookmarks error:", err.message);
      cb([]);
    }
  );
}

export async function addBookmark(uid: string, subjectId: string, moduleName: string, block: number, question: MCQ) {
  await addDoc(collection(db, "users", uid, "bookmarks"), {
    subjectId,
    moduleName,
    block,
    question,
    createdAt: Date.now(),
  });
}

/**
 * Saves an MCQ under a deterministic id (see utils/mcqKey.ts) so the same question can never be
 * saved twice, from any screen. Callers check "already saved" first (the Firestore rules don't
 * allow updating an existing bookmark).
 */
export async function saveMcq(uid: string, key: string, subjectId: string, moduleName: string, block: number, question: Omit<MCQ, "explanation"> & { explanation?: string }) {
  await setDoc(doc(db, "users", uid, "bookmarks", key), {
    subjectId,
    moduleName,
    block,
    question: {
      q: question.q,
      options: question.options,
      correct: question.correct,
      explanation: question.explanation || "",
    },
    createdAt: Date.now(),
  });
}

export async function removeBookmark(uid: string, bookmarkId: string) {
  await deleteDoc(doc(db, "users", uid, "bookmarks", bookmarkId));
}

export async function setPremium(uid: string, months = 1) {
  const expiry = Timestamp.now().toMillis() + months * 30 * 24 * 60 * 60 * 1000;
  await updateDoc(doc(db, "users", uid), { premium: true, premiumExpiry: expiry, premiumSince: serverTimestamp() });
}
export async function fetchAllUserAttempts(uid: string): Promise<AttemptRecord[]> {
  try {
    const q = query(collection(db, "users", uid, "attempts"), orderBy("createdAt", "asc"));
    const snap = await getDocs(q);
    return snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as Omit<AttemptRecord, "id">) }));
  } catch (err) {
    console.error("Failed to fetch all attempts:", err);
    return [];
  }
}
