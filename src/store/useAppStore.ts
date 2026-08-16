import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ActiveSetRef, AnswerRecord, PracticeConfig, UserProfile } from "../types";

export interface QuizSession {
  setRef: ActiveSetRef;
  config: PracticeConfig;
  queue: number[];
  pos: number;
  record: Record<number, AnswerRecord>;
  bookmarked: Record<number, boolean>;
  /** How many times each original question index has been requeued (spaced repetition is capped at 1). */
  requeueCount: Record<number, number>;
}

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
