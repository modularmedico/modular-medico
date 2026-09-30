import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus, Trash2, Eye, EyeOff, Loader2, ChevronDown, ChevronUp, X, AlertTriangle, Search, CheckSquare, Square } from "lucide-react";
import Card from "../Card";
import Pill from "../Pill";
import Btn from "../Btn";
import { FONT_DISPLAY, FONT_MONO, type ThemeTokens } from "../../theme";
import { MASTER_MODULES, SUBJECT_LIST, SUBJECT_META, TOTAL_BLOCKS } from "../../data/subjects";
import { subscribeScopedQuestions } from "../../services/adminContent";
import {
  addQuestionsToTestSession,
  createTestSession,
  deleteTestSession,
  removeQuestionFromTestSession,
  setTestSessionStatus,
  subscribeAllTestSessions,
} from "../../services/testSessions";
import type { Difficulty, FirestoreQuestion, QuestionStatus, TestSessionDoc, TestSessionQuestion } from "../../types";

const NO_TOPIC = "General / No topic";
const topicOf = (q: FirestoreQuestion) => q.topicName || q.subheadingName || NO_TOPIC;
const subjectLabel = (id: string) => SUBJECT_META[id as keyof typeof SUBJECT_META]?.label || id;
// Same slug scheme used everywhere else this app derives a moduleId from a Module
// name (see AdminPanel's Manage MCQs Module filter and the Add-MCQ form) — this is
// the actual format stored on FirestoreQuestion.moduleId. The old build here instead
// pulled "mod-4"-style ids out of DEFAULT_BLOCK_DEFINITIONS, which never matches a
// real question in Firestore, so the pool always came back empty.
const moduleSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

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
  // Filters — deliberately the same shape as the Manage MCQs screen (Block,
  // Module, Subject, Difficulty, Status, Subheading, search), and Block + Module
  // + Subject are all required before anything loads, exactly like Manage MCQs'
  // manageScopeReady gate. This is what makes the pool line up with what Manage
  // MCQs shows: previously this screen built its Module dropdown from
  // block_definitions/DEFAULT_BLOCK_DEFINITIONS ("mod-4"-style ids) and queried
  // Firestore with that id, but every question actually stores a slugified-name
  // moduleId (e.g. "cardiovascular-i") the way the Manage MCQs and Add-MCQ forms
  // create it — so the query always matched zero documents and both the MCQ list
  // and the Subheading dropdown (built from that same empty pool) came back empty.
  const [block, setBlock] = useState<number>(0);
  const [moduleId, setModuleId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const [status, setStatus] = useState<QuestionStatus | "all">("all");
  const [topic, setTopic] = useState("all");
  const [search, setSearch] = useState("");
  const [pool, setPool] = useState<FirestoreQuestion[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [showList, setShowList] = useState(false);

  const moduleName = MASTER_MODULES.find((m) => m.id === moduleId)?.name || "";
  const scopeReady = !!block && !!moduleId && !!subjectId;

  // Reset the dependent pickers whenever a parent one changes.
  useEffect(() => {
    setModuleId("");
  }, [block]);
  useEffect(() => {
    setSubjectId("");
  }, [moduleId]);
  useEffect(() => {
    setTopic("all");
  }, [moduleId, subjectId]);

  // Same live subscribeScopedQuestions listener the Manage MCQs tab uses (all
  // statuses — Status is then just another client-side filter below, matching
  // Manage MCQs) instead of a published-only fetch, so this always sees exactly
  // what Manage MCQs sees for the same Block/Module/Subject.
  useEffect(() => {
    if (!scopeReady) {
      setPool([]);
      return;
    }
    setPoolLoading(true);
    const unsub = subscribeScopedQuestions(
      subjectId,
      moduleId,
      block,
      (list) => {
        setPool(list);
        setPoolLoading(false);
      },
      () => setPoolLoading(false)
    );
    return () => unsub();
  }, [scopeReady, block, moduleId, subjectId]);

  const alreadyIn = useMemo(() => new Set(test.questions.map((q) => q.sourceId)), [test.questions]);

  // Clear any selection that's no longer valid whenever the scope changes.
  useEffect(() => {
    setSelected(new Set());
  }, [block, moduleId, subjectId]);

  const availableTopicNames = useMemo(() => {
    const names = new Set<string>();
    pool.forEach((q) => {
      if (alreadyIn.has(q.id)) return;
      names.add(topicOf(q));
    });
    return Array.from(names).sort();
  }, [pool, alreadyIn]);

  const filtered = useMemo(() => {
    return pool.filter((q) => {
      if (alreadyIn.has(q.id)) return false;
      if (difficulty !== "all" && q.difficulty !== difficulty) return false;
      if (status !== "all" && q.status !== status) return false;
      if (topic !== "all" && topicOf(q) !== topic) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        const inQ = q.q.toLowerCase().includes(s);
        const inOpts = q.options.some((o) => o.toLowerCase().includes(s));
        const inExp = q.explanation?.toLowerCase().includes(s);
        const inSub = topicOf(q).toLowerCase().includes(s);
        if (!inQ && !inOpts && !inExp && !inSub) return false;
      }
      return true;
    });
  }, [pool, alreadyIn, difficulty, status, topic, search]);

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = filtered.length > 0 && filtered.every((q) => selected.has(q.id));
  const toggleSelectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filtered.forEach((q) => next.delete(q.id));
      } else {
        filtered.forEach((q) => next.add(q.id));
      }
      return next;
    });
  };

  const handleAdd = async () => {
    if (selected.size === 0 || adding) return;
    setAdding(true);
    try {
      const picked = pool.filter((q) => selected.has(q.id));
      const snapshot: TestSessionQuestion[] = picked.map((q) => ({
        sourceId: q.id,
        q: q.q,
        options: q.options,
        correct: q.correct,
        explanation: q.explanation || "",
        subjectId: q.subjectId,
        moduleId: q.moduleId,
        moduleName: q.moduleName || moduleName,
        block: q.block,
        topicName: q.topicName || q.subheadingName || null,
      }));
      await addQuestionsToTestSession(test, snapshot, {
        block,
        moduleName,
        subjectId: subjectId || null,
        topicName: topic !== "all" ? topic : null,
        count: snapshot.length,
      });
      setSelected(new Set());
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
          Same Block / Module / Subject / Subheading scope as Manage MCQs. Pick a Block, Module and Subject, then
          tick the MCQs you want and add them.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search question text, options, or subheading..."
          className="w-full rounded-2xl pl-9 pr-4 py-2.5 text-sm outline-none"
          style={selectStyle}
        />
        <Search size={15} className="absolute left-3 top-3" color={t.textFaint} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
            {MASTER_MODULES.map((m) => (
              <option key={m.id} value={moduleSlug(m.name)}>{m.name}</option>
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
            <option value="">Select a Subject&hellip;</option>
            {SUBJECT_LIST.map((s) => (
              <option key={s} value={s}>{subjectLabel(s)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} style={{ color: t.textFaint }}>Difficulty</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty | "all")}
            className="w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none"
            style={selectStyle}
          >
            <option value="all">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div>
          <label className={labelCls} style={{ color: t.textFaint }}>Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as QuestionStatus | "all")}
            className="w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none"
            style={selectStyle}
          >
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
        <div>
          <label className={labelCls} style={{ color: t.textFaint }}>Subheading</label>
          {poolLoading ? (
            <div
              className="flex w-full items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold"
              style={{ ...selectStyle, color: t.textFaint }}
            >
              <Loader2 size={13} className="animate-spin" /> Loading&hellip;
            </div>
          ) : (
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={!scopeReady}
              className="w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none disabled:opacity-50"
              style={selectStyle}
            >
              <option value="all">All Subheadings</option>
              {availableTopicNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Results bar + bulk select */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-bold" style={{ color: t.textMuted }}>
          {!scopeReady
            ? "Pick a Block, Module, and Subject above to load its MCQs"
            : poolLoading
            ? "Loading MCQs…"
            : `Showing ${filtered.length} MCQs · ${selected.size} selected`}
        </span>
        {scopeReady && filtered.length > 0 && (
          <button
            onClick={toggleSelectAllVisible}
            className="flex items-center gap-1.5 text-xs font-bold"
            style={{ color: t.teal }}
          >
            {allVisibleSelected ? <CheckSquare size={14} /> : <Square size={14} />}
            {allVisibleSelected ? "Unselect all shown" : "Select all shown"}
          </button>
        )}
      </div>

      {/* MCQ picker list */}
      {scopeReady && !poolLoading && (
        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-xs" style={{ color: t.textFaint }}>
              No MCQs matched your current filters.
            </p>
          ) : (
            filtered.map((q) => {
              const isSelected = selected.has(q.id);
              return (
                <label
                  key={q.id}
                  className="flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5 text-sm"
                  style={{
                    backgroundColor: isSelected ? `${t.teal}14` : t.surfaceAlt,
                    border: `1.5px solid ${isSelected ? t.teal : t.border}`,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelected(q.id)}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="min-w-0">
                    {q.q}
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px]" style={{ color: t.textFaint }}>
                      <span>B{q.block} · {q.moduleName || moduleName} · {subjectLabel(q.subjectId)} · {topicOf(q)}</span>
                      <Pill t={t} tone={q.status === "published" ? "green" : "muted"}>{q.status}</Pill>
                      <Pill t={t} tone="muted">{q.difficulty}</Pill>
                    </div>
                  </div>
                </label>
              );
            })
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Btn
          t={t}
          icon={adding ? Loader2 : Plus}
          spin={adding}
          disabled={selected.size === 0 || adding}
          onClick={handleAdd}
        >
          Add {selected.size > 0 ? selected.size : ""} MCQ{selected.size !== 1 ? "s" : ""} to test
        </Btn>
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
