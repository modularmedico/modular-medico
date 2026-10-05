import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import type { QuestionStatus, TestSessionDoc, TestSessionQuestion, TestSessionSource } from "../types";

/**
 * Test Sessions service. Unlike other content there is deliberately no localStorage
 * fallback: a test only counts if it is really saved to Firestore, so every write
 * either succeeds or throws (the admin UI shows the error).
 */

const COL = "test_sessions";

const fromSnap = (d: { id: string; data: () => unknown }): TestSessionDoc => {
  const data = d.data() as Partial<TestSessionDoc>;
  return {
    id: d.id,
    name: data.name || "Untitled test",
    status: data.status === "published" ? "published" : "draft",
    questions: data.questions || [],
    sources: data.sources || [],
    // Older tests have no field -> treat as "results at the end".
    showAnswersAtEnd: data.showAnswersAtEnd !== false,
    createdAt: data.createdAt || 0,
  };
};

const newestFirst = (a: TestSessionDoc, b: TestSessionDoc) => b.createdAt - a.createdAt;

/** Admin view: every test session, drafts included. */
export function subscribeAllTestSessions(
  cb: (tests: TestSessionDoc[]) => void,
  onError?: (message: string) => void
) {
  return onSnapshot(
    collection(db, COL),
    (snap) => cb(snap.docs.map(fromSnap).sort(newestFirst)),
    (err) => {
      console.warn("Firestore test_sessions error:", err.message);
      onError?.(err.message);
      cb([]);
    }
  );
}

/** Student view: published tests only (the `where` is required by the Firestore rules). */
export function subscribePublishedTestSessions(
  cb: (tests: TestSessionDoc[]) => void,
  onError?: (message: string) => void
) {
  return onSnapshot(
    query(collection(db, COL), where("status", "==", "published")),
    (snap) => cb(snap.docs.map(fromSnap).sort(newestFirst)),
    (err) => {
      console.warn("Firestore published test_sessions error:", err.message);
      onError?.(err.message);
      cb([]);
    }
  );
}

export async function createTestSession(name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Give the test a name first.");
  const ref = await addDoc(collection(db, COL), {
    name: trimmed,
    status: "draft" as QuestionStatus,
    questions: [],
    sources: [],
    showAnswersAtEnd: true,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function deleteTestSession(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

export async function setTestSessionStatus(id: string, status: QuestionStatus): Promise<void> {
  await updateDoc(doc(db, COL, id), { status });
}

/** Choose whether students see answers instantly (false) or only on the results screen (true). */
export async function setTestSessionShowAnswersAtEnd(id: string, showAnswersAtEnd: boolean): Promise<void> {
  await updateDoc(doc(db, COL, id), { showAnswersAtEnd });
}

export async function renameTestSession(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await updateDoc(doc(db, COL, id), { name: trimmed });
}

/** Append MCQs (already de-duplicated against the test by the caller) and record where they came from. */
export async function addQuestionsToTestSession(
  test: TestSessionDoc,
  added: TestSessionQuestion[],
  source: TestSessionSource
): Promise<void> {
  await updateDoc(doc(db, COL, test.id), {
    questions: [...test.questions, ...added],
    sources: [...test.sources, source],
  });
}

export async function removeQuestionFromTestSession(test: TestSessionDoc, sourceId: string): Promise<void> {
  await updateDoc(doc(db, COL, test.id), {
    questions: test.questions.filter((q) => q.sourceId !== sourceId),
  });
}
