import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ActiveSetRef, AnswerRecord, PracticeConfig, UserProfile } from "../types";
import { FREE_BLOCKS, TOTAL_BLOCKS } from "../data/subjects";

export interface QuizSession {
  setRef: ActiveSetRef;
  config: PracticeConfig;
  queue: number[];
  pos: number;
  record: Record<number, AnswerRecord>;
  bookmarked: Record<number, boolean>;
  /** How many times each original question index has been requeued (spaced repetition is capped at 1). */
  requeueCount: Record<number, number>;
  /** Original question indices the learner explicitly skipped, for the "Review skipped" jump list. */
  skipped: Record<number, boolean>;
  /** Original question indices whose answer was revealed with "Show answer" (without picking an option). */
  revealed?: Record<number, boolean>;
  /** Seconds left on the clock when the learner last left, so a resumed session carries on from there. */
  secondsLeft?: number | null;
}

/**
 * True when a persisted session has real progress worth offering to resume — i.e. the learner
 * answered/skipped something or moved past the first question. A session that was just created
 * and never touched is silently replaced instead of triggering the "continue?" prompt.
 */
export const isSessionResumable = (s: QuizSession | null | undefined): s is QuizSession =>
  !!s && s.queue.length > 0 &&
  // Test Series attempts are timed + leaderboard-tracked (2h retake lock), so they are never resumable.
  !s.setRef.moduleId.startsWith("test-") && (s.pos > 0 || Object.keys(s.record).length > 0 || Object.keys(s.revealed ?? {}).length > 0);

interface AppState {
  isDark: boolean;
  toggleDark: () => void;

  // Firebase auth + Firestore profile — populated by subscribeAuth()/subscribeUserProfile()
  // in App.tsx, not mutated directly by pages.
  uid: string | null;
  email: string | null;
  displayName: string;
  profile: UserProfile | null;
  authReady: boolean;
  setAuthUser: (uid: string | null, email: string | null, displayName: string) => void;
  setProfile: (profile: UserProfile | null) => void;
  setAuthReady: (ready: boolean) => void;

  // Client-side gate on the /admin route. The *real* write permission is enforced by
  // Firestore security rules requiring the `admin` custom claim on the signed-in user
  // (see scripts/setAdminClaim.mjs) — this flag only controls whether the admin UI
  // renders in this browser tab.
  isAdmin: boolean;
  enterAdmin: () => void;
  exitAdmin: () => void;
  unlockFreePremium: () => void;

  // Which Blocks are free for everyone — defaults to the FREE_BLOCKS constant
  // and is kept live by subscribeFreeBlocks() in App.tsx once Firestore's
  // settings/freeBlocks doc loads, so an admin's toggle takes effect for
  // everyone without a redeploy.
  freeBlocks: number[];
  setFreeBlocks: (blocks: number[]) => void;

  // Subjects that stay free inside otherwise-paid blocks: { [block]: subjectIds[] }.
  // Kept live by subscribeFreeSubjects() in App.tsx (Firestore settings/freeSubjects).
  freeSubjects: Record<number, string[]>;
  setFreeSubjects: (map: Record<number, string[]>) => void;

  // Blocks whose Past Papers are free for everyone. Defaults to ALL blocks (Past
  // Papers were previously open) until an admin saves settings/freePastPaperBlocks.
  freePaperBlocks: number[];
  setFreePaperBlocks: (blocks: number[]) => void;

  // Whether Test Series are open to students at all — defaults to true (on)
  // and is kept live by subscribeTestSeriesAccess() in App.tsx once
  // Firestore's settings/testSeriesAccess doc loads, so an admin's toggle on
  // the "Manage Access" tab takes effect for everyone instantly.
  testSeriesEnabled: boolean;
  setTestSeriesEnabled: (enabled: boolean) => void;

  session: QuizSession | null;
  startSession: (setRef: ActiveSetRef, config: PracticeConfig) => void;
  updateSession: (patch: Partial<QuizSession>) => void;
  clearSession: () => void;

  lastResult: { setRef: ActiveSetRef; answers: AnswerRecord[] } | null;
  setLastResult: (setRef: ActiveSetRef, answers: AnswerRecord[]) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      isDark: false,
      toggleDark: () => set((s) => ({ isDark: !s.isDark })),

      uid: null,
      email: null,
      displayName: "",
      profile: null,
      authReady: false,
      setAuthUser: (uid, email, displayName) => set({ uid, email, displayName }),
      setProfile: (profile) => set({ profile }),
      setAuthReady: (ready) => set({ authReady: ready }),

      isAdmin: false,
      enterAdmin: () => set({ isAdmin: true }),
      exitAdmin: () => set({ isAdmin: false }),
      unlockFreePremium: () => {
        const p = get().profile;
        if (p) {
          set({ profile: { ...p, premium: true, premiumExpiry: null } });
        } else {
          set({
            profile: {
              uid: get().uid || "student_local",
              displayName: get().displayName || "Student",
              email: get().email || "student@modularmedico.app",
              createdAt: Date.now(),
              streak: 1,
              lastActiveDate: new Date().toISOString().slice(0, 10),
              dailyGoalTarget: 50,
              dailyGoalDate: new Date().toISOString().slice(0, 10),
              dailyGoalCount: 0,
              premium: true,
              premiumExpiry: null,
            },
          });
        }
      },

      freeBlocks: FREE_BLOCKS,
      setFreeBlocks: (blocks) => set({ freeBlocks: blocks }),
      freeSubjects: {},
      setFreeSubjects: (map) => set({ freeSubjects: map }),
      freePaperBlocks: Array.from({ length: TOTAL_BLOCKS }, (_, i) => i + 1),
      setFreePaperBlocks: (blocks) => set({ freePaperBlocks: blocks }),

      testSeriesEnabled: true,
      setTestSeriesEnabled: (enabled) => set({ testSeriesEnabled: enabled }),

      session: null,
      startSession: (setRef, config) =>
        set({
          session: {
            setRef,
            config,
            queue: setRef.questions.map((_, i) => i),
            pos: 0,
            record: {},
            bookmarked: {},
            requeueCount: {},
            skipped: {},
            revealed: {},
            secondsLeft: undefined,
          },
        }),
      updateSession: (patch) => {
        const current = get().session;
        if (!current) return;
        set({ session: { ...current, ...patch } });
      },
      clearSession: () => set({ session: null }),

      lastResult: null,
      setLastResult: (setRef, answers) => set({ lastResult: { setRef, answers } }),
    }),
    {
      name: "modular-medico-store",
      partialize: (s) => ({
        isDark: s.isDark,
        isAdmin: s.isAdmin,
        uid: s.uid,
        email: s.email,
        displayName: s.displayName,
        profile: s.profile,
        freeBlocks: s.freeBlocks,
        freeSubjects: s.freeSubjects,
        freePaperBlocks: s.freePaperBlocks,
        testSeriesEnabled: s.testSeriesEnabled,
        session: s.session,
        lastResult: s.lastResult,
      }),
    }
  )
);

export const useIsLoggedIn = () => useAppStore((s) => !!s.uid);
export const useIsPremium = () =>
  useAppStore((s) => {
    if (s.isAdmin) return true;
    if (s.profile?.premium) {
      if (!s.profile.premiumExpiry) return true;
      return s.profile.premiumExpiry > Date.now();
    }
    return false;
  });

/**
 * Whether the signed-in user can access a specific Block: true for the free
 * block, for admins, for anyone with an active premium subscription, or when
 * an admin has manually granted this exact block via `unlockedBlocks` on the
 * "Manage Access" admin tab (e.g. a student given just Block 4 without going
 * fully premium).
 */
export const useIsBlockUnlocked = (block: number) =>
  useAppStore((s) => {
    if (s.freeBlocks.includes(block)) return true;
    if (s.isAdmin) return true;
    if (s.profile?.premium) {
      if (!s.profile.premiumExpiry || s.profile.premiumExpiry > Date.now()) return true;
    }
    return !!s.profile?.unlockedBlocks?.includes(block);
  });

/**
 * Like useIsBlockUnlocked, but also true when an admin marked this specific
 * subject as free inside the (paid) block — see Admin > Manage Access.
 */
export const useIsSubjectUnlocked = (block: number, subjectId: string | null | undefined) =>
  useAppStore((s) => {
    if (s.freeBlocks.includes(block)) return true;
    if (s.isAdmin) return true;
    if (s.profile?.premium) {
      if (!s.profile.premiumExpiry || s.profile.premiumExpiry > Date.now()) return true;
    }
    if (s.profile?.unlockedBlocks?.includes(block)) return true;
    return !!subjectId && !!s.freeSubjects[block]?.includes(subjectId);
  });

/**
 * Whether the signed-in user can open the Past Papers of a Block: free when the
 * admin marked that block free (Manage Access > Free Past Papers), and always
 * for admins, active premium, accounts with the per-user `pastPapersUnlocked`
 * override, or accounts given that block via `unlockedBlocks`.
 */
export const useIsPaperBlockUnlocked = (block: number) =>
  useAppStore((s) => {
    if (s.freePaperBlocks.includes(block)) return true;
    if (s.isAdmin) return true;
    if (s.profile?.premium) {
      if (!s.profile.premiumExpiry || s.profile.premiumExpiry > Date.now()) return true;
    }
    if (s.profile?.pastPapersUnlocked) return true;
    return !!s.profile?.unlockedBlocks?.includes(block);
  });

/**
 * Whether the signed-in user can access Test Series at all. Admins always
 * can (so they can preview); an account with the per-user `testSeriesUnlocked`
 * override (set on the "Manage Access" tab) always can too, even while the
 * global switch is off; everyone else follows that single global on/off
 * switch an admin sets on the "Manage Access" tab.
 */
export const useCanAccessTestSeries = () =>
  useAppStore((s) => s.isAdmin || !!s.profile?.testSeriesUnlocked || s.testSeriesEnabled);
