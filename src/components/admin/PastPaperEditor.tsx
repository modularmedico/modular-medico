import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ListChecks, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import Card from "../Card";
import Btn from "../Btn";
import { FONT_DISPLAY } from "../../theme";
import { THEME } from "../../theme";
import { MASTER_MODULES, SUBJECT_LIST, SUBJECT_META, type SubjectId } from "../../data/subjects";
import { parseBracketFormat } from "../../utils/parseBracketFormat";
import { updatePastPaper } from "../../services/pastPapers";
import type { FirestorePastPaper, PastPaperMCQItem } from "../../types";

type Theme = (typeof THEME)["dark"];

const TOTAL_BLOCKS = 15;

/** Module <option>s: modules suggested for the chosen Block first, then the rest. */
export function ModuleOptions({ block, t, current }: { block: number; t: Theme; current?: string }) {
  const suggested = MASTER_MODULES.filter((m) => m.suggestedBlock === block);
  const others = MASTER_MODULES.filter((m) => m.suggestedBlock !== block);
  const optStyle = { backgroundColor: t.surface, color: t.text };
  // A paper may carry a module name that isn't in the master list — keep it selectable.
  const orphan = current && !MASTER_MODULES.some((m) => m.name === current) ? current : null;
  return (
    <>
      <option value="" style={optStyle}>
        Select a module…
      </option>
      {orphan && (
        <option value={orphan} style={optStyle}>
          {orphan}
        </option>
      )}
      {suggested.length > 0 && (
        <optgroup label={`Block ${block} modules`}>
          {suggested.map((m) => (
            <option key={m.id} value={m.name} style={optStyle}>
              {m.name}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label={suggested.length > 0 ? "Other modules" : "All modules"}>
        {others.map((m) => (
          <option key={m.id} value={m.name} style={optStyle}>
            {m.name}
          </option>
        ))}
      </optgroup>
    </>
  );
}

interface Props {
  paper: FirestorePastPaper;
  t: Theme;
  /** Subheadings already used in other papers — offered as suggestions so spelling stays consistent. */
  knownSubheadings: string[];
  onClose: () => void;
  onNotice: (msg: string) => void;
}

const blankMcq = (): PastPaperMCQItem => ({ q: "", options: ["", "", "", ""], correct: 0, explanation: "" });

export default function PastPaperEditor({ paper, t, knownSubheadings, onClose, onNotice }: Props) {
  const [title, setTitle] = useState(paper.title);
  const [description, setDescription] = useState(paper.description || "");
  const [driveUrl, setDriveUrl] = useState(paper.driveUrl || "");
  const [block, setBlock] = useState(paper.block);
  const [moduleName, setModuleName] = useState(paper.moduleName || "");
  const [subjectId, setSubjectId] = useState<string>(paper.subjectId);
  const [topicName, setTopicName] = useState(paper.topicName || "");
  const [mcqs, setMcqs] = useState<PastPaperMCQItem[]>(() =>
    (paper.mcqs || []).map((m) => ({ ...m, options: [...m.options] }))
  );
  const [bulkText, setBulkText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bulkParsed = useMemo(() => parseBracketFormat(bulkText), [bulkText]);
  const bulkValid = bulkParsed.filter((p) => p.status !== "error" && p.q && p.options && p.correct !== undefined);
  const bulkErrors = bulkParsed.filter((p) => p.status === "error");

  const inputStyle = { backgroundColor: t.surface, border: `1.5px solid ${t.border}`, color: t.text };
  const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wider";

  const patchMcq = (i: number, patch: Partial<PastPaperMCQItem>) =>
    setMcqs((list) => list.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const patchOption = (qi: number, oi: number, value: string) =>
    setMcqs((list) =>
      list.map((m, idx) => (idx === qi ? { ...m, options: m.options.map((o, j) => (j === oi ? value : o)) } : m))
    );
  const addOption = (qi: number) =>
    setMcqs((list) => list.map((m, idx) => (idx === qi ? { ...m, options: [...m.options, ""] } : m)));
  const removeOption = (qi: number, oi: number) =>
    setMcqs((list) =>
      list.map((m, idx) => {
        if (idx !== qi || m.options.length <= 2) return m;
        const options = m.options.filter((_, j) => j !== oi);
        // keep `correct` pointing at the same answer after the removal
        const correct = m.correct === oi ? 0 : m.correct > oi ? m.correct - 1 : m.correct;
        return { ...m, options, correct };
      })
    );
  const removeMcq = (i: number) => setMcqs((list) => list.filter((_, idx) => idx !== i));

  const appendBulk = () => {
    if (bulkValid.length === 0) return;
    setMcqs((list) => [
      ...list,
      ...bulkValid.map((v) => ({
        q: v.q as string,
        options: v.options as string[],
        correct: v.correct as number,
        explanation: v.explanation || "",
      })),
    ]);
    setBulkText("");
  };

  // ---- validation ----
  const mcqProblem = (m: PastPaperMCQItem): string | null => {
    if (!m.q.trim()) return "Question text is empty";
    if (m.options.some((o) => !o.trim())) return "Fill in or remove empty options";
    if (m.correct < 0 || m.correct >= m.options.length) return "Pick the correct option";
    return null;
  };
  const problems = mcqs.map(mcqProblem);
  const hasMcqProblem = problems.some(Boolean);

  const placementOk = !!moduleName.trim() && !!topicName.trim();
  const hasContent = driveUrl.trim().length > 0 || mcqs.length > 0;
  const canSave = title.trim().length > 0 && placementOk && hasContent && !hasMcqProblem && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const cleanMcqs = mcqs.map((m) => ({
        q: m.q.trim(),
        options: m.options.map((o) => o.trim()),
        correct: m.correct,
        ...(m.explanation?.trim() ? { explanation: m.explanation.trim() } : {}),
      }));
      const result = await updatePastPaper(paper.id, {
        title: title.trim(),
        description: description.trim(),
        driveUrl: driveUrl.trim(),
        mcqs: cleanMcqs,
        block,
        moduleName: moduleName.trim(),
        subjectId,
        topicName: topicName.trim(),
      });
      onNotice(
        result.source === "firestore"
          ? `Saved changes to "${title.trim().slice(0, 40)}".`
          : `Saved locally only: ${result.message}`
      );
      onClose();
    } catch {
      setError("Couldn't save your changes. Check your connection / admin access and try again.");
      setSaving(false);
    }
  };

  const datalistId = `pp-subheadings-${paper.id}`;

  return (
    <Card t={t} style={{ backgroundColor: t.surface, border: `1.5px solid ${t.purple}` }}>
      <div className="mb-4 flex items-center justify-between border-b pb-3" style={{ borderColor: t.border }}>
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>Edit Past Paper</span>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: t.surfaceAlt }}
          aria-label="Close editor"
        >
          <X size={16} />
        </button>
      </div>

      {/* ---- Placement: Block -> Module -> Subject -> Subheading ---- */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls} style={{ color: t.textFaint }}>1 · Block</label>
          <select
            value={block}
            onChange={(e) => setBlock(Number(e.target.value))}
            className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
            style={inputStyle}
          >
            {Array.from({ length: TOTAL_BLOCKS }, (_, i) => i + 1).map((b) => (
              <option key={b} value={b}>Block {b}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} style={{ color: t.textFaint }}>2 · Module</label>
          <select
            value={moduleName}
            onChange={(e) => setModuleName(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
            style={{ ...inputStyle, borderColor: moduleName ? t.border : t.red }}
          >
            <ModuleOptions block={block} t={t} current={moduleName} />
          </select>
        </div>
        <div>
          <label className={labelCls} style={{ color: t.textFaint }}>3 · Subject</label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
            style={inputStyle}
          >
            {SUBJECT_LIST.map((s) => (
              <option key={s} value={s}>{SUBJECT_META[s as SubjectId].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} style={{ color: t.textFaint }}>4 · Subheading</label>
          <input
            type="text"
            list={datalistId}
            value={topicName}
            onChange={(e) => setTopicName(e.target.value)}
            placeholder="e.g. Heart"
            className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
            style={{ ...inputStyle, borderColor: topicName.trim() ? t.border : t.red }}
          />
          <datalist id={datalistId}>
            {knownSubheadings.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      </div>

      {/* ---- Details ---- */}
      <div className="mt-4 flex flex-col gap-3">
        <div>
          <label className={labelCls} style={{ color: t.textFaint }}>Paper title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
            style={inputStyle}
          />
        </div>
        <div>
          <label className={labelCls} style={{ color: t.textFaint }}>Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={inputStyle}
          />
        </div>
        <div>
          <label className={labelCls} style={{ color: t.textFaint }}>Google Drive link (optional if it has MCQs)</label>
          <input
            type="text"
            value={driveUrl}
            onChange={(e) => setDriveUrl(e.target.value)}
            placeholder="https://drive.google.com/file/d/.../view"
            className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
            style={inputStyle}
          />
        </div>
      </div>

      {/* ---- MCQs ---- */}
      <div className="mt-5 border-t pt-4" style={{ borderColor: t.border }}>
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-bold" style={{ fontFamily: FONT_DISPLAY }}>
            <ListChecks size={15} color={t.purple} /> MCQs ({mcqs.length})
          </span>
          <button
            onClick={() => setMcqs((l) => [...l, blankMcq()])}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold"
            style={{ backgroundColor: t.surfaceAlt, color: t.teal, border: `1.5px solid ${t.border}` }}
          >
            <Plus size={13} /> Add MCQ
          </button>
        </div>

        {mcqs.length === 0 && (
          <p className="rounded-xl p-3 text-xs" style={{ backgroundColor: t.surfaceAlt, color: t.textMuted }}>
            No MCQs on this paper. Add one above, or paste more below.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {mcqs.map((m, qi) => (
            <div
              key={qi}
              className="rounded-xl p-3"
              style={{
                backgroundColor: t.surfaceAlt,
                border: `1.5px solid ${problems[qi] ? t.red : t.border}`,
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: t.textMuted }}>Q{qi + 1}</span>
                <button
                  onClick={() => removeMcq(qi)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold"
                  style={{ backgroundColor: `${t.red}15`, color: t.red }}
                  title="Remove this MCQ"
                >
                  <Trash2 size={12} /> Remove
                </button>
              </div>
              <textarea
                value={m.q}
                onChange={(e) => patchMcq(qi, { q: e.target.value })}
                rows={2}
                placeholder="Question"
                className="w-full resize-y rounded-lg px-3 py-2 text-sm font-semibold outline-none"
                style={inputStyle}
              />
              <div className="mt-2 flex flex-col gap-1.5">
                {m.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <button
                      onClick={() => patchMcq(qi, { correct: oi })}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: m.correct === oi ? `${t.green}25` : t.surface,
                        border: `1.5px solid ${m.correct === oi ? t.green : t.border}`,
                      }}
                      title={m.correct === oi ? "Correct answer" : "Mark as correct"}
                    >
                      {m.correct === oi && <CheckCircle2 size={14} color={t.green} />}
                    </button>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => patchOption(qi, oi, e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                      className="min-w-0 flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
                      style={inputStyle}
                    />
                    <button
                      onClick={() => removeOption(qi, oi)}
                      disabled={m.options.length <= 2}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg disabled:opacity-30"
                      style={{ backgroundColor: t.surface }}
                      title="Remove option"
                    >
                      <X size={13} color={t.textMuted} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addOption(qi)}
                  className="flex w-fit items-center gap-1 text-[11px] font-bold"
                  style={{ color: t.teal }}
                >
                  <Plus size={12} /> Add option
                </button>
              </div>
              <textarea
                value={m.explanation || ""}
                onChange={(e) => patchMcq(qi, { explanation: e.target.value })}
                rows={2}
                placeholder="Explanation (optional)"
                className="mt-2 w-full resize-y rounded-lg px-3 py-2 text-xs outline-none"
                style={inputStyle}
              />
              {problems[qi] && (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold" style={{ color: t.red }}>
                  <AlertTriangle size={11} /> {problems[qi]}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Paste more in bracket format */}
        <div className="mt-4">
          <label className={labelCls} style={{ color: t.textFaint }}>Paste more MCQs (bracket format)</label>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={4}
            placeholder="[Question ; Opt A | *Opt B | Opt C | Opt D ; Explanation]"
            className="w-full resize-y rounded-xl p-3 font-mono text-xs outline-none"
            style={inputStyle}
          />
          {bulkText.trim() && (
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs" style={{ color: t.textMuted }}>
                <strong style={{ color: bulkValid.length ? t.green : t.textFaint }}>{bulkValid.length} valid</strong>
                {bulkErrors.length > 0 && <span style={{ color: t.red }}> ({bulkErrors.length} errors)</span>}
              </span>
              <button
                onClick={appendBulk}
                disabled={bulkValid.length === 0}
                className="rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                style={{ backgroundColor: t.teal, color: "#fff" }}
              >
                Add {bulkValid.length} to paper
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ---- Footer ---- */}
      {!placementOk && (
        <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold" style={{ color: t.red }}>
          <AlertTriangle size={13} /> Pick a module and enter a subheading — every paper needs both.
        </p>
      )}
      {placementOk && !hasContent && (
        <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold" style={{ color: t.red }}>
          <AlertTriangle size={13} /> A paper needs a Drive link or at least one MCQ.
        </p>
      )}
      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold" style={{ color: t.red }}>
          <AlertTriangle size={13} /> {error}
        </p>
      )}
      <div className="mt-4 flex items-center justify-end gap-2">
        <Btn t={t} variant="ghost" onClick={onClose}>
          Cancel
        </Btn>
        <Btn t={t} icon={saving ? Loader2 : Save} disabled={!canSave} onClick={handleSave}>
          {saving ? "Saving…" : "Save changes"}
        </Btn>
      </div>
    </Card>
  );
}
