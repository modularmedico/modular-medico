import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Plus, X } from "lucide-react";
import Btn from "../Btn";
import { FONT_DISPLAY, type ThemeTokens } from "../../theme";
import { MASTER_MODULES, SUBJECT_LIST, SUBJECT_META, TOTAL_BLOCKS } from "../../data/subjects";
import { parseBracketFormat } from "../../utils/parseBracketFormat";
import { mcqKey } from "../../utils/mcqKey";
import type { TestSessionDoc, TestSessionQuestion, TestSessionSource } from "../../types";

const subjectLabel = (id: string) => SUBJECT_META[id as keyof typeof SUBJECT_META]?.label || id;
const moduleSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

interface Draft {
  q: string;
  options: string[];
  correct: number;
  explanation: string;
}
const blankDraft = (): Draft => ({ q: "", options: ["", "", "", ""], correct: 0, explanation: "" });

/**
 * "Write new MCQs" mode for a mock test. Same two input styles as Admin > Add MCQs (bracket paste
 * + traditional form), but the MCQs go straight into this mock test only — they are NOT written to
 * the question bank, so the bank / Manage MCQs / Practice are untouched.
 */
export default function IndependentMcqAdder({
  t,
  test,
  defaultBlock,
  noun,
  onNotice,
  onAdd,
}: {
  t: ThemeTokens;
  test: TestSessionDoc;
  defaultBlock: number;
  noun: string;
  onNotice: (n: { tone: "ok" | "err"; text: string } | null) => void;
  onAdd: (test: TestSessionDoc, added: TestSessionQuestion[], source: TestSessionSource) => Promise<void>;
}) {
  const [mode, setMode] = useState<"bracket" | "traditional">("bracket");
  const [block, setBlock] = useState(defaultBlock || 1);
  const [moduleName, setModuleName] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [topicName, setTopicName] = useState("");
  const [bracketText, setBracketText] = useState("");
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [adding, setAdding] = useState(false);

  const parsed = useMemo(() => parseBracketFormat(bracketText, test.questions), [bracketText, test.questions]);
  const valid = parsed.filter((p) => p.status !== "error" && p.q && p.options && p.correct !== undefined);
  const errors = parsed.filter((p) => p.status === "error");

  const draftProblem = (() => {
    if (!draft.q.trim()) return "Question text is empty";
    if (draft.options.some((o) => !o.trim())) return "Fill in or remove empty options";
    if (draft.correct < 0 || draft.correct >= draft.options.length) return "Pick the correct option";
    return null;
  })();

  const inputStyle = { backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text };
  const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wider";

  const save = async (items: Draft[]) => {
    if (adding || items.length === 0) return false;
    // The same MCQ can't be in one test twice (sourceId is derived from the text + options).
    const have = new Set(test.questions.map((q) => q.sourceId));
    const seen = new Set<string>();
    const fresh: TestSessionQuestion[] = [];
    let skipped = 0;
    for (const it of items) {
      const clean = {
        q: it.q.trim(),
        options: it.options.map((o) => o.trim()),
        correct: it.correct,
        explanation: it.explanation.trim(),
      };
      const key = mcqKey(clean);
      if (have.has(key) || seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      fresh.push({
        ...clean,
        sourceId: key,
        subjectId,
        moduleId: moduleName ? moduleSlug(moduleName) : "",
        moduleName,
        block,
        topicName: topicName.trim() || null,
      });
    }
    if (fresh.length === 0) {
      onNotice({ tone: "err", text: "Those MCQs are already in this " + noun + "." });
      return false;
    }
    setAdding(true);
    try {
      await onAdd(test, fresh, {
        block,
        moduleName: moduleName || "Written directly",
        subjectId: subjectId || null,
        topicName: topicName.trim() || null,
        count: fresh.length,
      });
      onNotice({
        tone: "ok",
        text: `Added ${fresh.length} new MCQ${fresh.length !== 1 ? "s" : ""} to "${test.name}"${
          skipped ? ` (${skipped} duplicate${skipped !== 1 ? "s" : ""} skipped)` : ""
        }.`,
      });
      return true;
    } catch (e) {
      onNotice({ tone: "err", text: e instanceof Error ? e.message : "Couldn't add MCQs." });
      return false;
    } finally {
      setAdding(false);
    }
  };

  const addBracket = async () => {
    const ok = await save(
      valid.map((v) => ({
        q: v.q as string,
        options: v.options as string[],
        correct: v.correct as number,
        explanation: v.explanation || "",
      }))
    );
    if (ok) setBracketText("");
  };

  const addTraditional = async () => {
    if (draftProblem) return;
    const ok = await save([draft]);
    if (ok) setDraft(blankDraft());
  };

  const patchOption = (i: number, v: string) =>
    setDraft((d) => ({ ...d, options: d.options.map((o, j) => (j === i ? v : o)) }));
  const removeOption = (i: number) =>
    setDraft((d) => {
      if (d.options.length <= 2) return d;
      const correct = d.correct === i ? 0 : d.correct > i ? d.correct - 1 : d.correct;
      return { ...d, options: d.options.filter((_, j) => j !== i), correct };
    });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>Write new MCQs for this {noun}</h3>
        <p className="text-xs" style={{ color: t.textFaint, marginTop: 2 }}>
          Same bracket / traditional input as Add MCQs, but these go only into this {noun} — they are not saved to
          the question bank.
        </p>
      </div>

      {/* Optional tags */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className={labelCls} style={{ color: t.textFaint }}>Block</label>
          <select
            value={block}
            onChange={(e) => setBlock(Number(e.target.value))}
            className="w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none"
            style={inputStyle}
          >
            {Array.from({ length: TOTAL_BLOCKS }, (_, i) => i + 1).map((b) => (
              <option key={b} value={b}>Block {b}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} style={{ color: t.textFaint }}>Module (optional)</label>
          <select
            value={moduleName}
            onChange={(e) => setModuleName(e.target.value)}
            className="w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none"
            style={inputStyle}
          >
            <option value="">None</option>
            {MASTER_MODULES.map((m) => (
              <option key={m.id} value={m.name}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} style={{ color: t.textFaint }}>Subject (optional)</label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none"
            style={inputStyle}
          >
            <option value="">None</option>
            {SUBJECT_LIST.map((s) => (
              <option key={s} value={s}>{subjectLabel(s)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} style={{ color: t.textFaint }}>Subheading (optional)</label>
          <input
            type="text"
            value={topicName}
            onChange={(e) => setTopicName(e.target.value)}
            maxLength={80}
            placeholder="e.g. Brachial plexus"
            className="w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Mode switch */}
      <div className="flex gap-2">
        {(["bracket", "traditional"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="rounded-xl px-3 py-1.5 text-xs font-bold"
            style={{
              backgroundColor: mode === m ? t.purpleStrong : t.surfaceAlt,
              color: mode === m ? "#fff" : t.text,
              border: `1.5px solid ${mode === m ? t.purpleStrong : t.border}`,
            }}
          >
            {m === "bracket" ? "Bracket paste" : "Traditional form"}
          </button>
        ))}
      </div>

      {mode === "bracket" ? (
        <div>
          <textarea
            value={bracketText}
            onChange={(e) => setBracketText(e.target.value)}
            rows={6}
            placeholder="[Question ; Opt A | *Opt B | Opt C | Opt D ; Explanation (optional)]"
            className="w-full resize-y rounded-xl p-3 font-mono text-xs outline-none"
            style={inputStyle}
          />
          <p className="mt-1 text-[11px]" style={{ color: t.textFaint }}>
            Put * before or after the correct option. Paste as many [ ... ] blocks as you like.
          </p>
          {bracketText.trim() && (
            <div className="mt-2 flex flex-col gap-1.5">
              <span className="font-mono text-xs" style={{ color: t.textMuted }}>
                <strong style={{ color: valid.length ? t.green : t.textFaint }}>{valid.length} valid</strong>
                {errors.length > 0 && <span style={{ color: t.red }}> · {errors.length} with errors</span>}
              </span>
              {errors.map((er) => (
                <p key={er.line} className="flex items-start gap-1 text-[11px] font-semibold" style={{ color: t.red }}>
                  <AlertTriangle size={11} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>MCQ {er.line}: {er.message}</span>
                </p>
              ))}
            </div>
          )}
          <div className="mt-3">
            <Btn
              t={t}
              icon={adding ? Loader2 : Plus}
              spin={adding}
              disabled={valid.length === 0 || adding}
              onClick={addBracket}
            >
              Add {valid.length > 0 ? valid.length : ""} MCQ{valid.length !== 1 ? "s" : ""} to {noun}
            </Btn>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft.q}
            onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
            rows={3}
            placeholder="Question"
            className="w-full resize-y rounded-xl px-3 py-2 text-sm font-semibold outline-none"
            style={inputStyle}
          />
          {draft.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                onClick={() => setDraft((d) => ({ ...d, correct: i }))}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: draft.correct === i ? `${t.green}25` : t.surfaceAlt,
                  border: `1.5px solid ${draft.correct === i ? t.green : t.border}`,
                }}
                title={draft.correct === i ? "Correct answer" : "Mark as correct"}
              >
                {draft.correct === i && <CheckCircle2 size={14} color={t.green} />}
              </button>
              <input
                type="text"
                value={opt}
                onChange={(e) => patchOption(i, e.target.value)}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                className="min-w-0 flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
                style={inputStyle}
              />
              <button
                onClick={() => removeOption(i)}
                disabled={draft.options.length <= 2}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg disabled:opacity-30"
                style={{ backgroundColor: t.surfaceAlt }}
                title="Remove option"
              >
                <X size={13} color={t.textMuted} />
              </button>
            </div>
          ))}
          <button
            onClick={() => setDraft((d) => ({ ...d, options: [...d.options, ""] }))}
            className="flex w-fit items-center gap-1 text-[11px] font-bold"
            style={{ color: t.teal }}
          >
            <Plus size={12} /> Add option
          </button>
          <textarea
            value={draft.explanation}
            onChange={(e) => setDraft((d) => ({ ...d, explanation: e.target.value }))}
            rows={2}
            placeholder="Explanation (optional)"
            className="w-full resize-y rounded-xl px-3 py-2 text-xs outline-none"
            style={inputStyle}
          />
          {draftProblem && (draft.q || draft.options.some(Boolean)) && (
            <p className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: t.red }}>
              <AlertTriangle size={11} /> {draftProblem}
            </p>
          )}
          <div className="mt-1">
            <Btn
              t={t}
              icon={adding ? Loader2 : Plus}
              spin={adding}
              disabled={!!draftProblem || adding}
              onClick={addTraditional}
            >
              Add MCQ to {noun}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
