import type { MCQ } from "../types";

/**
 * Stable id for an MCQ, derived from its text + options. Used as the Firestore document id of a
 * saved MCQ so saving the same question twice (from practice, a past paper, a test...) can never
 * create duplicates, and so every screen can tell whether a given MCQ is already saved.
 */
export function mcqKey(q: Pick<MCQ, "q" | "options">): string {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const raw = `${norm(q.q)}||${q.options.map(norm).join("|")}`;
  // Two independent 32-bit FNV-1a style hashes -> 16 hex chars, plenty to avoid collisions.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
  }
  return `m${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}
