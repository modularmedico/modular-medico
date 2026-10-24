import type { FirestorePastPaper, TestSessionDoc } from "../types";
import { SUBJECT_META, type SubjectId } from "../data/subjects";

/**
 * Shared bits for the 3 home boxes (Practice MCQs, Test Sessions, UHS Past Papers).
 * All three use the same drill-down:
 *   Blocks -> Modules -> Subjects -> Subheadings
 * each level being its own page under /browse/:kind/...
 */
export type HubKind = "mcqs" | "tests" | "papers";

export const isHubKind = (v: string | undefined): v is HubKind => v === "mcqs" || v === "tests" || v === "papers";

export const GENERAL_LABEL = "General";
/** URL token that stands for "no subheading" (the General bucket). */
export const GENERAL_KEY = "__general";

export const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "general";

export const subjectLabel = (id: string) =>
  id === "all" ? "All subjects" : SUBJECT_META[id as SubjectId]?.label ?? id;

/** One leaf item (a test or a paper) placed on the Block > Module > Subject > Subheading tree. */
export interface HubEntry {
  id: string;
  block: number;
  moduleId: string;
  moduleName: string;
  subjectId: string; // "all" when a test mixes subjects
  topic: string | null; // null = General
}

export function entriesFromTests(tests: TestSessionDoc[]): HubEntry[] {
  const out: HubEntry[] = [];
  tests.forEach((test) => {
    test.sources.forEach((s) => {
      const moduleName = (s.moduleName || "").trim() || GENERAL_LABEL;
      out.push({
        id: test.id,
        block: s.block,
        moduleId: slugify(moduleName),
        moduleName,
        subjectId: s.subjectId || "all",
        topic: (s.topicName || "").trim() || null,
      });
    });
  });
  return out;
}

export function entriesFromPapers(papers: FirestorePastPaper[]): HubEntry[] {
  return papers.map((p) => {
    const moduleName = (p.moduleName || "").trim() || GENERAL_LABEL;
    return {
      id: p.id,
      block: p.block,
      moduleId: slugify(moduleName),
      moduleName,
      subjectId: p.subjectId,
      topic: (p.topicName || "").trim() || null,
    };
  });
}

/** Number of distinct tests/papers in a set of entries (a test can touch the same node twice). */
export const distinctCount = (entries: HubEntry[]) => new Set(entries.map((e) => e.id)).size;

export const topicToKey = (topic: string | null) => topic ?? GENERAL_KEY;

/** Does a test source match the module/subject/topic filters in the URL? (undefined filter = any) */
export function matchesFilter(
  e: { block: number; moduleId: string; subjectId: string; topic: string | null },
  f: { block?: number; module?: string; subject?: string; topic?: string }
) {
  if (f.block !== undefined && e.block !== f.block) return false;
  if (f.module && e.moduleId !== f.module) return false;
  if (f.subject && e.subjectId !== f.subject) return false;
  if (f.topic && topicToKey(e.topic) !== f.topic) return false;
  return true;
}
