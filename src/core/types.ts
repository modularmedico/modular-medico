export interface Rec {
  id: string; title: string; abstract: string; authors: string[]; year?: number;
  journal: string; volume: string; issue: string; pages: string; doi: string; pmid: string;
  keywords: string[]; sourceDb: string; batch: string; raw: string; mergedInto?: string; sources?: string[];
}
export type Tier = 'auto' | 'possible';
export interface Pair { a: string; b: string; score: number; tier: Tier; reason: string }
export interface DedupOptions { auto: number; possible: number }
export interface ParseReport { parsed: number; skipped: { index: number; reason: string }[] }
