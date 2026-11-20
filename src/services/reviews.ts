import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import type { ReviewDoc, ReviewSource } from "../types";

/**
 * Student reviews. Students can only create; the admin Reviews tab lists them all, picks up to
 * MAX_FEATURED for the homepage, and can delete. Firestore rules (see firestore.rules) keep
 * un-featured reviews private to admins, so the public homepage query MUST filter on featured.
 */

const COL = "reviews";
export const MAX_FEATURED = 5;
export const MAX_REVIEW_CHARS = 500;

const fromSnap = (d: { id: string; data: () => unknown }): ReviewDoc => {
  const data = d.data() as Partial<ReviewDoc>;
  return {
    id: d.id,
    uid: data.uid || "",
    displayName: data.displayName || "Student",
    rating: Math.min(5, Math.max(1, Number(data.rating) || 5)),
    text: data.text || "",
    source: (data.source as ReviewSource) || "mcq",
    context: data.context || "",
    featured: data.featured === true,
    featuredAt: data.featuredAt ?? null,
    createdAt: data.createdAt || 0,
  };
};

export async function submitReview(input: {
  uid: string;
  displayName: string;
  rating: number;
  text: string;
  source: ReviewSource;
  context: string;
}): Promise<void> {
  const text = input.text.trim().slice(0, MAX_REVIEW_CHARS);
  if (input.rating < 1 || input.rating > 5) throw new Error("Pick a star rating first.");
  await addDoc(collection(db, COL), {
    uid: input.uid,
    displayName: (input.displayName || "Student").trim().slice(0, 60),
    rating: Math.round(input.rating),
    text,
    source: input.source,
    context: input.context.slice(0, 160),
    featured: false,
    featuredAt: null,
    createdAt: Date.now(),
  });
}

/** Admin: every review, newest first. */
export function subscribeAllReviews(cb: (list: ReviewDoc[]) => void, onError?: (msg: string) => void) {
  return onSnapshot(
    collection(db, COL),
    (snap) => cb(snap.docs.map(fromSnap).sort((a, b) => b.createdAt - a.createdAt)),
    (err) => {
      console.warn("Firestore reviews error:", err.message);
      onError?.(err.message);
      cb([]);
    }
  );
}

/** Homepage: only the reviews an admin picked (the `where` is required by the rules). */
export function subscribeFeaturedReviews(cb: (list: ReviewDoc[]) => void) {
  return onSnapshot(
    query(collection(db, COL), where("featured", "==", true)),
    (snap) =>
      cb(
        snap.docs
          .map(fromSnap)
          .sort((a, b) => (a.featuredAt ?? a.createdAt) - (b.featuredAt ?? b.createdAt))
          .slice(0, MAX_FEATURED)
      ),
    (err) => {
      console.warn("Firestore featured reviews error:", err.message);
      cb([]);
    }
  );
}

export async function setReviewFeatured(id: string, featured: boolean): Promise<void> {
  await updateDoc(doc(db, COL, id), { featured, featuredAt: featured ? Date.now() : null });
}

export async function deleteReview(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
