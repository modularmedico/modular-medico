import type { ImportResult } from "../types";

/**
 * Parses blocks of the form:
 *   [Question text ; Option A | Option B | *Option C | Option D]
 * or with an explanation:
 *   [Question text ; Option A | Option B | *Option C | Option D ; Explanation text]
 * where the option marked with "*" (prefix or suffix) is the correct answer.
 */
export function parseBracketFormat(raw: string, existing: { q: string }[] = []): ImportResult[] {
  const blocks = raw.match(/\[[\s\S]*?\]/g) || [];
  const existingNorm = new Set(existing.map((q) => q.q.replace(/\s+/g, " ").trim().toLowerCase()));

  return blocks.map((block, i) => {
    const inner = block.slice(1, -1).trim();
    const parts = inner.split(";").map((p) => p.trim());

    if (parts.length < 2) {
      return {
        line: i + 1,
        raw: block,
        status: "error",
        message: "Missing ';' separating question from options (e.g., [Question ; A | B | *C | D]).",
      };
    }

    const qText = parts[0];
    const optsPart = parts[1];
    const explanationText = parts.length > 2 ? parts.slice(2).join("; ").trim() : "";

    const rawOpts = optsPart
      .split("|")
      .map((o) => o.trim())
      .filter(Boolean);

    if (rawOpts.length < 2) {
      return {
        line: i + 1,
        raw: block,
        status: "error",
        message: `Expected options separated by '|', found ${rawOpts.length}.`,
      };
    }

    const isMarked = (o: string) => o.startsWith("*") || o.endsWith("*") || o.includes("*");
    const starCount = rawOpts.filter(isMarked).length;

    if (starCount === 0) {
      return {
        line: i + 1,
        raw: block,
        status: "error",
        message: "No correct option marked with '*'. Prefix or suffix the right answer with *.",
      };
    }

    if (starCount > 1) {
      return {
        line: i + 1,
        raw: block,
        status: "error",
        message: "Multiple options marked with '*'. Please mark only one correct option.",
      };
    }

    if (!qText) {
      return {
        line: i + 1,
        raw: block,
        status: "error",
        message: "Question text is empty.",
      };
    }

    const correctIdx = rawOpts.findIndex(isMarked);
    const options = rawOpts.map((o) => o.replace(/^\*+|\*+$/g, "").trim());
    const duplicate = existingNorm.has(qText.replace(/\s+/g, " ").trim().toLowerCase());

    return {
      line: i + 1,
      raw: block,
      status: duplicate ? "warning" : "valid",
      message: duplicate ? "Same question already exists — saving will replace the old one." : "Valid MCQ.",
      q: qText,
      options,
      correct: correctIdx,
      explanation: explanationText || "High-yield MBBS curriculum concept explanation.",
    };
  });
}

