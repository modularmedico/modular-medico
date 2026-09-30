import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus, Trash2, Eye, EyeOff, Loader2, ChevronDown, ChevronUp, X, AlertTriangle } from "lucide-react";
import Card from "../Card";
import Pill from "../Pill";
import Btn from "../Btn";
import { FONT_DISPLAY, FONT_MONO, type ThemeTokens } from "../../theme";
import { DEFAULT_BLOCK_DEFINITIONS, SUBJECT_META, TOTAL_BLOCKS, type BlockDefinition } from "../../data/subjects";
import {
  fetchPublishedBlock,
  fetchPublishedModuleExam,
  subscribeBlockDefinitions,
} from "../../services/adminContent";
import {
  addQuestionsToTestSession,
  createTestSession,
  deleteTestSession,
  removeQuestionFromTestSession,
  setTestSessionStatus,
  subscribeAllTestSessions,
} from "../../services/testSessions";
import type { FirestoreQuestion, TestSessionDoc, TestSessionQuestion } from "../../types";

const NO_TOPIC = "General / No topic";
const topicOf = (q: FirestoreQuestion) => q.topicName || q.subheadingName || NO_TOPIC;
const subjectLabel = (id: string) => SUBJECT_META[id as keyof typeof SUBJECT_META]?.label || id;

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function TestSessionsManager({ t }: { t: ThemeTokens }) {
  const [tests, setTests] = useState<TestSessionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  useEffect(
    () =>
      subscribeAllTestSessions(
        (list) => {
          setTests(list);
          setLoading(false);
          setLoadError(null);
        },
        (msg) => {
          setLoadError(msg);
          setLoading(false);
        }
      ),
    []
  );

  const ok = (text: string) => setNotice({ tone: "ok", text });
  const err = (e: unknown) =>
    setNotice({ tone: "err", text: e instanceof Error ? e.message : "Something went wrong. Check your admin permissions." });

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const id = await createTestSession(newName);
      setNewName("");
      setOpenId(id);
      ok("Test created. Now add MCQs to it below.");
    } catch (e) {
      err(e);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (test: TestSessionDoc) => {
    if (!window.confirm(`Delete "${test.name}" and its ${test.questions.length} MCQs? This cannot be undone.`)) return;
    try {
      await deleteTestSession(test.id);
      if (openId === test.id) setOpenId(null);
      ok(`Deleted "${test.name}".`);
    } catch (e) {
      err(e);
    }
  };

  const handleToggleLive = async (test: TestSessionDoc) => {
    try {
      await setTestSessionStatus(test.id, test.status === "published" ? "draft" : "published");
      ok(test.status === "published" ? `"${test.name}" hidden from students.` : `"${test.name}" is now live for students.`);
    } catch (e) {
      err(e);
    }
  };

  const inputStyle = { backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text };

  return (
    <div className="flex flex-col gap-6">
      {notice && (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold"
          style={{
            backgroundColor: `${notice.tone === "ok" ? t.teal : t.red}22`,
            border: `1.5px solid ${notice.tone === "ok" ? t.teal : t.red}`,
            color: notice.tone === "ok" ? t.teal : t.red,
          }}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="text-xs opacity-75 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {loadError && (
        <div
          className="flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-bold"
          style={{ backgroundColor: `${t.amber}20`, border: `1.5px solid ${t.amber}`, color: t.amber }}
        >
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Couldn't load test sessions ({loadError}). Deploy the updated <code>firestore.rules</code> (they add the
            <code> test_sessions</code> collection) and make sure your account has the admin claim.
          </span>
        </div>
      )}

      {/* Create a test */}
      <Card t={t}>
        <div className="mb-3 flex items-center gap-2">
          <ClipboardList size={18} color={t.teal} />
          <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18 }}>Create a test session</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder='Test name, e.g. "Cardiovascular Weekly Test 1"'
            maxLength={80}
            className="w-full flex-1 rounded-2xl px-4 py-3 text-sm outline-none"
            style={inputStyle}
          />
          <Btn t={t} icon={creating ? Loader2 : Plus} spin={creating} disabled={!newName.trim() || creating} onClick={handleCreate}>
            Create test
          </Btn>
        </div>
        <p className="mt-2 text-xs" style={{ color: t.textFaint }}>
          New tests start hidden. Add MCQs, then switch the test live so students see it on the homepage and the Test tab.
        </p>
      </Card>

      {/* Existing tests */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: t.textMuted }}>
          <Loader2 size={16} className="animate-spin" /> Loading tests&hellip;
        </div>
      ) : tests.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: t.textMuted }}>
          No test sessions yet. Create your first one above.
        </p>
      ) : (
        tests.map((test) => {
          const open = openId === test.id;
          const live = test.status === "published";
          return (
            <Card key={test.id} t={t} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17 }} className="truncate">
                    {test.name}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Pill t={t} tone={live ? "green" : "muted"}>
                      {live ? "Live" : "Hidden (draft)"}
                    </Pill>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: t.textMuted }}>
                      {test.questions.length} MCQ{test.questions.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Btn
                    t={t}
                    variant="ghost"
                    icon={live ? EyeOff : Eye}
                    disabled={!live && test.questions.length === 0}
                    onClick={() => handleToggleLive(test)}
                    style={{ padding: "8px 14px" }}
                  >
                    {live ? "Hide" : "Go live"}
                  </Btn>
                  <Btn
                    t={t}
                    variant="ghost"
                    icon={open ? ChevronUp : ChevronDown}
                    onClick={() => setOpenId(open ? null : test.id)}
                    style={{ padding: "8px 14px" }}
                  >
                    {open ? "Close" : "Manage"}
                  </Btn>
                  <Btn t={t} variant="danger" icon={Trash2} onClick={() => handleDelete(test)} style={{ padding: "8px 14px" }}>
                    Delete
                  </Btn>
                </div>
              </div>

              {open && <TestEditor t={t} test={test} onNotice={setNotice} />}
            </Card>
          );
        })
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Add-MCQs builder + contents of one test                                     */
/* -------------------------------------------------------------------------- */

function TestEditor({
  t,
  test,
  onNotice,
}: {
  t: ThemeTokens;
  test: TestSessionDoc;
  onNotice: (n: { tone: "ok" | "err"; text: string } | null) => void;
}) {
  const [blockDefs, setBlockDefs] = useState<BlockDefinition[]>(DEFAULT_BLOCK_DEFINITIONS);
  const [block, setBlock] = useState<number>(0);
  const [moduleId, setModuleId] = useState("");
  const [subjectId, setSubjectId] = useState(""); // "" = all subjects in the module
  const [topic, setTopic] = useState(""); // "" = all topics
  const [quantity, setQuantity] = useState(10);
  const [pool, setPool] = useState<FirestoreQuestion[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showList, setShowList] = useState(false);

  useEffect(() => subscribeBlockDefinitions(setBlockDefs), []);

  const blockDef = blockDefs.find((b) => b.block === block);
  const modules = blockDef?.modules || [];
  const moduleDef = modules.find((m) => m.id === moduleId);

  // Reset the dependent pickers whenever a parent one changes.
  useEffect(() => {
    setModuleId("");
  }, [block]);
  useEffect(() => {
    setSubjectId("");
  }, [moduleId]);
  useEffect(() => {
    setTopic("");
  }, [moduleId, subjectId]);

  // Load the published MCQs for the chosen scope (cached by the existing fetchers).
  useEffect(() => {
    if (!block || !moduleId) {
      setPool([]);
      return;
    }
    let cancelled = false;
    setPoolLoading(true);
    const load = subjectId
      ? fetchPublishedBlock(subjectId, moduleId, block)
      : fetchPublishedModuleExam(block, moduleId);
    load
      .then((list) => !cancelled && setPool(list))
      .catch(() => !cancelled && setPool([]))
      .finally(() => !cancelled && setPoolLoading(false));
    return () => {
      cancelled = true;
    };
  }, [block, moduleId, subjectId]);

  const alreadyIn = useMemo(() => new Set(test.questions.map((q) => q.sourceId)), [test.questions]);

  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>();
    pool.forEach((q) => {
      if (alreadyIn.has(q.id)) return;
      counts.set(topicOf(q), (counts.get(topicOf(q)) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [pool, alreadyIn]);

  const available = useMemo(
    () => pool.filter((q) => !alreadyIn.has(q.id) && (!topic || topicOf(q) === topic)),
    [pool, alreadyIn, topic]
  );

  const qty = Math.max(0, Math.min(quantity || 0, available.length));

  const handleAdd = async () => {
    if (!moduleDef || qty === 0 || adding) return;
    setAdding(true);
    try {
      const picked = shuffle(available).slice(0, qty);
      const snapshot: TestSessionQuestion[] = picked.map((q) => ({
        sourceId: q.id,
        q: q.q,
        options: q.options,
        correct: q.correct,
        explanation: q.explanation || "",
        subjectId: q.subjectId,
        moduleId: q.moduleId,
        moduleName: q.moduleName || moduleDef.name,
        block: q.block,
        topicName: q.topicName || q.subheadingName || null,
      }));
      await addQuestionsToTestSession(test, snapshot, {
        block,
        moduleName: moduleDef.name,
        subjectId: subjectId || null,
        topicName: topic || null,
        count: snapshot.length,
      });
      onNotice({ tone: "ok", text: `Added ${snapshot.length} MCQ${snapshot.length !== 1 ? "s" : ""} to "${test.name}".` });
    } catch (e) {
      onNotice({ tone: "err", text: e instanceof Error ? e.message : "Couldn't add MCQs." });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (sourceId: string) => {
    try {
      await removeQuestionFromTestSession(test, sourceId);
    } catch (e) {
      onNotice({ tone: "err", text: e instanceof Error ? e.message : "Couldn't remove that MCQ." });
    }
  };

  const selectStyle = { backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text };
  const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wider";

  return (
    <div className="flex flex-col gap-5 border-t pt-4" style={{ borderColor: t.border }}>
      <div>
        <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>Add MCQs from the question bank</h3>
        <p className="text-xs" style={{ color: t.textFaint, marginTop: 2 }}>
          MCQs are picked at random from published questions and never added twice.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className={labelCls} style={{ color: t.textFaint }}>Block</label>
          <select
            value={block}
            onChange={(e) => setBlock(Number(e.target.value))}
            className="w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none"
            style={selectStyle}
          >
            <option value={0}>Select a Block&hellip;</option>
            {Array.from({ length: TOTAL_BLOCKS }, (_, i) => i + 1).map((b) => (
              <option key={b} value={b}>Block {b}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} style={{ color: t.textFaint }}>Module</label>
          <select
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value)}
            disabled={!block}
            className="w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none disabled:opacity-50"
            style={selectStyle}
          >
            <option value="">Select a Module&hellip;</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} style={{ color: t.textFaint }}>Subject</label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            disabled={!moduleId}
            className="w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none disabled:opacity-50"
            style={selectStyle}
          >
            <option value="">All subjects</option>
            {(moduleDef?.subjects || []).map((s) => (
              <option key={s} value={s}>{subjectLabel(s)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} style={{ color: t.textFaint }}>Subheading</label>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={!moduleId || poolLoading}
            className="w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none disabled:opacity-50"
            style={selectStyle}
          >
            <option value="">All subheadings</option>
            {topicCounts.map(([name, n]) => (
              <option key={name} value={name}>{name} ({n})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-28">
          <label className={labelCls} style={{ color: t.textFaint }}>Quantity</label>
          <input
            type="number"
            min={1}
            max={Math.max(1, available.length)}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full rounded-xl px-2.5 py-2 text-sm outline-none"
            style={{ ...selectStyle, fontFamily: FONT_MONO }}
          />
        </div>
        <Btn
          t={t}
          icon={adding ? Loader2 : Plus}
          spin={adding}
          disabled={!moduleId || poolLoading || qty === 0 || adding}
          onClick={handleAdd}
        >
          Add {qty > 0 ? qty : ""} MCQ{qty !== 1 ? "s" : ""}
        </Btn>
        <span className="pb-3 text-xs" style={{ color: t.textFaint }}>
          {!moduleId
            ? "Pick a Block and Module to see what's available."
            : poolLoading
            ? "Loading MCQs…"
            : `${available.length} published MCQ${available.length !== 1 ? "s" : ""} available in this selection.`}
        </span>
      </div>

      {/* What's already in the test */}
      <div className="flex flex-col gap-3 border-t pt-4" style={{ borderColor: t.border }}>
        <div className="flex items-center justify-between">
          <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>
            In this test ({test.questions.length})
          </h3>
          {test.questions.length > 0 && (
            <button onClick={() => setShowList(!showList)} className="text-xs font-bold" style={{ color: t.teal }}>
              {showList ? "Hide MCQs" : "Review MCQs"}
            </button>
          )}
        </div>

        {test.sources.length === 0 ? (
          <p className="text-xs" style={{ color: t.textFaint }}>No MCQs added yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {test.sources.map((s, i) => (
              <Pill key={i} t={t} tone="purple">
                B{s.block} · {s.moduleName}
                {s.subjectId ? ` · ${subjectLabel(s.subjectId)}` : ""}
                {s.topicName ? ` · ${s.topicName}` : ""} — {s.count}
              </Pill>
            ))}
          </div>
        )}

        {showList && (
          <div className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
            {test.questions.map((q, i) => (
              <div
                key={q.sourceId}
                className="flex items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-sm"
                style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}` }}
              >
                <div className="min-w-0">
                  <span style={{ fontFamily: FONT_MONO, color: t.textFaint, fontSize: 12 }}>{i + 1}. </span>
                  {q.q}
                  <div className="mt-0.5 text-[11px]" style={{ color: t.textFaint }}>
                    B{q.block} · {q.moduleName} · {subjectLabel(q.subjectId)}
                    {q.topicName ? ` · ${q.topicName}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(q.sourceId)}
                  className="shrink-0 rounded-lg p-1 opacity-70 hover:opacity-100"
                  title="Remove from test"
                  aria-label="Remove MCQ from test"
                >
                  <X size={16} color={t.red} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
