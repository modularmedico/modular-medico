import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import type { MockTestDoc, QuestionStatus, TestSessionQuestion, TestSessionSource } from "../types";

/**
 * Mock Tests: Block (1..15) -> "Mock Test 1", "Mock Test 2"... Same philosophy as Test Sessions —
 * MCQs are snapshotted into the document and there is no localStorage fallback, so every admin
 * write either really saved or throws.
 */

const COL = "mock_tests";

const fromSnap = (d: { id: string; data: () => unknown }): MockTestDoc => {
  const data = d.data() as Partial<MockTestDoc>;
  return {
    id: d.id,
    name: data.name || "Mock Test",
    status: data.status === "published" ? "published" : "draft",
    questions: data.questions || [],
    sources: data.sources || [],
    showAnswersAtEnd: true,
    createdAt: data.createdAt || 0,
    block: Number(data.block) || 0,
    order: Number(data.order) || 0,
  };
};

const byOrder = (a: MockTestDoc, b: MockTestDoc) => a.block - b.block || a.order - b.order || a.createdAt - b.createdAt;

export function subscribeAllMockTests(cb: (list: MockTestDoc[]) => void, onError?: (msg: string) => void) {
  return onSnapshot(
    collection(db, COL),
    (snap) => cb(snap.docs.map(fromSnap).sort(byOrder)),
    (err) => {
      console.warn("Firestore mock_tests error:", err.message);
      onError?.(err.message);
      cb([]);
    }
  );
}

/** Student view: published mock tests only (the `where` is required by the rules). */
export function subscribePublishedMockTests(cb: (list: MockTestDoc[]) => void, onError?: (msg: string) => void) {
  return onSnapshot(
    query(collection(db, COL), where("status", "==", "published")),
    (snap) => cb(snap.docs.map(fromSnap).filter((m) => m.questions.length > 0).sort(byOrder)),
    (err) => {
      console.warn("Firestore published mock_tests error:", err.message);
      onError?.(err.message);
      cb([]);
    }
  );
}

export async function createMockTest(block: number, name: string, order: number): Promise<string> {
  if (!Number.isInteger(block) || block < 1) throw new Error("Pick a Block first.");
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Give the mock test a name first.");
  const ref = await addDoc(collection(db, COL), {
    block,
    order,
    name: trimmed,
    status: "draft" as QuestionStatus,
    questions: [],
    sources: [],
    showAnswersAtEnd: true,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function deleteMockTest(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

export async function setMockTestStatus(id: string, status: QuestionStatus): Promise<void> {
  await updateDoc(doc(db, COL, id), { status });
}

export async function renameMockTest(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await updateDoc(doc(db, COL, id), { name: trimmed });
}

export async function addQuestionsToMockTest(
  test: MockTestDoc,
  added: TestSessionQuestion[],
  source: TestSessionSource
): Promise<void> {
  await updateDoc(doc(db, COL, test.id), {
    questions: [...test.questions, ...added],
    sources: [...test.sources, source],
  });
}

export async function removeQuestionFromMockTest(test: MockTestDoc, sourceId: string): Promise<void> {
  await updateDoc(doc(db, COL, test.id), {
    questions: test.questions.filter((q) => q.sourceId !== sourceId),
  });
}
