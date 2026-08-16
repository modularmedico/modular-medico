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
