import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Site-wide visit tracking.
 *
 * Two Firestore locations:
 *  - siteStats/summary        -> { totalVisits, updatedAt }  (all-time counter)
 *  - siteStats_daily/{YYYY-MM-DD} -> { date, count, updatedAt } (per-day counter,
 *    used to draw the "visitors over time" chart in the admin panel)
 *
 * Both documents only ever have their counter incremented by 1 per write, and
 * firestore.rules enforces that server-side (see rules for `siteStats` /
 * `siteStats_daily`), so a malicious client can't jam the counter to an
 * arbitrary number even though writes don't require auth.
 *
 * Counting model: one increment per browser *session* (sessionStorage-gated),
 * not one per page view / route change — so navigating between pages inside
 * the SPA doesn't inflate the number. This under-counts real "page views" but
 * gives a much more useful "how many people visited the site" figure.
 */

const SESSION_FLAG_KEY = "modular_medico_visit_counted";

function todayKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Records one visit for this browser session, at most once per tab session.
 * Safe to call on every app load — it no-ops after the first successful call
 * in a given sessionStorage lifetime (cleared when the tab/window closes).
 * Never throws: analytics is best-effort and must never block the app.
 */
export async function trackVisit(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (window.sessionStorage.getItem(SESSION_FLAG_KEY) === "1") return;
    window.sessionStorage.setItem(SESSION_FLAG_KEY, "1");
  } catch {
    // sessionStorage unavailable (privacy mode etc.) — fall through and still
    // attempt the write once per page load in that case.
  }

  try {
    await bumpCounter(doc(db, "siteStats", "summary"), { totalVisits: 1 });
    await bumpCounter(doc(db, "siteStats_daily", todayKey()), { count: 1, date: todayKey() });
  } catch (e) {
    console.warn("Visit tracking failed (non-critical):", e);
  }
}

// Shared "create with count 1, or increment by 1" helper for a counter doc.
async function bumpCounter(ref: ReturnType<typeof doc>, extraFieldsOnCreate: Record<string, unknown>) {
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const [firstNumericKey] = Object.keys(extraFieldsOnCreate).filter((k) => typeof extraFieldsOnCreate[k] === "number");
    try {
      await setDoc(ref, { ...extraFieldsOnCreate, updatedAt: serverTimestamp() });
      return;
    } catch {
      // Lost a create race with another visitor's first-of-the-day write —
      // fall through to increment instead.
      void firstNumericKey;
    }
  }
  const numericKey = Object.keys(extraFieldsOnCreate).find((k) => typeof extraFieldsOnCreate[k] === "number");
  if (!numericKey) return;
  await updateDoc(ref, { [numericKey]: increment(1), updatedAt: serverTimestamp() });
}

export interface SiteStatsSummary {
  totalVisits: number;
}

/** Live total-visits counter for the admin panel. */
export function subscribeSiteStatsSummary(cb: (stats: SiteStatsSummary) => void): Unsubscribe {
  const ref = doc(db, "siteStats", "summary");
  return onSnapshot(
    ref,
    (snap) => cb({ totalVisits: (snap.data()?.totalVisits as number) || 0 }),
    () => cb({ totalVisits: 0 })
  );
}

export interface DailyVisitPoint {
  date: string; // YYYY-MM-DD
  count: number;
}

/** Live last-`days` daily visit counts (most recent last), for a simple chart. */
export function subscribeDailyVisits(days: number, cb: (points: DailyVisitPoint[]) => void): Unsubscribe {
  const q = query(collection(db, "siteStats_daily"), orderBy("date", "desc"), limit(days));
  return onSnapshot(
    q,
    (snap) => {
      const points: DailyVisitPoint[] = snap.docs.map((d) => ({
        date: (d.data().date as string) || d.id,
        count: (d.data().count as number) || 0,
      }));
      points.sort((a, b) => a.date.localeCompare(b.date));
      cb(points);
    },
    () => cb([])
  );
}
