export type Difficulty = "easy" | "medium" | "hard";

export interface MCQ {
  q: string;
  options: string[];
  correct: number;
  explanation: string;
}

export interface SubjectMeta {
  label: string;
  tag: string;
}

export type QuestionStatus = "draft" | "published";

/** A single MCQ document as stored in the Firestore `questions` collection. */
export interface FirestoreQuestion {
  id: string;
  subjectId: string;
  moduleId: string;
  moduleName: string;
  block: number; // 1..15
  topicId?: string | null;
  topicName?: string | null;
  /**
   * Legacy tag fields from before MCQ topics had their own collection —
   * some already-published questions in Firestore may still only have
   * these set (back when this 4th tier was called "Subheading" for MCQs
   * too, sharing lectures' `subheadings` collection). Kept here so those
   * older questions still match when a student filters by Subheading.
   */
  subheadingId?: string | null;
  subheadingName?: string | null;
  difficulty: Difficulty;
  q: string;
  options: string[];
  correct: number;
  explanation: string;
  status: QuestionStatus;
  createdAt?: number;
}

export interface ModuleDoc {
  id: string;
  subjectId: string;
  name: string;
  order: number;
}

/**
 * A Subheading is the 4th level of the content hierarchy:
 * Block -> Module -> Subject -> Subheading.
 * It is scoped to one specific (block, moduleId, subjectId) combination,
 * e.g. within "Block 3 / Cardiovascular-I / Gross Anatomy" a faculty member
 * might create subheadings like "Heart Chambers" or "Coronary Circulation".
 */
export interface SubheadingDoc {
  id: string;
  block: number;
  moduleId: string;
  subjectId: string;
  name: string;
  order: number;
}

/**
 * A Topic is the MCQ-Practice-side counterpart to a Lecture's Subheading.
 * It is intentionally a SEPARATE 4th tier of the hierarchy — Block -> Module ->
 * Subject -> Topic — stored in its own Firestore collection ("topics") so that
 * creating/renaming/removing a Topic while tagging an MCQ can never add, rename,
 * or remove a Lecture's Subheading (and vice versa), even though both are scoped
 * to the exact same (block, moduleId, subjectId) triple. Before this existed,
 * MCQs and Lectures shared the `subheadings` collection, so the two pickers
 * always showed and mutated the exact same list.
 */
export interface TopicDoc {
  id: string;
  block: number;
  moduleId: string;
  subjectId: string;
  name: string;
  order: number;
}

/**
 * A single Lecture document as stored in the Firestore `lectures` collection.
 * Follows the exact same 4-tier hierarchy as MCQs — Block -> Module -> Subject ->
 * Subheading — so a video is always filed under the same scaffold students already
 * use to browse questions.
 */
export interface FirestoreLecture {
  id: string;
  title: string;
  youtubeUrl: string;
  description?: string;
  subjectId: string;
  moduleId: string;
  moduleName: string;
  block: number;
  subheadingId?: string | null;
  subheadingName?: string | null;
  status: QuestionStatus; // reuse "draft" | "published"
  createdAt?: number;
}

/**
 * A single OSPE Book document as stored in the Firestore `ospe_books` collection.
 * Each entry is simply a reference/label for a Google Drive PDF, scoped to one
 * Subject (OSPE reference books are typically subject-wide, not tied to a single
 * Block/Module/Subheading the way MCQs and Lectures are).
 */
export interface FirestoreOspeBook {
  id: string;
  title: string;
  driveUrl: string;
  description?: string;
  subjectId: string;
  status: QuestionStatus; // reuse "draft" | "published"
  order?: number;
  createdAt?: number;
}

/**
 * A single Study Note document as stored in the Firestore `study_notes`
 * collection ("Books & Study Notes" — the student-facing library separate
 * from OSPE Material). Unlike OSPE Material (Subject-only), each Study Note
 * is scoped to the full Block -> Module -> Subject hierarchy, matching how
 * MCQs and Lectures are organized.
 */
export interface FirestoreStudyNote {
  id: string;
  title: string;
  driveUrl: string;
  description?: string;
  subjectId: string;
  moduleId: string;
  moduleName: string;
  block: number;
  status: QuestionStatus; // reuse "draft" | "published"
  order?: number;
  createdAt?: number;
}

export interface AnswerRecord {
  selected: number | null;
  correct: boolean;
}

export interface PracticeConfig {
  mode: "traditional" | "omr" | "exam";
  timing: "untimed" | "timed";
  timerType?: "session" | "per_question";
  customTimerSeconds?: number | null;
  timerPerQuestionSeconds?: number;
  spacedRep: boolean;
  difficultyFilter: Difficulty | "all";
}

export interface ActiveSetRef {
  subjectId: string;
  moduleId: string;
  moduleName: string;
  block: number;
  setTitle: string;
  questions: MCQ[];
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  createdAt: number;
  streak: number;
  lastActiveDate: string | null; // YYYY-MM-DD
  dailyGoalTarget: number;
  dailyGoalDate: string | null; // YYYY-MM-DD the count below applies to
  dailyGoalCount: number;
  premium: boolean;
  premiumExpiry: number | null;
  isAdmin?: boolean;
  /**
   * Per-account Block access override, set only by an admin from the "Manage
   * Access" admin tab. Block numbers listed here (1..15) are unlocked for this
   * user regardless of `premium` — lets an admin grant a specific student
   * access to, say, Block 4 and Block 7 only, without making their whole
   * account premium. `null`/absent means no manual override: access still
   * follows the normal FREE_BLOCK + premium rule. This is additive only — it
   * can never lock a block that premium/FREE_BLOCK already unlocks.
   */
  unlockedBlocks?: number[] | null;
  /**
   * Per-account Test Series access override, set only by an admin from the
   * "Manage Access" admin tab (the "Test" toggle next to a student's Manually
   * Unlocked Blocks). When true, this account can open every published Test
   * Session regardless of the global Test Series on/off switch and regardless
   * of which Blocks/Subjects it draws questions from. `false`/absent means no
   * override: the account still follows the normal testSeriesEnabled +
   * per-test Block/Subject rules.
   */
  testSeriesUnlocked?: boolean;
}

export interface AttemptRecord {
  id: string;
  subjectId: string;
  moduleName: string;
  block: number;
  setTitle: string;
  total: number;
  correct: number;
  scorePct: number;
  createdAt: number;
}

export interface BookmarkRecord {
  id: string;
  subjectId: string;
  moduleName: string;
  block: number;
  question: MCQ;
  createdAt: number;
}

export type PaymentProvider = "jazzcash" | "easypaisa";

export interface ImportResult {
  line: number;
  raw: string;
  status: "valid" | "warning" | "error";
  message: string;
  q?: string;
  options?: string[];
  correct?: number;
  explanation?: string;
}

/** One MCQ inside a Test Session, snapshotted from the question bank when the admin added it. */
export interface TestSessionQuestion extends MCQ {
  /** Original bank question id — used to avoid adding the same MCQ twice. */
  sourceId: string;
  subjectId: string;
  moduleId: string;
  moduleName: string;
  block: number;
  topicName?: string | null;
}

/** A group of MCQs added in one go (Module + Subject + Topic + quantity), shown in the admin list. */
export interface TestSessionSource {
  block: number;
  moduleName: string;
  subjectId: string | null;
  topicName: string | null;
  count: number;
}

/**
 * A Test Session, stored in the Firestore `test_sessions` collection.
 * MCQs are copied into the doc (snapshot) so students read one document and the
 * test stays stable even if the bank is edited later.
 */
export interface TestSessionDoc {
  id: string;
  name: string;
  status: QuestionStatus; // "draft" hidden from students, "published" visible on /tests
  questions: TestSessionQuestion[];
  sources: TestSessionSource[];
  createdAt: number;
}

/**
 * One student's standing on one Test Session, stored in `test_leaderboard/{testId}_{uid}`.
 * Doubles as the retake lock: `startedAt` is stamped by the server each time a test is
 * started and a new attempt is only allowed 2 hours after it. The score fields hold the
 * student's BEST finished attempt.
 */
export interface TestLeaderboardEntry {
  id: string;
  testId: string;
  testName: string;
  uid: string;
  displayName: string;
  /** Medical college the student entered before starting the test. */
  college: string;
  /** Server time (ms) the latest attempt was started — drives the retake cooldown. */
  startedAt: number;
  /** True once at least one attempt has been finished and scored. */
  completed: boolean;
  correct: number;
  total: number;
  scorePct: number;
  /** Seconds taken for the best attempt (tie-breaker: faster wins). */
  timeTakenSec: number;
  attempts: number;
}
