import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  getDocs,
  getCountFromServer,
  setDoc,
  writeBatch,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "../firebase";
import { DEFAULT_MODULES, DEFAULT_QUESTIONS } from "../data/defaultCurriculum";
import { DEFAULT_BLOCK_DEFINITIONS, FREE_BLOCKS as DEFAULT_FREE_BLOCKS, type BlockDefinition } from "../data/subjects";
import type { Difficulty, FirestoreQuestion, ModuleDoc, QuestionStatus, SubheadingDoc, TopicDoc, UserProfile } from "../types";
import { cacheFirstFetch, cacheFirstSnapshot, cacheThenFetch, cachePurgePrefix, ONE_HOUR } from "../utils/localCache";

const LOCAL_MODULES_KEY = "modular_medico_custom_modules";
const LOCAL_BLOCKS_KEY = "modular_medico_custom_blocks";
const LOCAL_SUBHEADINGS_KEY = "modular_medico_subheadings";
const LOCAL_TOPICS_KEY = "modular_medico_topics";
const LOCAL_FREE_BLOCKS_KEY = "modular_medico_free_blocks";

/**
 * Which Blocks are free for everyone, stored in a single Firestore doc
 * (`settings/freeBlocks`) so an admin can toggle them at runtime from the
 * "Manage Access" tab instead of it being a hardcoded constant. Falls back to
 * the localStorage cache, then to the DEFAULT_FREE_BLOCKS constant, if
 * Firestore is unreachable or the doc doesn't exist yet.
 */
function getLocalFreeBlocks(): number[] | null {
  try {
    const raw = localStorage.getItem(LOCAL_FREE_BLOCKS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

function setLocalFreeBlocks(blocks: number[]) {
  try {
    localStorage.setItem(LOCAL_FREE_BLOCKS_KEY, JSON.stringify(blocks));
  } catch {
    // ignore
  }
}

/** Live view of which Blocks are currently free for everyone. */
export function subscribeFreeBlocks(cb: (blocks: number[]) => void) {
  const fallback = getLocalFreeBlocks() || DEFAULT_FREE_BLOCKS;
  const ref = doc(db, "settings", "freeBlocks");
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as { blocks?: number[] };
        const blocks = Array.isArray(data.blocks) ? data.blocks : fallback;
        setLocalFreeBlocks(blocks);
        cb(blocks);
      } else {
        cb(fallback);
      }
    },
    (err) => {
      console.warn("Firestore freeBlocks fallback:", err.message);
      cb(fallback);
    }
  );
}

/** Admin action: set the full list of Blocks that should be free for everyone. */
export async function saveFreeBlocks(blocks: number[]): Promise<void> {
  const cleaned = Array.from(new Set(blocks)).sort((a, b) => a - b);
  setLocalFreeBlocks(cleaned);
  await setDoc(doc(db, "settings", "freeBlocks"), { blocks: cleaned });
}

/* ---------------------------- Test Series gate --------------------------- */

/**
 * Whether Test Sessions ("Test Series") are open to students at all, stored
 * in a single Firestore doc (`settings/testSeriesAccess`) so an admin can
 * flip it at runtime from the "Manage Access" tab, right alongside the Block
 * unlock controls. Defaults to ON (true) so existing behavior is unchanged
 * until an admin turns it off. Falls back to the localStorage cache, then to
 * the default, if Firestore is unreachable or the doc doesn't exist yet.
 */
const LOCAL_TEST_SERIES_ACCESS_KEY = "modular_medico_test_series_access";

function getLocalTestSeriesAccess(): boolean | null {
  try {
    const raw = localStorage.getItem(LOCAL_TEST_SERIES_ACCESS_KEY);
    if (raw !== null) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

function setLocalTestSeriesAccess(enabled: boolean) {
  try {
    localStorage.setItem(LOCAL_TEST_SERIES_ACCESS_KEY, JSON.stringify(enabled));
  } catch {
    // ignore
  }
}

/** Live view of whether students can currently access Test Series. */
export function subscribeTestSeriesAccess(cb: (enabled: boolean) => void) {
  const fallback = getLocalTestSeriesAccess() ?? true;
  const ref = doc(db, "settings", "testSeriesAccess");
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as { enabled?: boolean };
        const enabled = typeof data.enabled === "boolean" ? data.enabled : fallback;
        setLocalTestSeriesAccess(enabled);
        cb(enabled);
      } else {
        cb(fallback);
      }
    },
    (err) => {
      console.warn("Firestore testSeriesAccess fallback:", err.message);
      cb(fallback);
    }
  );
}

/** Admin action: turn Test Series access on/off for every student at once. */
export async function saveTestSeriesAccess(enabled: boolean): Promise<void> {
  setLocalTestSeriesAccess(enabled);
  await setDoc(doc(db, "settings", "testSeriesAccess"), { enabled });
}

/* ------------------- Free subjects inside paid blocks ------------------- */

/**
 * Per-block list of subject ids that stay FREE even though the block itself is
 * paywalled. Stored in one Firestore doc (`settings/freeSubjects`) shaped as
 * `{ map: { "1": ["anatomy", "physiology"], "2": [...] } }`.
 * A block that is already fully free (freeBlocks) ignores this.
 */
export type FreeSubjectsMap = Record<number, string[]>;

const LOCAL_FREE_SUBJECTS_KEY = "modular_medico_free_subjects";

function normalizeFreeSubjects(raw: unknown): FreeSubjectsMap {
  const out: FreeSubjectsMap = {};
  if (raw && typeof raw === "object") {
    Object.entries(raw as Record<string, unknown>).forEach(([k, v]) => {
      const block = Number(k);
      if (Number.isFinite(block) && Array.isArray(v) && v.length) {
        out[block] = Array.from(new Set(v.map(String)));
      }
    });
  }
  return out;
}

function getLocalFreeSubjects(): FreeSubjectsMap {
  try {
    const raw = localStorage.getItem(LOCAL_FREE_SUBJECTS_KEY);
    if (raw) return normalizeFreeSubjects(JSON.parse(raw));
  } catch {
    // ignore
  }
  return {};
}

function setLocalFreeSubjects(map: FreeSubjectsMap) {
  try {
    localStorage.setItem(LOCAL_FREE_SUBJECTS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/** Live view of which subjects are free inside each (paid) block. */
export function subscribeFreeSubjects(cb: (map: FreeSubjectsMap) => void) {
  const fallback = getLocalFreeSubjects();
  return onSnapshot(
    doc(db, "settings", "freeSubjects"),
    (snap) => {
      if (snap.exists()) {
        const map = normalizeFreeSubjects((snap.data() as { map?: unknown }).map);
        setLocalFreeSubjects(map);
        cb(map);
      } else {
        cb(fallback);
      }
    },
    (err) => {
      console.warn("Firestore freeSubjects fallback:", err.message);
      cb(fallback);
    }
  );
}

/** Admin action: replace the free-subject list for ONE block (empty array = all paid). */
export async function saveBlockFreeSubjects(block: number, subjectIds: string[]): Promise<void> {
  const next = { ...getLocalFreeSubjects() };
  if (subjectIds.length) next[block] = Array.from(new Set(subjectIds));
  else delete next[block];
  setLocalFreeSubjects(next);
  // Firestore map keys must be strings.
  const asStrings: Record<string, string[]> = {};
  Object.entries(next).forEach(([k, v]) => (asStrings[k] = v));
  await setDoc(doc(db, "settings", "freeSubjects"), { map: asStrings });
}

/** True if this subject is free inside this block (used for gating + lock badges). */
export function isSubjectFree(map: FreeSubjectsMap, block: number, subjectId: string): boolean {
  return !!map[block]?.includes(subjectId);
}

/** True if the block has at least one free subject (so the block shows no lock). */
export function blockHasFreeSubject(map: FreeSubjectsMap, block: number): boolean {
  return (map[block]?.length ?? 0) > 0;
}

/**
 * Merge questions from the three sources (built-in defaults, locally-cached
 * drafts, and live Firestore results) into one deduplicated list.
 *
 * IMPORTANT: real questions (local + Firestore) are deduped by their unique
 * `id`, never by question text. Two different MCQs can legitimately share
 * (or nearly share) the same wording — e.g. two questions saved under
 * different subheadings — and deduping by text was collapsing all of them
 * down to a single surviving question, which is why only one subheading (or
 * far fewer MCQs than were actually saved) ever showed up.
 *
 * Only the built-in DEFAULT_QUESTIONS seed set is matched by text, since
 * that's the one case where the same seed question can also exist as a
 * Firestore/local doc (e.g. after being edited) and we want the saved
 * version to win rather than showing both.
 */
function mergeQuestionSources(
  defaults: FirestoreQuestion[],
  local: FirestoreQuestion[],
  firestore: FirestoreQuestion[]
): FirestoreQuestion[] {
  const byId = new Map<string, FirestoreQuestion>();
  const realTextKeys = new Set<string>();

  local.forEach((lq) => {
    byId.set(lq.id, lq);
    realTextKeys.add(lq.q.trim().toLowerCase());
  });
  firestore.forEach((fq) => {
    byId.set(fq.id, fq);
    realTextKeys.add(fq.q.trim().toLowerCase());
  });

  // Seed defaults only fill in where no real (saved) question already
  // covers that exact text — they never overwrite or get overwritten by
  // another default with the same id-less text key.
  const result: FirestoreQuestion[] = Array.from(byId.values());
  defaults.forEach((dq) => {
    if (!realTextKeys.has(dq.q.trim().toLowerCase()) && !byId.has(dq.id)) {
      result.push(dq);
      byId.set(dq.id, dq);
    }
  });

  return result;
}

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

  // Show the last-cached list immediately instead of waiting on the network,
  // so repeat visits don't sit on a "Loading modules…" spinner. The live
  // Firestore listener below still runs and refreshes this the moment it responds.
  if (local) cb(local);

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

  // Merge Firestore results with whatever's cached locally, deduped by id first
  // and then by name (case-insensitive) within this scope. Firestore alone isn't
  // enough: createSubheading() always writes to localStorage even when the
  // Firestore write also succeeds, and falls back to local-only if the write
  // fails (offline, transient error, etc). Showing only the Firestore snapshot
  // meant any subheading that only ever made it to localStorage — e.g. "Chapter
  // 9" created while offline — would vanish the moment Firestore returned any
  // results at all, e.g. once "Chapter 10" was saved successfully.
  const emit = (fsList: SubheadingDoc[]) => {
    const local = getLocalSubheadings(block, moduleId, subjectId);
    const byId = new Map<string, SubheadingDoc>();
    const nameKeys = new Set<string>();

    fsList.forEach((s) => {
      byId.set(s.id, s);
      nameKeys.add(s.name.trim().toLowerCase());
    });
    local.forEach((s) => {
      if (byId.has(s.id)) return;
      const nameKey = s.name.trim().toLowerCase();
      if (nameKeys.has(nameKey)) return; // same subheading already present from Firestore under a different id
      byId.set(s.id, s);
      nameKeys.add(nameKey);
    });

    const merged = Array.from(byId.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    setLocalSubheadings(block, moduleId, subjectId, merged);
    cb(merged);
  };

  const q = query(
    collection(db, "subheadings"),
    where("block", "==", block),
    where("moduleId", "==", moduleId),
    where("subjectId", "==", subjectId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const fsList = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubheadingDoc, "id">) }));
      emit(fsList);
    },
    (err) => {
      console.warn("Firestore subheadings query fallback to local:", err.message);
      emit([]);
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

/* ----------------------------- Topics ------------------------------ */
/*
 * Topics are the MCQ-Practice-side 4th tier of the content hierarchy:
 *   Block -> Module -> Subject -> Topic
 * They are deliberately a SEPARATE Firestore collection ("topics") from the
 * `subheadings` collection Lectures use — even though both are scoped to the
 * exact same (block, moduleId, subjectId) triple — so the two lists never
 * overlap. Adding/renaming/removing a Topic while tagging an MCQ never
 * touches a Lecture's Subheading, and vice versa. Otherwise identical
 * Firestore-with-localStorage-fallback pattern to Subheadings above.
 */

function topicsLocalKey(block: number, moduleId: string, subjectId: string) {
  return `${LOCAL_TOPICS_KEY}__${block}__${moduleId}__${subjectId}`;
}

function getLocalTopics(block: number, moduleId: string, subjectId: string): TopicDoc[] {
  try {
    const raw = localStorage.getItem(topicsLocalKey(block, moduleId, subjectId));
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function setLocalTopics(block: number, moduleId: string, subjectId: string, list: TopicDoc[]) {
  try {
    localStorage.setItem(topicsLocalKey(block, moduleId, subjectId), JSON.stringify(list));
  } catch {
    // ignore
  }
}

/** Live topics scoped to one Block + Module + Subject combination. */
export function subscribeTopics(
  block: number,
  moduleId: string,
  subjectId: string,
  cb: (topics: TopicDoc[]) => void
) {
  if (!moduleId || !subjectId) {
    cb([]);
    return () => {};
  }

  const emit = (fsList: TopicDoc[]) => {
    const local = getLocalTopics(block, moduleId, subjectId);
    const byId = new Map<string, TopicDoc>();
    const nameKeys = new Set<string>();

    fsList.forEach((s) => {
      byId.set(s.id, s);
      nameKeys.add(s.name.trim().toLowerCase());
    });
    local.forEach((s) => {
      if (byId.has(s.id)) return;
      const nameKey = s.name.trim().toLowerCase();
      if (nameKeys.has(nameKey)) return;
      byId.set(s.id, s);
      nameKeys.add(nameKey);
    });

    const merged = Array.from(byId.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    setLocalTopics(block, moduleId, subjectId, merged);
    cb(merged);
  };

  const q = query(
    collection(db, "topics"),
    where("block", "==", block),
    where("moduleId", "==", moduleId),
    where("subjectId", "==", subjectId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const fsList = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TopicDoc, "id">) }));
      emit(fsList);
    },
    (err) => {
      console.warn("Firestore topics query fallback to local:", err.message);
      emit([]);
    }
  );
}

/** Create a new Topic under a specific Block -> Module -> Subject. */
export async function createTopic(block: number, moduleId: string, subjectId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const current = getLocalTopics(block, moduleId, subjectId);

  const existing = current.find((s) => s.name.trim().toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing.id;

  const docData = { block, moduleId, subjectId, name: trimmed, order: current.length };
  let id = "";
  try {
    const ref = await addDoc(collection(db, "topics"), docData);
    id = ref.id;
  } catch (err) {
    console.warn("Firestore createTopic failed, saving locally:", err);
    id = `local-tp-${Date.now()}-${Math.round(Math.random() * 1000)}`;
  }
  setLocalTopics(block, moduleId, subjectId, [...current, { id, ...docData }]);
  return id;
}

/** Rename an existing Topic. */
export async function renameTopic(
  block: number,
  moduleId: string,
  subjectId: string,
  topicId: string,
  name: string
) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const current = getLocalTopics(block, moduleId, subjectId);
  setLocalTopics(
    block,
    moduleId,
    subjectId,
    current.map((s) => (s.id === topicId ? { ...s, name: trimmed } : s))
  );
  try {
    await updateDoc(doc(db, "topics", topicId), { name: trimmed });
  } catch (err) {
    console.warn("Firestore renameTopic failed, local storage updated:", err);
  }
}

/** Delete a Topic. Questions already tagged with it keep their tag as free text. */
export async function deleteTopic(block: number, moduleId: string, subjectId: string, topicId: string) {
  const current = getLocalTopics(block, moduleId, subjectId);
  setLocalTopics(
    block,
    moduleId,
    subjectId,
    current.filter((s) => s.id !== topicId)
  );
  try {
    await deleteDoc(doc(db, "topics", topicId));
  } catch (err) {
    console.warn("Firestore deleteTopic failed:", err);
  }
}

/* --------------------------- Questions ---------------------------- */

export interface QuestionInput {
  subjectId: string;
  moduleId: string;
  moduleName: string;
  block: number;
  topicId?: string | null;
  topicName?: string | null;
  difficulty: Difficulty;
  q: string;
  options: string[];
  correct: number;
  explanation: string;
  status?: QuestionStatus;
}

/**
 * Result of a successful save — MCQ(s) are confirmed written to Firestore,
 * where they're visible in Manage MCQs & Bank, to other admins, and to
 * students.
 *
 * Saves are no longer silently cached in localStorage when the Firestore
 * write fails. A failed write throws a `QuestionSaveError` instead (see
 * below) so the failure is impossible to miss — previously a rejected write
 * would fall back to localStorage and report "success", which meant MCQs
 * that never reached the database still appeared to save fine in the admin's
 * own browser.
 */
export type SaveResult = { source: "firestore" };

export type SaveErrorReason = "permission-denied" | "offline" | "unknown";

/**
 * Thrown when a question fails to save to Firestore. Carries a `reason` and a
 * ready-to-display `message` so the UI can show the admin exactly what went
 * wrong and how to fix it, instead of silently caching the MCQ locally.
 *
 * `reason: "permission-denied"` specifically means the signed-in account does
 * not carry the real `admin` custom claim that Firestore rules require (see
 * scripts/setAdminClaim.mjs) — the in-app "Enter Admin" screen only gates the
 * UI, it can't grant that claim. This is by far the most common cause: the
 * admin password gets someone into the panel, but their Firebase account was
 * never actually granted admin rights server-side, so every write is rejected.
 */
export class QuestionSaveError extends Error {
  reason: SaveErrorReason;
  constructor(reason: SaveErrorReason, message: string) {
    super(message);
    this.name = "QuestionSaveError";
    this.reason = reason;
  }
}

function classifyWriteError(err: unknown): SaveErrorReason {
  const code = (err as { code?: string } | null)?.code;
  if (code === "permission-denied") return "permission-denied";
  if (code === "unavailable" || (typeof navigator !== "undefined" && !navigator.onLine)) return "offline";
  return "unknown";
}

function messageForReason(reason: SaveErrorReason, plural: boolean): string {
  const these = plural ? "These" : "This";
  const werent = plural ? "weren't" : "wasn't";
  if (reason === "permission-denied") {
    return (
      `${these} MCQ${plural ? "s" : ""} ${werent} saved. Your signed-in account isn't a real Firestore admin ` +
      `— the admin panel password only unlocks this screen, it doesn't grant database write access. ` +
      `Ask whoever manages the project to run "node scripts/setAdminClaim.mjs your@email.com", then log out ` +
      `and back in on that account.`
    );
  }
  if (reason === "offline") {
    return `${these} MCQ${plural ? "s" : ""} ${werent} saved — you appear to be offline. Reconnect and try again.`;
  }
  return `${these} MCQ${plural ? "s" : ""} ${werent} saved — Firestore rejected the write for an unknown reason. Please try again.`;
}

export async function addQuestion(input: QuestionInput): Promise<SaveResult> {
  const cleanInput = {
    ...input,
    status: input.status ?? "draft",
    createdAt: Date.now(),
  };
  try {
    await addDoc(collection(db, "questions"), cleanInput);
    return { source: "firestore" };
  } catch (err) {
    console.error("Firestore addQuestion failed:", err);
    const reason = classifyWriteError(err);
    throw new QuestionSaveError(reason, messageForReason(reason, false));
  }
}

/**
 * Update an existing MCQ in place (question text, options, correct answer,
 * explanation, difficulty, and/or its Block/Module/Subject/Topic tagging).
 * Mirrors addQuestion's error handling: a failed write throws a
 * QuestionSaveError with a ready-to-display message rather than silently
 * caching the edit locally, so a rejected edit is never mistaken for success.
 */
export async function updateQuestion(id: string, input: QuestionInput): Promise<SaveResult> {
  const cleanInput = {
    ...input,
    status: input.status ?? "draft",
  };
  try {
    await updateDoc(doc(db, "questions", id), cleanInput);
    return { source: "firestore" };
  } catch (err) {
    console.error("Firestore updateQuestion failed:", err);
    const reason = classifyWriteError(err);
    throw new QuestionSaveError(reason, messageForReason(reason, false));
  }
}

export async function bulkAddQuestions(inputs: QuestionInput[]): Promise<SaveResult> {
  try {
    const batch = writeBatch(db);
    inputs.forEach((input) => {
      const ref = doc(collection(db, "questions"));
      batch.set(ref, { ...input, status: input.status ?? "draft", createdAt: Date.now() });
    });
    await batch.commit();
    return { source: "firestore" };
  } catch (err) {
    console.error("Firestore bulkAddQuestions failed:", err);
    const reason = classifyWriteError(err);
    throw new QuestionSaveError(reason, messageForReason(reason, true));
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

function markQuestionDeleted(id: string) {
  try {
    const current = getDeletedQuestionIds();
    current.add(id.toLowerCase().trim());
    localStorage.setItem(LOCAL_DELETED_QS_KEY, JSON.stringify(Array.from(current)));
  } catch {
    // ignore
  }
}

/**
 * Deletes a question by id.
 *
 * IMPORTANT: the local "deleted" blacklist (LOCAL_DELETED_QS_KEY) must only ever be
 * written when the real Firestore delete FAILS. It exists purely as a stop-gap so a
 * doc that couldn't actually be removed from Firestore (e.g. permission-denied,
 * offline) still disappears from this browser's view. If we mark it unconditionally
 * — including on a successful delete — the id (or worse, the question's own text)
 * sits in localStorage forever. Firestore auto-ids are never reused, so blacklisting
 * by id after a successful delete does nothing useful; blacklisting by TEXT actively
 * hides any *future* question saved with the same/similar wording, which is exactly
 * what was silently swallowing re-imported MCQs on this device (counts stayed correct
 * because subscribeCurriculumCounts never consulted this blacklist, only the module
 * list did). We now only blacklist on failure, and only ever by id.
 */
export async function deleteQuestion(id: string, qText?: string) {
  // Update local storage cache (locally-saved drafts only — these have no Firestore
  // doc, so removing them here is safe and permanent regardless of the write below).
  const localQuestions: FirestoreQuestion[] = JSON.parse(localStorage.getItem("modular_medico_local_qs") || "[]");
  const filtered = localQuestions.filter((q) => q.id !== id && (qText ? q.q.trim().toLowerCase() !== qText.trim().toLowerCase() : true));
  localStorage.setItem("modular_medico_local_qs", JSON.stringify(filtered));

  try {
    await deleteDoc(doc(db, "questions", id));
  } catch (err) {
    console.warn("Firestore deleteQuestion failed, hiding locally instead:", err);
    if (id) markQuestionDeleted(id);
  }
}

/**
 * Delete many questions at once (e.g. every MCQ under a topic). Mirrors deleteQuestion
 * but batches the Firestore writes and updates local storage a single time at the end,
 * which matters once a topic has dozens of MCQs.
 */
export async function bulkDeleteQuestions(items: { id: string; q: string }[]) {
  if (items.length === 0) return;

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
    console.warn("Firestore bulkDeleteQuestions batch failed, hiding locally instead:", err);
    // Only blacklist by id, and only because the real delete didn't go through —
    // see the comment on deleteQuestion() for why this must never happen on success
    // or match by question text.
    items.forEach((item) => {
      if (item.id) markQuestionDeleted(item.id);
    });
  }
}

function getLocalQuestions(): FirestoreQuestion[] {
  try {
    const deleted = getDeletedQuestionIds();
    const list: FirestoreQuestion[] = JSON.parse(localStorage.getItem("modular_medico_local_qs") || "[]");
    return list.filter((q) => !deleted.has(q.id.toLowerCase().trim()));
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
      const fsQuestions = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<FirestoreQuestion, "id">) }))
        .filter((fq) => !deleted.has(fq.id.toLowerCase().trim()));
      const defQuestions = DEFAULT_QUESTIONS.filter(
        (dq) => dq.subjectId === subjectId && !deleted.has(dq.id.toLowerCase().trim())
      );
      const localQs = getLocalQuestions().filter(
        (lq) => lq.subjectId === subjectId && !deleted.has(lq.id.toLowerCase().trim())
      );

      cb(mergeQuestionSources(defQuestions, localQs, fsQuestions));
    },
    (err) => {
      console.warn("Firestore subject questions fallback:", err.message);
      const defQuestions = DEFAULT_QUESTIONS.filter(
        (dq) => dq.subjectId === subjectId && !deleted.has(dq.id.toLowerCase().trim())
      );
      const localQs = getLocalQuestions().filter(
        (lq) => lq.subjectId === subjectId && !deleted.has(lq.id.toLowerCase().trim())
      );
      cb(mergeQuestionSources(defQuestions, localQs, []));
    }
  );
}

/**
 * Live view of every question in the bank (all statuses). This is an unconstrained
 * query, so Firestore rules require the caller to be a real admin (custom claim) —
 * a signed-in user without that claim gets permission-denied for the *entire*
 * listing, even for their own published questions. When that happens we still fall
 * back to local + default questions so the screen isn't blank, but we also report
 * the failure via `onError` so the UI can tell the admin their view is incomplete
 * rather than silently showing 0 results as if the bank were actually empty.
 */
export function subscribeAllQuestions(
  cb: (questions: FirestoreQuestion[]) => void,
  onError?: (reason: "permission-denied" | "offline" | "unknown", message: string) => void
) {
  return onSnapshot(
    collection(db, "questions"),
    (snap) => {
      const deleted = getDeletedQuestionIds();
      const fsQuestions = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<FirestoreQuestion, "id">) }))
        .filter((fq) => !deleted.has(fq.id.toLowerCase().trim()));
      const localQs = getLocalQuestions().filter(
        (lq) => !deleted.has(lq.id.toLowerCase().trim())
      );
      const defQuestions = DEFAULT_QUESTIONS.filter(
        (dq) => !deleted.has(dq.id.toLowerCase().trim())
      );

      cb(mergeQuestionSources(defQuestions, localQs, fsQuestions));
    },
    (err) => {
      console.warn("Firestore all questions fallback:", err.message);
      const deleted = getDeletedQuestionIds();
      const localQs = getLocalQuestions().filter(
        (lq) => !deleted.has(lq.id.toLowerCase().trim())
      );
      const defQuestions = DEFAULT_QUESTIONS.filter(
        (dq) => !deleted.has(dq.id.toLowerCase().trim())
      );
      cb(mergeQuestionSources(defQuestions, localQs, []));

      const reason = classifyWriteError(err);
      onError?.(
        reason,
        reason === "permission-denied"
          ? "Your account isn't a real Firestore admin yet, so the bank can't be listed — you're only seeing MCQs cached in this browser. Run scripts/setAdminClaim.mjs to fix this."
          : reason === "offline"
          ? "You appear to be offline — only locally cached MCQs are shown."
          : "Couldn't load the full MCQ bank from Firestore — only locally cached MCQs are shown."
      );
    }
  );
}

/**
 * Live view of questions SCOPED to one Block + Module + Subject (all statuses,
 * for the admin Manage MCQs screen). This is the scoped counterpart to
 * subscribeAllQuestions(): instead of listening to the *entire* `questions`
 * collection (every block, every module, every subject, published + draft —
 * an unbounded listener that only gets heavier as the bank grows, and whose
 * huge initial payload is what made the Manage MCQs list intermittently fail
 * to render or come back incomplete), this only asks Firestore for the slice
 * the admin is actually looking at. All three clauses are plain equality
 * filters, so — unlike range/orderBy combinations — Firestore can serve this
 * from the automatic single-field indexes without needing a new composite
 * index entry.
 */
export function subscribeScopedQuestions(
  subjectId: string,
  moduleId: string,
  block: number,
  cb: (questions: FirestoreQuestion[]) => void,
  onError?: (reason: "permission-denied" | "offline" | "unknown", message: string) => void
) {
  const deleted = getDeletedQuestionIds();
  const q = query(
    collection(db, "questions"),
    where("subjectId", "==", subjectId),
    where("moduleId", "==", moduleId),
    where("block", "==", block)
  );
  return onSnapshot(
    q,
    (snap) => {
      const fsQuestions = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<FirestoreQuestion, "id">) }))
        .filter((fq) => !deleted.has(fq.id.toLowerCase().trim()));
      const localQs = getLocalQuestions().filter(
        (lq) => lq.subjectId === subjectId && lq.moduleId === moduleId && lq.block === block
      );
      const defQuestions = DEFAULT_QUESTIONS.filter(
        (dq) => dq.subjectId === subjectId && dq.moduleId === moduleId && dq.block === block
      );
      cb(mergeQuestionSources(defQuestions, localQs, fsQuestions));
    },
    (err) => {
      console.warn("Firestore scoped questions fallback:", err.message);
      const localQs = getLocalQuestions().filter(
        (lq) => lq.subjectId === subjectId && lq.moduleId === moduleId && lq.block === block
      );
      const defQuestions = DEFAULT_QUESTIONS.filter(
        (dq) => dq.subjectId === subjectId && dq.moduleId === moduleId && dq.block === block
      );
      cb(mergeQuestionSources(defQuestions, localQs, []));

      const reason = classifyWriteError(err);
      onError?.(
        reason,
        reason === "permission-denied"
          ? "Your account isn't a real Firestore admin yet, so this slice can't be listed — you're only seeing MCQs cached in this browser. Run scripts/setAdminClaim.mjs to fix this."
          : reason === "offline"
          ? "You appear to be offline — only locally cached MCQs are shown."
          : "Couldn't load this slice of the MCQ bank from Firestore — only locally cached MCQs are shown."
      );
    }
  );
}

/**
 * Live view of PUBLISHED questions scoped to a Block + Module (optionally narrowed
 * to one Subject), used by the Test Sessions "Add MCQs" builder.
 *
 * This deliberately mirrors subscribeScopedQuestions() above rather than going
 * through fetchPublishedBlock()/fetchPublishedModuleExam(): those two are wrapped
 * in cacheFirstFetch() with a 1-hour TTL, which is the right tradeoff for a student's
 * practice session (instant repeat loads) but the wrong one here — an admin publishing
 * MCQs and immediately trying to add them to a test would keep seeing a stale "0
 * available" result for up to an hour, since a fresh-within-TTL cache entry is
 * returned as-is with no background refresh. A live onSnapshot listener has no such
 * staleness window: it reflects Firestore the moment a question's status flips to
 * "published", exactly like the Manage MCQs screen does.
 */
export function subscribePublishedModuleQuestions(
  block: number,
  moduleId: string,
  subjectId: string | null,
  cb: (questions: FirestoreQuestion[]) => void,
  onError?: (reason: "permission-denied" | "offline" | "unknown", message: string) => void
) {
  const deleted = getDeletedQuestionIds();
  const clauses: QueryConstraint[] = [
    where("moduleId", "==", moduleId),
    where("block", "==", block),
    where("status", "==", "published"),
  ];
  if (subjectId) clauses.push(where("subjectId", "==", subjectId));
  const q = query(collection(db, "questions"), ...clauses);

  const inScope = (fq: FirestoreQuestion) =>
    fq.moduleId === moduleId && fq.block === block && fq.status === "published" && (!subjectId || fq.subjectId === subjectId);

  return onSnapshot(
    q,
    (snap) => {
      const fsQuestions = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<FirestoreQuestion, "id">) }))
        .filter((fq) => !deleted.has(fq.id.toLowerCase().trim()));
      const localQs = getLocalQuestions().filter((lq) => lq.status === "published" && inScope(lq));
      const defQuestions = DEFAULT_QUESTIONS.filter((dq) => dq.status === "published" && inScope(dq));
      cb(mergeQuestionSources(defQuestions, localQs, fsQuestions));
    },
    (err) => {
      console.warn("Firestore published-questions fallback:", err.message);
      const localQs = getLocalQuestions().filter((lq) => lq.status === "published" && inScope(lq));
      const defQuestions = DEFAULT_QUESTIONS.filter((dq) => dq.status === "published" && inScope(dq));
      cb(mergeQuestionSources(defQuestions, localQs, []));

      const reason = classifyWriteError(err);
      onError?.(
        reason,
        reason === "permission-denied"
          ? "Your account isn't a real Firestore admin yet, so published MCQs can't be listed — you're only seeing MCQs cached in this browser. Run scripts/setAdminClaim.mjs to fix this."
          : reason === "offline"
          ? "You appear to be offline — only locally cached MCQs are shown."
          : "Couldn't load published MCQs from Firestore — only locally cached MCQs are shown."
      );
    }
  );
}

// ---------------------------------------------------------------------------
// Practice-session fetchers.
//
// Speed notes (this is the path behind "Loading MCQs…"):
//  - One download per *scope* (subject+module+block, module, or block). Difficulty and
//    topic are applied client-side on that cached list, so picking a topic or difficulty
//    never triggers another multi-second Firestore round trip.
//  - Concurrent callers (PracticeSetup fires several on mount) share one request, and
//    cacheFirstFetch serves stale data instantly while refreshing in the background.
//  - If the live "all published questions" listener (Subjects screens) has already
//    downloaded the bank this session, the scope is sliced from memory: zero network.
//  - Firestore failures are never cached (the old code cached the offline fallback for an hour).
// ---------------------------------------------------------------------------

/** Raw published docs from the last server-confirmed snapshot of the whole bank. */
let liveBank: FirestoreQuestion[] | null = null;
let liveBankAt = 0;
const LIVE_BANK_MAX_AGE = 15 * 60 * 1000;

function liveBankIfFresh(): FirestoreQuestion[] | null {
  return liveBank && Date.now() - liveBankAt < LIVE_BANK_MAX_AGE ? liveBank : null;
}

// Old per-topic/per-difficulty cache entries are orphaned by the scope-level keys below;
// clear them once so they stop eating localStorage quota.
cachePurgePrefix(["pubBlock_", "pubModuleExam_", "pubBlockExam_"]);

async function fetchScopedBase(
  cacheKey: string,
  clauses: QueryConstraint[],
  inScope: (q: FirestoreQuestion) => boolean,
  defaultInScope: (q: FirestoreQuestion) => boolean
): Promise<FirestoreQuestion[]> {
  return cacheFirstFetch(
    cacheKey,
    async () => {
      const bank = liveBankIfFresh();
      let fsResults: FirestoreQuestion[];
      if (bank) {
        fsResults = bank.filter(inScope);
      } else {
        const snap = await getDocs(query(collection(db, "questions"), ...clauses));
        fsResults = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FirestoreQuestion, "id">) }));
      }
      const localQs = getLocalQuestions().filter((lq) => lq.status === "published" && inScope(lq));
      const defResults = DEFAULT_QUESTIONS.filter((dq) => dq.status === "published" && defaultInScope(dq));
      return mergeQuestionSources(defResults, localQs, fsResults);
    },
    ONE_HOUR
  );
}

const byDifficulty = (list: FirestoreQuestion[], difficulty?: Difficulty | "all") =>
  difficulty && difficulty !== "all" ? list.filter((q) => q.difficulty === difficulty) : list;

const isRealModule = (moduleId?: string) => !!moduleId && moduleId !== "all" && moduleId !== "custom";

/** One-time fetch of published questions for a practice session (cached for a fast repeat load). */
export async function fetchPublishedBlock(
  subjectId: string,
  moduleId?: string,
  block?: number,
  difficulty?: Difficulty | "all",
  topicId?: string | null,
  topicName?: string | null
): Promise<FirestoreQuestion[]> {
  // Prefer matching by name when we have one — it's immune to id drift between
  // Firestore and locally-cached topic docs (see subscribeTopics),
  // which was previously causing some topics' questions to never match.
  // Also falls back to the legacy `subheadingName`/`subheadingId` fields so
  // older questions saved before MCQ topics had their own collection (back
  // when this tier was called "Subheading") still match correctly.
  const applyTopicFilter = (list: FirestoreQuestion[]) => {
    if (topicName) {
      return list.filter(
        (item) =>
          (item.topicName || "").trim() === topicName.trim() ||
          (item.subheadingName || "").trim() === topicName.trim()
      );
    }
    if (topicId) return list.filter((item) => item.topicId === topicId || item.subheadingId === topicId);
    return list;
  };

  const withModule = isRealModule(moduleId);
  const withBlock = !!block && block > 0;
  const fsScope = (q: FirestoreQuestion) =>
    q.subjectId === subjectId && (!withModule || q.moduleId === moduleId) && (!withBlock || q.block === block);
  const defScope = (q: FirestoreQuestion) =>
    q.subjectId === subjectId &&
    (!withModule || q.moduleId === moduleId || q.moduleName.toLowerCase() === moduleId!.toLowerCase()) &&
    (!withBlock || q.block === block);

  try {
    const clauses: QueryConstraint[] = [where("subjectId", "==", subjectId), where("status", "==", "published")];
    if (withModule) clauses.push(where("moduleId", "==", moduleId));
    if (withBlock) clauses.push(where("block", "==", block));

    const base = await fetchScopedBase(
      `pubBlockBase_${subjectId}_${withModule ? moduleId : ""}_${withBlock ? block : ""}`,
      clauses,
      fsScope,
      defScope
    );
    const combined = applyTopicFilter(byDifficulty(base, difficulty));
    if (combined.length > 0) return combined;
  } catch (err) {
    console.warn("Firestore fetchPublishedBlock failed, using default questions:", err);
  }

  // Fallback to local default questions
  return applyTopicFilter(
    byDifficulty(
      DEFAULT_QUESTIONS.filter((dq) => dq.status === "published" && defScope(dq)),
      difficulty
    )
  );
}

/** One-time fetch of all published questions for a specific Module across all subjects (cached for a fast repeat load). */
export async function fetchPublishedModuleExam(
  block: number,
  moduleId: string,
  difficulty?: Difficulty | "all",
  topicName?: string | null,
  subjectId?: string | null
): Promise<FirestoreQuestion[]> {
  // Topics are scoped per (block, moduleId, subjectId) — a Module spans multiple
  // subjects, and two different subjects can legitimately each have a topic named
  // e.g. "Introduction". Matching by name alone would silently merge those into one
  // filter option and mix both subjects' questions together. So the module-wide picker
  // must always disambiguate by subjectId + topicName together, never name alone.
  const applyTopicFilter = (list: FirestoreQuestion[]) => {
    if (!topicName) return list;
    return list.filter((item) => {
      const name = item.topicName || item.subheadingName || "General / No topic";
      if (name !== topicName) return false;
      // subjectId is optional for backwards compatibility, but should always be passed
      // by callers going forward — see PracticeSetup.tsx.
      if (subjectId) return item.subjectId === subjectId;
      return true;
    });
  };

  const scope = (q: FirestoreQuestion) => q.block === block && q.moduleId === moduleId;

  try {
    const base = await fetchScopedBase(
      `pubModuleExamBase_${block}_${moduleId}`,
      [where("block", "==", block), where("moduleId", "==", moduleId), where("status", "==", "published")],
      scope,
      scope
    );
    const combined = applyTopicFilter(byDifficulty(base, difficulty));
    if (combined.length > 0) return combined;
  } catch (err) {
    console.warn("Firestore fetchPublishedModuleExam failed, using default questions:", err);
  }

  return applyTopicFilter(
    byDifficulty(
      DEFAULT_QUESTIONS.filter((dq) => dq.status === "published" && scope(dq)),
      difficulty
    )
  );
}

/** One-time fetch of all published questions for an entire Block across all subjects (cached for a fast repeat load). */
export async function fetchPublishedBlockExam(
  block: number,
  difficulty?: Difficulty | "all"
): Promise<FirestoreQuestion[]> {
  const scope = (q: FirestoreQuestion) => q.block === block;

  try {
    const base = await fetchScopedBase(
      `pubBlockExamBase_${block}`,
      [where("block", "==", block), where("status", "==", "published")],
      scope,
      scope
    );
    const combined = byDifficulty(base, difficulty);
    if (combined.length > 0) return combined;
  } catch (err) {
    console.warn("Firestore fetchPublishedBlockExam failed, using default questions:", err);
  }

  return byDifficulty(
    DEFAULT_QUESTIONS.filter((dq) => dq.status === "published" && scope(dq)),
    difficulty
  );
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

/**
 * Live view of every *published* question across the whole curriculum.
 *
 * Unlike subscribeAllQuestions() (admin-only bank listing), this is safe for
 * regular students/guests to call: the Firestore query itself is scoped with
 * where("status","==","published"), which satisfies the security rule
 * (`resource.data.status == 'published' || isAdmin()`) for every document it
 * can possibly return. subscribeAllQuestions() has no such filter, so
 * Firestore denies that *entire* unfiltered listing for any non-admin the
 * moment a single draft exists anywhere in the collection — which is exactly
 * why student-facing pages must not use it to build their module/subject
 * breakdowns (only the admin Manage MCQs & Bank screen should).
 */
export function subscribePublishedQuestions(cb: (questions: FirestoreQuestion[]) => void) {
  // This scans the entire published question bank, which is by far the slowest
  // query in the app — it's what makes "Loading modules…" take a while the first
  // time. cacheFirstSnapshot shows whatever was cached from the last visit
  // instantly, then swaps in the live result (and refreshes the cache) once
  // Firestore responds, so only the very first-ever load pays the full wait.
  return cacheFirstSnapshot(
    "publishedQuestions",
    (innerCb) => {
      const q = query(collection(db, "questions"), where("status", "==", "published"));
      return onSnapshot(
        q,
        (snap) => {
          const deleted = getDeletedQuestionIds();
          const rawQuestions = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FirestoreQuestion, "id">) }));
          // Let the practice fetchers reuse this download instead of querying Firestore again.
          if (!snap.metadata.fromCache) {
            liveBank = rawQuestions;
            liveBankAt = Date.now();
          }
          const fsQuestions = rawQuestions.filter((fq) => !deleted.has(fq.id.toLowerCase().trim()));
          const localQs = getLocalQuestions().filter(
            (lq) => lq.status === "published" && !deleted.has(lq.id.toLowerCase().trim())
          );
          const defQuestions = DEFAULT_QUESTIONS.filter(
            (dq) => dq.status === "published" && !deleted.has(dq.id.toLowerCase().trim())
          );

          innerCb(mergeQuestionSources(defQuestions, localQs, fsQuestions));
        },
        (err) => {
          console.warn("Firestore published questions fallback:", err.message);
          const deleted = getDeletedQuestionIds();
          const localQs = getLocalQuestions().filter(
            (lq) => lq.status === "published" && !deleted.has(lq.id.toLowerCase().trim())
          );
          const defQuestions = DEFAULT_QUESTIONS.filter(
            (dq) => dq.status === "published" && !deleted.has(dq.id.toLowerCase().trim())
          );
          innerCb(mergeQuestionSources(defQuestions, localQs, []));
        }
      );
    },
    cb,
    undefined,
    // The Subjects/SubjectDetail views only group by block/module/subject, so persist just
    // those fields. Caching full question text + explanations for the whole bank blew past
    // the localStorage quota, which silently disabled this cache.
    (qs) =>
      qs.map((q) => ({
        id: q.id,
        subjectId: q.subjectId,
        moduleId: q.moduleId,
        moduleName: q.moduleName,
        block: q.block,
        difficulty: q.difficulty,
        status: q.status,
        q: "",
        options: [],
        correct: 0,
        explanation: "",
      }))
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
  return cacheFirstSnapshot("curriculumCounts", (innerCb) => subscribeCurriculumCountsLive(innerCb), cb);
}

function subscribeCurriculumCountsLive(cb: (counts: CurriculumCounts) => void) {
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

      // Apply the same locally-hidden-id filter as subscribePublishedQuestions so the
      // "X Questions" badges can never disagree with the module list built from it.
      const deleted = getDeletedQuestionIds();
      const fsQuestions = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<FirestoreQuestion, "id">) }))
        .filter((fq) => !deleted.has(fq.id.toLowerCase().trim()));
      const merged = mergeQuestionSources(DEFAULT_QUESTIONS, getLocalQuestions(), fsQuestions);

      merged.forEach(processQuestion);

      cb({ blockCounts, moduleCounts, subjectInModuleCounts, subjectTotalCounts });
    },
    (err) => {
      console.warn("Firestore curriculum counts fallback:", err.message);
      const blockCounts: Record<number, number> = {};
      const moduleCounts: Record<string, number> = {};
      const subjectInModuleCounts: Record<string, number> = {};
      const subjectTotalCounts: Record<string, number> = {};

      const merged = mergeQuestionSources(DEFAULT_QUESTIONS, getLocalQuestions(), []);

      merged.forEach((qItem) => {
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
// ---------------------------------------------------------------------------
// Lightweight homepage index (Practice Library).
//
// The Practice Library used to download the ENTIRE published bank twice (once for the module
// list, once for the counts) just to draw a few numbers. These helpers keep the first paint
// tiny and only pull real question documents for the one block the student is looking at:
//  - subscribeBlockCounts / subscribeSubjectCounts: Firestore count() aggregations. They
//    return just a number per block/subject — no question documents are downloaded at all.
//  - subscribeBlockOutline: the module -> subject breakdown for ONE block, loaded when that
//    block is selected. Only a slim outline (ids, names, counts) is cached, so it never
//    threatens the localStorage quota.
// The full MCQs are still only fetched when a module/subject is opened (fetchPublished*).
// All three show the last cached value instantly, then refresh it in the background.
// ---------------------------------------------------------------------------

async function countPublished(...clauses: QueryConstraint[]): Promise<number> {
  const q = query(collection(db, "questions"), where("status", "==", "published"), ...clauses);
  try {
    const snap = await getCountFromServer(q);
    return snap.data().count;
  } catch (err) {
    // Aggregation unavailable (older SDK / transient) — fall back to counting documents.
    console.warn("count() aggregation failed, counting documents instead:", err);
    const snap = await getDocs(q);
    return snap.size;
  }
}

/** Locally-saved + seed published questions (these never live in Firestore). */
function localAndSeedPublished(): FirestoreQuestion[] {
  const deleted = getDeletedQuestionIds();
  const local = getLocalQuestions().filter((lq) => lq.status === "published");
  const defs = DEFAULT_QUESTIONS.filter((dq) => dq.status === "published" && !deleted.has(dq.id.toLowerCase().trim()));
  return mergeQuestionSources(defs, local, []);
}

/** Published-question count per block (numbers only — no question documents downloaded). */
export function subscribeBlockCounts(blocks: number[], cb: (counts: Record<number, number>) => void) {
  const extras = () => {
    const out: Record<number, number> = {};
    localAndSeedPublished().forEach((q) => {
      if (q.block) out[q.block] = (out[q.block] || 0) + 1;
    });
    return out;
  };
  return cacheThenFetch<Record<number, number>>(
    "idx_blockCounts",
    async () => {
      const counts = await Promise.all(blocks.map((b) => countPublished(where("block", "==", b))));
      const extra = extras();
      const out: Record<number, number> = {};
      blocks.forEach((b, i) => {
        out[b] = counts[i] + (extra[b] || 0);
      });
      return out;
    },
    cb,
    extras
  );
}

/** Published-question count per subject (numbers only — no question documents downloaded). */
export function subscribeSubjectCounts(subjectIds: string[], cb: (counts: Record<string, number>) => void) {
  const extras = () => {
    const out: Record<string, number> = {};
    localAndSeedPublished().forEach((q) => {
      if (q.subjectId) out[q.subjectId] = (out[q.subjectId] || 0) + 1;
    });
    return out;
  };
  return cacheThenFetch<Record<string, number>>(
    "idx_subjectCounts",
    async () => {
      const counts = await Promise.all(subjectIds.map((id) => countPublished(where("subjectId", "==", id))));
      const extra = extras();
      const out: Record<string, number> = {};
      subjectIds.forEach((id, i) => {
        out[id] = counts[i] + (extra[id] || 0);
      });
      return out;
    },
    cb,
    extras
  );
}

export interface BlockOutline {
  block: number;
  total: number;
  modules: {
    id: string;
    name: string;
    description?: string;
    total: number;
    subjects: { subjectId: string; count: number }[];
  }[];
}

function outlineFromQuestions(block: number, questions: FirestoreQuestion[]): BlockOutline {
  const modules = new Map<string, BlockOutline["modules"][number]>();
  let total = 0;
  questions.forEach((q) => {
    if (q.status !== "published" || q.block !== block) return;
    total++;
    const name = q.moduleName || "General Module";
    const modId = q.moduleId || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    let mod = modules.get(modId);
    if (!mod) {
      mod = { id: modId, name, total: 0, subjects: [] };
      modules.set(modId, mod);
    }
    mod.total++;
    const subj = mod.subjects.find((s) => s.subjectId === q.subjectId);
    if (subj) subj.count++;
    else mod.subjects.push({ subjectId: q.subjectId, count: 1 });
  });
  return { block, total, modules: Array.from(modules.values()) };
}

/** Module -> subject breakdown for ONE block, loaded when that block is selected. */
export function subscribeBlockOutline(block: number, cb: (outline: BlockOutline) => void) {
  const localOnly = () => outlineFromQuestions(block, localAndSeedPublished().filter((q) => q.block === block));
  return cacheThenFetch<BlockOutline>(
    `idx_blockOutline_${block}`,
    async () => {
      const snap = await getDocs(
        query(collection(db, "questions"), where("status", "==", "published"), where("block", "==", block))
      );
      const deleted = getDeletedQuestionIds();
      const fsQuestions = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<FirestoreQuestion, "id">) }))
        .filter((fq) => !deleted.has(fq.id.toLowerCase().trim()));
      const local = getLocalQuestions().filter((lq) => lq.status === "published" && lq.block === block);
      const defs = DEFAULT_QUESTIONS.filter(
        (dq) => dq.status === "published" && dq.block === block && !deleted.has(dq.id.toLowerCase().trim())
      );
      return outlineFromQuestions(block, mergeQuestionSources(defs, local, fsQuestions));
    },
    cb,
    localOnly
  );
}

export async function searchGlobalQuestions(queryText: string): Promise<FirestoreQuestion[]> {
  try {
    const q = query(collection(db, "questions"), where("status", "==", "published"));
    const snap = await getDocs(q);
    const fsResults = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FirestoreQuestion, "id">) }));
    
    const localQs = getLocalQuestions().filter(lq => lq.status === "published");
    const defResults = DEFAULT_QUESTIONS.filter(dq => dq.status === "published");
    
    const combined = mergeQuestionSources(defResults, localQs, fsResults);
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

/* --------------------------- Account Access (Manage Access tab) ---------------------------- */

/**
 * Live view of every registered user's profile, for the admin "Manage Access"
 * tab — lists every account so an admin can see and edit their per-Block
 * unlock overrides. Requires the real Firestore `admin` custom claim (see
 * scripts/setAdminClaim.mjs); the `users` collection's security rule only
 * grants `list` to admins, so this comes back empty (with a console warning,
 * caught below) for anyone else.
 */
export function subscribeAllUsers(cb: (users: UserProfile[]) => void) {
  const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, "uid">) })));
    },
    (err) => {
      console.warn("Firestore subscribeAllUsers failed:", err.message);
      cb([]);
    }
  );
}

/**
 * Overwrites which Blocks are manually unlocked for one account — the
 * "Manage Access" tab calls this with the full next list every time a
 * checkbox is toggled (not an add/remove delta), so this always reflects
 * exactly what's checked in the UI. Passing an empty array clears every
 * manual override (the account falls back to FREE_BLOCK + premium rules);
 * this never touches the `premium` flag itself.
 */
export async function setUserUnlockedBlocks(uid: string, blocks: number[]) {
  const sorted = Array.from(new Set(blocks)).sort((a, b) => a - b);
  await updateDoc(doc(db, "users", uid), { unlockedBlocks: sorted });
}

/**
 * Grants or revokes the per-account Test Series override — the "Test" toggle
 * shown next to a student's Manually Unlocked Blocks. When granted, this
 * account can open every published Test Session regardless of the global
 * Test Series on/off switch and regardless of which Blocks/Subjects the test
 * draws from.
 */
export async function setUserTestSeriesUnlocked(uid: string, unlocked: boolean) {
  await updateDoc(doc(db, "users", uid), { testSeriesUnlocked: unlocked });
}

/** Grants or revokes premium (the full 1–15 bundle) for one account from the admin panel. */
export async function setUserPremium(uid: string, premium: boolean) {
  await updateDoc(doc(db, "users", uid), {
    premium,
    premiumExpiry: null, // admin-granted premium doesn't expire; use setPremium() in firestore.ts for timed grants
  });
}

