import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { DEFAULT_MODULES, DEFAULT_QUESTIONS } from "../data/defaultCurriculum";
import { DEFAULT_BLOCK_DEFINITIONS, type BlockDefinition } from "../data/subjects";
import type { Difficulty, FirestoreQuestion, ModuleDoc, QuestionStatus, SubheadingDoc } from "../types";

const LOCAL_MODULES_KEY = "modular_medico_custom_modules";
const LOCAL_BLOCKS_KEY = "modular_medico_custom_blocks";
const LOCAL_SUBHEADINGS_KEY = "modular_medico_subheadings";

function getLocalBlockDefinitions(): BlockDefinition[] | null {
  try {
    const raw = localStorage.getItem(LOCAL_BLOCKS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

function setLocalBlockDefinitions(blocks: BlockDefinition[]) {
  try {
    localStorage.setItem(LOCAL_BLOCKS_KEY, JSON.stringify(blocks));
  } catch {
    // ignore
  }
}

/* ---------------------------- Blocks ---------------------------- */

export function subscribeBlockDefinitions(cb: (blocks: BlockDefinition[]) => void) {
  const local = getLocalBlockDefinitions() || DEFAULT_BLOCK_DEFINITIONS;
  const q = query(collection(db, "block_definitions"));
  return onSnapshot(
    q,
    (snap) => {
      if (!snap.empty) {
        const list = snap.docs
          .map((d) => d.data() as BlockDefinition)
          .sort((a, b) => a.block - b.block);
        setLocalBlockDefinitions(list);
        cb(list);
      } else {
        cb(local);
      }
    },
    (err) => {
      console.warn("Firestore block_definitions fallback:", err.message);
      cb(local);
    }
  );
}

export async function saveBlockDefinitions(blocks: BlockDefinition[]) {
  setLocalBlockDefinitions(blocks);
  try {
    const batch = writeBatch(db);
    const existingSnap = await getDocs(collection(db, "block_definitions"));
    existingSnap.docs.forEach((d) => batch.delete(d.ref));
    blocks.forEach((b) => {
      const ref = doc(collection(db, "block_definitions"), `block_${b.block}`);
      batch.set(ref, b);
    });
    await batch.commit();
  } catch (err) {
    console.warn("Firestore saveBlockDefinitions remote batch failed, local storage persisted:", err);
  }
}

function getLocalSubjectModules(subjectId: string): ModuleDoc[] | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_MODULES_KEY}_${subjectId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

function setLocalSubjectModules(subjectId: string, modules: ModuleDoc[]) {
  try {
    localStorage.setItem(`${LOCAL_MODULES_KEY}_${subjectId}`, JSON.stringify(modules));
  } catch {
    // ignore
  }
}

/* ---------------------------- Modules ---------------------------- */

export function subscribeModules(subjectId: string, cb: (modules: ModuleDoc[]) => void) {
  const local = getLocalSubjectModules(subjectId);
  const fallback = local || DEFAULT_MODULES[subjectId] || [];

  const q = query(collection(db, "modules"), where("subjectId", "==", subjectId));
  return onSnapshot(
    q,
    (snap) => {
      if (!snap.empty) {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<ModuleDoc, "id">) }))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setLocalSubjectModules(subjectId, list);
        cb(list);
      } else {
        cb(fallback);
      }
    },
    (err) => {
      console.warn("Firestore modules query fallback to local/default:", err.message);
      cb(fallback);
    }
  );
}

export async function createModule(subjectId: string, name: string, order: number) {
  const docData = { subjectId, name, order };
  let id = "";
  try {
    const ref = await addDoc(collection(db, "modules"), docData);
    id = ref.id;
  } catch (err) {
    console.warn("Firestore createModule failed, saving locally:", err);
    id = `${subjectId}-${Date.now()}`;
  }
  const current = getLocalSubjectModules(subjectId) || DEFAULT_MODULES[subjectId] || [];
  const next = [...current, { id, ...docData }];
  setLocalSubjectModules(subjectId, next);
  return id;
}

export async function saveSubjectModules(subjectId: string, moduleItems: { id: string; name: string; order: number }[]) {
  setLocalSubjectModules(
    subjectId,
    moduleItems.map((m) => ({ id: m.id, subjectId, name: m.name, order: m.order }))
  );
  try {
    const batch = writeBatch(db);
    // Delete existing modules for this subject first
    const existingSnap = await getDocs(query(collection(db, "modules"), where("subjectId", "==", subjectId)));
    existingSnap.docs.forEach((d) => batch.delete(d.ref));

    // Insert new modules
    moduleItems.forEach((m) => {
      const ref = doc(collection(db, "modules"));
      batch.set(ref, { subjectId, name: m.name, order: m.order });
    });
    await batch.commit();
  } catch (err) {
    console.warn("Firestore saveSubjectModules remote batch failed, local storage persisted:", err);
  }
}

export async function deleteModule(subjectId: string, moduleId: string) {
  const current = getLocalSubjectModules(subjectId) || DEFAULT_MODULES[subjectId] || [];
  setLocalSubjectModules(
    subjectId,
    current.filter((m) => m.id !== moduleId)
  );
  try {
    await deleteDoc(doc(db, "modules", moduleId));
  } catch (err) {
    console.warn("Firestore deleteModule failed:", err);
  }
}

/* -------------------------- Subheadings ---------------------------- */
/*
 * Subheadings are the 4th tier of the content hierarchy:
 *   Block -> Module -> Subject -> Subheading
 * Each subheading is scoped to one (block, moduleId, subjectId) triple, so a
 * given Subject can have a completely different set of subheadings inside
 * each Module/Block it appears in. Follows the same Firestore-with-
 * localStorage-fallback pattern used for blocks/modules above.
 */

function subheadingsLocalKey(block: number, moduleId: string, subjectId: string) {
  return `${LOCAL_SUBHEADINGS_KEY}__${block}__${moduleId}__${subjectId}`;
}

function getLocalSubheadings(block: number, moduleId: string, subjectId: string): SubheadingDoc[] {
  try {
    const raw = localStorage.getItem(subheadingsLocalKey(block, moduleId, subjectId));
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function setLocalSubheadings(block: number, moduleId: string, subjectId: string, list: SubheadingDoc[]) {
  try {
    localStorage.setItem(subheadingsLocalKey(block, moduleId, subjectId), JSON.stringify(list));
  } catch {
    // ignore
  }
}

/** Live subheadings scoped to one Block + Module + Subject combination. */
export function subscribeSubheadings(
  block: number,
  moduleId: string,
  subjectId: string,
  cb: (subheadings: SubheadingDoc[]) => void
) {
  if (!moduleId || !subjectId) {
    cb([]);
    return () => {};
  }
  const fallback = getLocalSubheadings(block, moduleId, subjectId);

  const q = query(
    collection(db, "subheadings"),
    where("block", "==", block),
    where("moduleId", "==", moduleId),
    where("subjectId", "==", subjectId)
  );
  return onSnapshot(
    q,
    (snap) => {
      if (!snap.empty) {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<SubheadingDoc, "id">) }))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setLocalSubheadings(block, moduleId, subjectId, list);
        cb(list);
      } else {
        cb(fallback);
      }
    },
    (err) => {
      console.warn("Firestore subheadings query fallback to local:", err.message);
      cb(fallback);
    }
  );
}

/** Create a new Subheading under a specific Block -> Module -> Subject. */
export async function createSubheading(block: number, moduleId: string, subjectId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const current = getLocalSubheadings(block, moduleId, subjectId);

  // Avoid exact-name duplicates within the same scope.
  const existing = current.find((s) => s.name.trim().toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing.id;

  const docData = { block, moduleId, subjectId, name: trimmed, order: current.length };
  let id = "";
  try {
    const ref = await addDoc(collection(db, "subheadings"), docData);
    id = ref.id;
  } catch (err) {
    console.warn("Firestore createSubheading failed, saving locally:", err);
    id = `local-sh-${Date.now()}-${Math.round(Math.random() * 1000)}`;
  }
  setLocalSubheadings(block, moduleId, subjectId, [...current, { id, ...docData }]);
  return id;
}

/** Rename an existing Subheading. */
export async function renameSubheading(
  block: number,
  moduleId: string,
  subjectId: string,
  subheadingId: string,
  name: string
) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const current = getLocalSubheadings(block, moduleId, subjectId);
  setLocalSubheadings(
    block,
    moduleId,
    subjectId,
    current.map((s) => (s.id === subheadingId ? { ...s, name: trimmed } : s))
  );
  try {
    await updateDoc(doc(db, "subheadings", subheadingId), { name: trimmed });
  } catch (err) {
    console.warn("Firestore renameSubheading failed, local storage updated:", err);
  }
}

/** Delete a Subheading. Questions already tagged with it keep their tag as free text. */
export async function deleteSubheading(block: number, moduleId: string, subjectId: string, subheadingId: string) {
  const current = getLocalSubheadings(block, moduleId, subjectId);
  setLocalSubheadings(
    block,
    moduleId,
    subjectId,
    current.filter((s) => s.id !== subheadingId)
  );
  try {
    await deleteDoc(doc(db, "subheadings", subheadingId));
  } catch (err) {
    console.warn("Firestore deleteSubheading failed:", err);
  }
}

/* --------------------------- Questions ---------------------------- */

export interface QuestionInput {
  subjectId: string;
  moduleId: string;
  moduleName: string;
  block: number;
  subheadingId?: string | null;
  subheadingName?: string | null;
  difficulty: Difficulty;
  q: string;
  options: string[];
  correct: number;
  explanation: string;
  status?: QuestionStatus;
}

export async function addQuestion(input: QuestionInput) {
  const cleanInput = {
    ...input,
    status: input.status ?? "draft",
    createdAt: Date.now(),
  };
  try {
    await addDoc(collection(db, "questions"), cleanInput);
  } catch (err) {
    console.warn("Firestore addQuestion failed, appending to local store:", err);
    const localQuestions: FirestoreQuestion[] = JSON.parse(localStorage.getItem("modular_medico_local_qs") || "[]");
    localQuestions.push({ id: `local-${Date.now()}-${Math.random()}`, ...cleanInput });
    localStorage.setItem("modular_medico_local_qs", JSON.stringify(localQuestions));
  }
}

export async function bulkAddQuestions(inputs: QuestionInput[]) {
  try {
    const batch = writeBatch(db);
    inputs.forEach((input) => {
      const ref = doc(collection(db, "questions"));
      batch.set(ref, { ...input, status: input.status ?? "draft", createdAt: Date.now() });
    });
    await batch.commit();
  } catch (err) {
    console.warn("Firestore bulkAddQuestions failed, storing locally:", err);
    const localQuestions: FirestoreQuestion[] = JSON.parse(localStorage.getItem("modular_medico_local_qs") || "[]");
    inputs.forEach((inp) => {
      localQuestions.push({
        id: `local-${Date.now()}-${Math.random()}`,
        ...inp,
        status: inp.status ?? "draft",
        createdAt: Date.now(),
      });
    });
    localStorage.setItem("modular_medico_local_qs", JSON.stringify(localQuestions));
  }
}

export async function updateQuestionStatus(id: string, status: QuestionStatus) {
  try {
    await updateDoc(doc(db, "questions", id), { status });
  } catch (err) {
    console.warn("Firestore updateQuestionStatus failed:", err);
    const localQuestions: FirestoreQuestion[] = JSON.parse(localStorage.getItem("modular_medico_local_qs") || "[]");
    const found = localQuestions.find((q) => q.id === id);
    if (found) {
      found.status = status;
      localStorage.setItem("modular_medico_local_qs", JSON.stringify(localQuestions));
    }
  }
}

const LOCAL_DELETED_QS_KEY = "modular_medico_deleted_qs";

function getDeletedQuestionIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_DELETED_QS_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    // ignore
  }
  return new Set();
}

function markQuestionDeleted(idOrText: string) {
  try {
    const current = getDeletedQuestionIds();
    current.add(idOrText.toLowerCase().trim());
    localStorage.setItem(LOCAL_DELETED_QS_KEY, JSON.stringify(Array.from(current)));
  } catch {
    // ignore
  }
}

export async function deleteQuestion(id: string, qText?: string) {
  if (id) markQuestionDeleted(id);
  if (qText) markQuestionDeleted(qText);

  // Update local storage
  const localQuestions: FirestoreQuestion[] = JSON.parse(localStorage.getItem("modular_medico_local_qs") || "[]");
  const filtered = localQuestions.filter((q) => q.id !== id && (qText ? q.q.trim().toLowerCase() !== qText.trim().toLowerCase() : true));
  localStorage.setItem("modular_medico_local_qs", JSON.stringify(filtered));

  try {
    await deleteDoc(doc(db, "questions", id));
  } catch (err) {
    console.warn("Firestore deleteQuestion failed:", err);
  }
}

/**
 * Delete many questions at once (e.g. every MCQ under a subheading). Mirrors deleteQuestion
 * but batches the Firestore writes and updates local storage a single time at the end,
 * which matters once a subheading has dozens of MCQs.
 */
export async function bulkDeleteQuestions(items: { id: string; q: string }[]) {
  if (items.length === 0) return;

  items.forEach((item) => {
    if (item.id) markQuestionDeleted(item.id);
    if (item.q) markQuestionDeleted(item.q);
  });

  const idSet = new Set(items.map((i) => i.id));
  const textSet = new Set(items.map((i) => i.q.trim().toLowerCase()));
  const localQuestions: FirestoreQuestion[] = JSON.parse(localStorage.getItem("modular_medico_local_qs") || "[]");
  const filtered = localQuestions.filter((q) => !idSet.has(q.id) && !textSet.has(q.q.trim().toLowerCase()));
  localStorage.setItem("modular_medico_local_qs", JSON.stringify(filtered));

  try {
    const batch = writeBatch(db);
    items.forEach((item) => {
      if (item.id) batch.delete(doc(db, "questions", item.id));
    });
    await batch.commit();
  } catch (err) {
    console.warn("Firestore bulkDeleteQuestions batch failed:", err);
  }
}

function getLocalQuestions(): FirestoreQuestion[] {
  try {
    const deleted = getDeletedQuestionIds();
    const list: FirestoreQuestion[] = JSON.parse(localStorage.getItem("modular_medico_local_qs") || "[]");
    return list.filter((q) => !deleted.has(q.id.toLowerCase().trim()) && !deleted.has(q.q.toLowerCase().trim()));
  } catch {
    return [];
  }
}

/** Live view of questions for a subject */
export function subscribeSubjectQuestions(subjectId: string, cb: (questions: FirestoreQuestion[]) => void) {
  const deleted = getDeletedQuestionIds();
  const q = query(collection(db, "questions"), where("subjectId", "==", subjectId));
  return onSnapshot(
    q,
    (snap) => {
      const fsQuestions = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FirestoreQuestion, "id">) }));
      const defQuestions = DEFAULT_QUESTIONS.filter((dq) => dq.subjectId === subjectId);
      const localQs = getLocalQuestions().filter((lq) => lq.subjectId === subjectId);

      const map = new Map<string, FirestoreQuestion>();
      defQuestions.forEach((dq) => {
        if (!deleted.has(dq.id.toLowerCase().trim()) && !deleted.has(dq.q.toLowerCase().trim())) {
          map.set(dq.q.trim().toLowerCase(), dq);
        }
      });
      localQs.forEach((lq) => {
        if (!deleted.has(lq.id.toLowerCase().trim()) && !deleted.has(lq.q.toLowerCase().trim())) {
          map.set(lq.q.trim().toLowerCase(), lq);
        }
      });
      fsQuestions.forEach((fq) => {
        if (!deleted.has(fq.id.toLowerCase().trim()) && !deleted.has(fq.q.toLowerCase().trim())) {
          map.set(fq.q.trim().toLowerCase(), fq);
        }
      });

      cb(Array.from(map.values()));
    },
    (err) => {
      console.warn("Firestore subject questions fallback:", err.message);
      const defQuestions = DEFAULT_QUESTIONS.filter((dq) => dq.subjectId === subjectId);
      const localQs = getLocalQuestions().filter((lq) => lq.subjectId === subjectId);
      const map = new Map<string, FirestoreQuestion>();
      defQuestions.forEach((dq) => {
        if (!deleted.has(dq.id.toLowerCase().trim()) && !deleted.has(dq.q.toLowerCase().trim())) {
          map.set(dq.q.trim().toLowerCase(), dq);
        }
      });
      localQs.forEach((lq) => {
        if (!deleted.has(lq.id.toLowerCase().trim()) && !deleted.has(lq.q.toLowerCase().trim())) {
          map.set(lq.q.trim().toLowerCase(), lq);
        }
      });
      cb(Array.from(map.values()));
    }
  );
}

/** Live view of every question in the bank */
export function subscribeAllQuestions(cb: (questions: FirestoreQuestion[]) => void) {
  return onSnapshot(
    collection(db, "questions"),
    (snap) => {
      const deleted = getDeletedQuestionIds();
      const fsQuestions = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FirestoreQuestion, "id">) }));
      const localQs = getLocalQuestions();

      const map = new Map<string, FirestoreQuestion>();
      DEFAULT_QUESTIONS.forEach((dq) => {
        if (!deleted.has(dq.id.toLowerCase().trim()) && !deleted.has(dq.q.toLowerCase().trim())) {
          map.set(dq.q.trim().toLowerCase(), dq);
        }
      });
      localQs.forEach((lq) => {
        if (!deleted.has(lq.id.toLowerCase().trim()) && !deleted.has(lq.q.toLowerCase().trim())) {
          map.set(lq.q.trim().toLowerCase(), lq);
        }
      });
      fsQuestions.forEach((fq) => {
        if (!deleted.has(fq.id.toLowerCase().trim()) && !deleted.has(fq.q.toLowerCase().trim())) {
          map.set(fq.q.trim().toLowerCase(), fq);
        }
      });

      cb(Array.from(map.values()));
    },
    (err) => {
      console.warn("Firestore all questions fallback:", err.message);
      const deleted = getDeletedQuestionIds();
      const localQs = getLocalQuestions();
      const map = new Map<string, FirestoreQuestion>();
      DEFAULT_QUESTIONS.forEach((dq) => {
        if (!deleted.has(dq.id.toLowerCase().trim()) && !deleted.has(dq.q.toLowerCase().trim())) {
          map.set(dq.q.trim().toLowerCase(), dq);
        }
      });
      localQs.forEach((lq) => {
        if (!deleted.has(lq.id.toLowerCase().trim()) && !deleted.has(lq.q.toLowerCase().trim())) {
          map.set(lq.q.trim().toLowerCase(), lq);
        }
      });
      cb(Array.from(map.values()));
    }
  );
}

/** One-time fetch of published questions for a practice session */
export async function fetchPublishedBlock(
  subjectId: string,
  moduleId?: string,
  block?: number,
  difficulty?: Difficulty | "all",
  subheadingId?: string | null
): Promise<FirestoreQuestion[]> {
  const applySubheadingFilter = (list: FirestoreQuestion[]) =>
    subheadingId ? list.filter((item) => item.subheadingId === subheadingId) : list;

  try {
    const clauses = [
      where("subjectId", "==", subjectId),
      where("status", "==", "published"),
    ];
    if (moduleId && moduleId !== "all" && moduleId !== "custom") {
      clauses.push(where("moduleId", "==", moduleId));
    }
    if (block && block > 0) {
      clauses.push(where("block", "==", block));
    }
    if (difficulty && difficulty !== "all") {
      clauses.push(where("difficulty", "==", difficulty));
    }

    const q = query(collection(db, "questions"), ...clauses);
    const snap = await getDocs(q);
    const fsResults = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FirestoreQuestion, "id">) }));

    const localQs = getLocalQuestions().filter((lq) => {
      if (lq.subjectId !== subjectId || lq.status !== "published") return false;
      if (moduleId && moduleId !== "all" && moduleId !== "custom" && lq.moduleId !== moduleId) return false;
      if (block && block > 0 && lq.block !== block) return false;
      if (difficulty && difficulty !== "all" && lq.difficulty !== difficulty) return false;
      return true;
    });

    const defResults = DEFAULT_QUESTIONS.filter((dq) => {
      if (dq.subjectId !== subjectId || dq.status !== "published") return false;
      if (moduleId && moduleId !== "all" && moduleId !== "custom") {
        if (dq.moduleId !== moduleId && dq.moduleName.toLowerCase() !== moduleId.toLowerCase()) return false;
      }
      if (block && block > 0 && dq.block !== block) return false;
      if (difficulty && difficulty !== "all" && dq.difficulty !== difficulty) return false;
      return true;
    });

    const map = new Map<string, FirestoreQuestion>();
    defResults.forEach((dq) => map.set(dq.q.trim().toLowerCase(), dq));
    localQs.forEach((lq) => map.set(lq.q.trim().toLowerCase(), lq));
    fsResults.forEach((fq) => map.set(fq.q.trim().toLowerCase(), fq));

    const combined = applySubheadingFilter(Array.from(map.values()));
    if (combined.length > 0) return combined;
  } catch (err) {
    console.warn("Firestore fetchPublishedBlock failed, using default questions:", err);
  }

  // Fallback to local default questions
  return applySubheadingFilter(
    DEFAULT_QUESTIONS.filter((dq) => {
      if (dq.subjectId !== subjectId || dq.status !== "published") return false;
      if (moduleId && moduleId !== "all" && moduleId !== "custom") {
        if (dq.moduleId !== moduleId && dq.moduleName.toLowerCase() !== moduleId.toLowerCase()) return false;
      }
      if (block && block > 0 && dq.block !== block) return false;
      if (difficulty && difficulty !== "all" && dq.difficulty !== difficulty) return false;
      return true;
    })
  );
}

/** One-time fetch of all published questions for a specific Module across all subjects */
export async function fetchPublishedModuleExam(
  block: number,
  moduleId: string,
  difficulty?: Difficulty | "all",
  subheadingName?: string | null
): Promise<FirestoreQuestion[]> {
  // Subheadings are scoped per-subject, but a Module spans multiple subjects, so we
  // group by the human-readable subheadingName (same approach the admin bank filter
  // uses) rather than subheadingId, which would only match within a single subject.
  const applySubheadingFilter = (list: FirestoreQuestion[]) =>
    subheadingName ? list.filter((item) => (item.subheadingName || "General / No subheading") === subheadingName) : list;

  try {
    const clauses = [
      where("block", "==", block),
      where("moduleId", "==", moduleId),
      where("status", "==", "published"),
    ];
    if (difficulty && difficulty !== "all") {
      clauses.push(where("difficulty", "==", difficulty));
    }

    const q = query(collection(db, "questions"), ...clauses);
    const snap = await getDocs(q);
    const fsResults = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FirestoreQuestion, "id">) }));

    const localQs = getLocalQuestions().filter((lq) => {
      if (lq.block !== block || lq.moduleId !== moduleId || lq.status !== "published") return false;
      if (difficulty && difficulty !== "all" && lq.difficulty !== difficulty) return false;
      return true;
    });

    const defResults = DEFAULT_QUESTIONS.filter((dq) => {
      if (dq.block !== block || dq.moduleId !== moduleId || dq.status !== "published") return false;
      if (difficulty && difficulty !== "all" && dq.difficulty !== difficulty) return false;
      return true;
    });

    const map = new Map<string, FirestoreQuestion>();
    defResults.forEach((dq) => map.set(dq.q.trim().toLowerCase(), dq));
    localQs.forEach((lq) => map.set(lq.q.trim().toLowerCase(), lq));
    fsResults.forEach((fq) => map.set(fq.q.trim().toLowerCase(), fq));

    const combined = applySubheadingFilter(Array.from(map.values()));
    if (combined.length > 0) return combined;
  } catch (err) {
    console.warn("Firestore fetchPublishedModuleExam failed, using default questions:", err);
  }

  return applySubheadingFilter(
    DEFAULT_QUESTIONS.filter((dq) => {
      if (dq.block !== block || dq.moduleId !== moduleId || dq.status !== "published") return false;
      if (difficulty && difficulty !== "all" && dq.difficulty !== difficulty) return false;
      return true;
    })
  );
}

/** One-time fetch of all published questions for an entire Block across all subjects */
export async function fetchPublishedBlockExam(
  block: number,
  difficulty?: Difficulty | "all"
): Promise<FirestoreQuestion[]> {
  try {
    const clauses = [
      where("block", "==", block),
      where("status", "==", "published"),
    ];
    if (difficulty && difficulty !== "all") {
      clauses.push(where("difficulty", "==", difficulty));
    }

    const q = query(collection(db, "questions"), ...clauses);
    const snap = await getDocs(q);
    const fsResults = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FirestoreQuestion, "id">) }));

    const localQs = getLocalQuestions().filter((lq) => {
      if (lq.block !== block || lq.status !== "published") return false;
      if (difficulty && difficulty !== "all" && lq.difficulty !== difficulty) return false;
      return true;
    });

    const defResults = DEFAULT_QUESTIONS.filter((dq) => {
      if (dq.block !== block || dq.status !== "published") return false;
      if (difficulty && difficulty !== "all" && dq.difficulty !== difficulty) return false;
      return true;
    });

    const map = new Map<string, FirestoreQuestion>();
    defResults.forEach((dq) => map.set(dq.q.trim().toLowerCase(), dq));
    localQs.forEach((lq) => map.set(lq.q.trim().toLowerCase(), lq));
    fsResults.forEach((fq) => map.set(fq.q.trim().toLowerCase(), fq));

    const combined = Array.from(map.values());
    if (combined.length > 0) return combined;
  } catch (err) {
    console.warn("Firestore fetchPublishedBlockExam failed, using default questions:", err);
  }

  return DEFAULT_QUESTIONS.filter((dq) => {
    if (dq.block !== block || dq.status !== "published") return false;
    if (difficulty && difficulty !== "all" && dq.difficulty !== difficulty) return false;
    return true;
  });
}

/** Live per-block published-question counts for a module */
export function subscribeModuleBlockCounts(subjectId: string, moduleId: string, cb: (counts: Record<number, number>) => void) {
  const q = query(
    collection(db, "questions"),
    where("subjectId", "==", subjectId),
    where("moduleId", "==", moduleId),
    where("status", "==", "published")
  );
  return onSnapshot(
    q,
    (snap) => {
      const counts: Record<number, number> = {};
      snap.docs.forEach((d) => {
        const block = (d.data() as FirestoreQuestion).block;
        counts[block] = (counts[block] || 0) + 1;
      });

      // Combine local questions
      getLocalQuestions().forEach((lq) => {
        if (lq.subjectId === subjectId && lq.moduleId === moduleId && lq.status === "published") {
          counts[lq.block] = (counts[lq.block] || 0) + 1;
        }
      });

      // Default fallback
      DEFAULT_QUESTIONS.forEach((dq) => {
        if (
          dq.subjectId === subjectId &&
          (dq.moduleId === moduleId || dq.moduleName.toLowerCase() === moduleId.toLowerCase()) &&
          dq.status === "published"
        ) {
          if (!counts[dq.block]) {
            counts[dq.block] = (counts[dq.block] || 0) + 1;
          }
        }
      });
      cb(counts);
    },
    (err) => {
      console.warn("Firestore block counts query fallback:", err.message);
      const counts: Record<number, number> = {};
      DEFAULT_QUESTIONS.forEach((dq) => {
        if (
          dq.subjectId === subjectId &&
          (dq.moduleId === moduleId || dq.moduleName.toLowerCase() === moduleId.toLowerCase()) &&
          dq.status === "published"
        ) {
          counts[dq.block] = (counts[dq.block] || 0) + 1;
        }
      });
      cb(counts);
    }
  );
}

export interface CurriculumCounts {
  blockCounts: Record<number, number>;
  moduleCounts: Record<string, number>; // key: `${block}-${moduleId}`
  subjectInModuleCounts: Record<string, number>; // key: `${block}-${moduleId}-${subjectId}`
  subjectTotalCounts: Record<string, number>; // key: subjectId
}

/** Live published-question counts across the entire curriculum hierarchy (Block -> Module -> Subject) */
export function subscribeCurriculumCounts(cb: (counts: CurriculumCounts) => void) {
  const q = query(collection(db, "questions"), where("status", "==", "published"));
  return onSnapshot(
    q,
    (snap) => {
      const blockCounts: Record<number, number> = {};
      const moduleCounts: Record<string, number> = {};
      const subjectInModuleCounts: Record<string, number> = {};
      const subjectTotalCounts: Record<string, number> = {};

      const processQuestion = (qItem: FirestoreQuestion) => {
        if (qItem.status !== "published") return;
        const b = qItem.block;
        const m = qItem.moduleId;
        const s = qItem.subjectId;

        if (b) blockCounts[b] = (blockCounts[b] || 0) + 1;
        if (b && m) moduleCounts[`${b}-${m}`] = (moduleCounts[`${b}-${m}`] || 0) + 1;
        if (b && m && s) subjectInModuleCounts[`${b}-${m}-${s}`] = (subjectInModuleCounts[`${b}-${m}-${s}`] || 0) + 1;
        if (s) subjectTotalCounts[s] = (subjectTotalCounts[s] || 0) + 1;
      };

      const map = new Map<string, FirestoreQuestion>();
      DEFAULT_QUESTIONS.forEach((dq) => map.set(dq.q.trim().toLowerCase(), dq));
      getLocalQuestions().forEach((lq) => map.set(lq.q.trim().toLowerCase(), lq));
      snap.docs.forEach((d) => {
        const item = { id: d.id, ...(d.data() as Omit<FirestoreQuestion, "id">) };
        map.set(item.q.trim().toLowerCase(), item);
      });

      Array.from(map.values()).forEach(processQuestion);

      cb({ blockCounts, moduleCounts, subjectInModuleCounts, subjectTotalCounts });
    },
    (err) => {
      console.warn("Firestore curriculum counts fallback:", err.message);
      const blockCounts: Record<number, number> = {};
      const moduleCounts: Record<string, number> = {};
      const subjectInModuleCounts: Record<string, number> = {};
      const subjectTotalCounts: Record<string, number> = {};

      const map = new Map<string, FirestoreQuestion>();
      DEFAULT_QUESTIONS.forEach((dq) => map.set(dq.q.trim().toLowerCase(), dq));
      getLocalQuestions().forEach((lq) => map.set(lq.q.trim().toLowerCase(), lq));

      Array.from(map.values()).forEach((qItem) => {
        if (qItem.status !== "published") return;
        const b = qItem.block;
        const m = qItem.moduleId;
        const s = qItem.subjectId;

        if (b) blockCounts[b] = (blockCounts[b] || 0) + 1;
        if (b && m) moduleCounts[`${b}-${m}`] = (moduleCounts[`${b}-${m}`] || 0) + 1;
        if (b && m && s) subjectInModuleCounts[`${b}-${m}-${s}`] = (subjectInModuleCounts[`${b}-${m}-${s}`] || 0) + 1;
        if (s) subjectTotalCounts[s] = (subjectTotalCounts[s] || 0) + 1;
      });

      cb({ blockCounts, moduleCounts, subjectInModuleCounts, subjectTotalCounts });
    }
  );
}
export async function searchGlobalQuestions(queryText: string): Promise<FirestoreQuestion[]> {
  try {
    const q = query(collection(db, "questions"), where("status", "==", "published"));
    const snap = await getDocs(q);
    const fsResults = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FirestoreQuestion, "id">) }));
    
    const localQs = getLocalQuestions().filter(lq => lq.status === "published");
    const defResults = DEFAULT_QUESTIONS.filter(dq => dq.status === "published");
    
    const map = new Map<string, FirestoreQuestion>();
    defResults.forEach(dq => map.set(dq.q.trim().toLowerCase(), dq));
    localQs.forEach(lq => map.set(lq.q.trim().toLowerCase(), lq));
    fsResults.forEach(fq => map.set(fq.q.trim().toLowerCase(), fq));
    
    const combined = Array.from(map.values());
    const lowerQuery = queryText.toLowerCase();
    
    return combined.filter(q => 
      q.q.toLowerCase().includes(lowerQuery) ||
      (q.explanation && q.explanation.toLowerCase().includes(lowerQuery)) ||
      q.options.some(opt => opt.toLowerCase().includes(lowerQuery))
    );
  } catch (err) {
    console.warn("Firestore searchGlobalQuestions failed:", err);
    return [];
  }
}
