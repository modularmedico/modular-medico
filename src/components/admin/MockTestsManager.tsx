import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Plus, Trash2, Eye, EyeOff, Loader2, ChevronDown, ChevronUp, AlertTriangle, Pencil, Check, X } from "lucide-react";
import Card from "../Card";
import Pill from "../Pill";
import Btn from "../Btn";
import { TestEditor } from "./TestSessionsManager";
import { FONT_DISPLAY, FONT_MONO, type ThemeTokens } from "../../theme";
import { TOTAL_BLOCKS } from "../../data/subjects";
import {
  addQuestionsToMockTest,
  createMockTest,
  deleteMockTest,
  removeQuestionFromMockTest,
  renameMockTest,
  setMockTestStatus,
  subscribeAllMockTests,
} from "../../services/mockTests";
import type { MockTestDoc, TestSessionDoc, TestSessionQuestion, TestSessionSource } from "../../types";

/**
 * Admin > Mock Tests. Pick a Block (1-15), create "Mock Test 1", "Mock Test 2"..., fill each with
 * MCQs from the question bank, then take it live. Students see them under Tests > Mock Tests.
 */
export default function MockTestsManager({ t }: { t: ThemeTokens }) {
  const [mocks, setMocks] = useState<MockTestDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [block, setBlock] = useState(1);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  useEffect(
    () =>
      subscribeAllMockTests(
        (list) => {
          setMocks(list);
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

  const inBlock = useMemo(() => mocks.filter((m) => m.block === block), [mocks, block]);
  const nextOrder = inBlock.reduce((mx, m) => Math.max(mx, m.order), 0) + 1;
  const suggestedName = `Mock Test ${nextOrder}`;

  const ok = (text: string) => setNotice({ tone: "ok", text });
  const err = (e: unknown) =>
    setNotice({ tone: "err", text: e instanceof Error ? e.message : "Something went wrong. Check your admin permissions." });

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const id = await createMockTest(block, name.trim() || suggestedName, nextOrder);
      setName("");
      setOpenId(id);
      ok(`Created in Block ${block}. Now add MCQs to it below.`);
    } catch (e) {
      err(e);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (m: MockTestDoc) => {
    if (!window.confirm(`Delete "${m.name}" (Block ${m.block}) and its ${m.questions.length} MCQs? This cannot be undone.`)) return;
    try {
      await deleteMockTest(m.id);
      if (openId === m.id) setOpenId(null);
      ok(`Deleted "${m.name}".`);
    } catch (e) {
      err(e);
    }
  };

  const handleToggleLive = async (m: MockTestDoc) => {
    try {
      await setMockTestStatus(m.id, m.status === "published" ? "draft" : "published");
      ok(m.status === "published" ? `"${m.name}" hidden from students.` : `"${m.name}" is now live in Block ${m.block}.`);
    } catch (e) {
      err(e);
    }
  };

  const handleRename = async (m: MockTestDoc) => {
    try {
      await renameMockTest(m.id, renameValue);
      setRenamingId(null);
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
            Couldn't load mock tests ({loadError}). Deploy the updated <code>firestore.rules</code> (they add the
            <code> mock_tests</code> collection) and make sure your account has the admin claim.
          </span>
        </div>
      )}

      {/* Block picker */}
      <Card t={t}>
        <div className="mb-3 flex items-center gap-2">
          <ClipboardCheck size={18} color={t.teal} />
          <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18 }}>Mock tests by Block</h2>
        </div>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
          {Array.from({ length: TOTAL_BLOCKS }, (_, i) => i + 1).map((b) => {
            const n = mocks.filter((m) => m.block === b).length;
            const active = b === block;
            return (
              <button
                key={b}
                onClick={() => {
                  setBlock(b);
                  setOpenId(null);
                }}
                className="flex flex-col items-center rounded-xl px-2 py-2 text-xs font-bold transition-all"
                style={{
                  backgroundColor: active ? t.purpleStrong : t.surfaceAlt,
                  color: active ? "#fff" : t.text,
                  border: `1.5px solid ${active ? t.purpleStrong : t.border}`,
                }}
              >
                <span>Block {b}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 10, opacity: 0.8 }}>{n} mock{n === 1 ? "" : "s"}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Create */}
      <Card t={t}>
        <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
          Add a mock test to Block {block}
        </h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder={suggestedName}
            maxLength={80}
            className="w-full flex-1 rounded-2xl px-4 py-3 text-sm outline-none"
            style={inputStyle}
          />
          <Btn t={t} icon={creating ? Loader2 : Plus} spin={creating} disabled={creating} onClick={handleCreate}>
            Create {name.trim() || suggestedName}
          </Btn>
        </div>
        <p className="mt-2 text-xs" style={{ color: t.textFaint }}>
          Leave the name empty to use the next number automatically. New mock tests start hidden — add MCQs, then go live.
        </p>
      </Card>

      {/* This block's mock tests */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: t.textMuted }}>
          <Loader2 size={16} className="animate-spin" /> Loading mock tests&hellip;
        </div>
      ) : inBlock.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: t.textMuted }}>
          No mock tests in Block {block} yet. Create the first one above.
        </p>
      ) : (
        inBlock.map((m) => {
          const open = openId === m.id;
          const live = m.status === "published";
          const renaming = renamingId === m.id;
          return (
            <Card key={m.id} t={t} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  {renaming ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(m);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        maxLength={80}
                        className="rounded-xl px-3 py-1.5 text-sm outline-none"
                        style={inputStyle}
                      />
                      <button onClick={() => handleRename(m)} aria-label="Save name"><Check size={16} color={t.green} /></button>
                      <button onClick={() => setRenamingId(null)} aria-label="Cancel"><X size={16} color={t.textFaint} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17 }} className="truncate">
                        {m.name}
                      </div>
                      <button
                        onClick={() => {
                          setRenamingId(m.id);
                          setRenameValue(m.name);
                        }}
                        aria-label="Rename"
                        title="Rename"
                      >
                        <Pencil size={13} color={t.textFaint} />
                      </button>
                    </div>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Pill t={t} tone={live ? "green" : "muted"}>{live ? "Live" : "Hidden (draft)"}</Pill>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: t.textMuted }}>
                      {m.questions.length} MCQ{m.questions.length !== 1 ? "s" : ""} · {m.questions.length} min
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Btn
                    t={t}
                    variant="ghost"
                    icon={live ? EyeOff : Eye}
                    disabled={!live && m.questions.length === 0}
                    onClick={() => handleToggleLive(m)}
                    style={{ padding: "8px 14px" }}
                  >
                    {live ? "Hide" : "Go live"}
                  </Btn>
                  <Btn
                    t={t}
                    variant="ghost"
                    icon={open ? ChevronUp : ChevronDown}
                    onClick={() => setOpenId(open ? null : m.id)}
                    style={{ padding: "8px 14px" }}
                  >
                    {open ? "Close" : "Manage"}
                  </Btn>
                  <Btn t={t} variant="danger" icon={Trash2} onClick={() => handleDelete(m)} style={{ padding: "8px 14px" }}>
                    Delete
                  </Btn>
                </div>
              </div>

              {open && (
                <TestEditor
                  t={t}
                  test={m as TestSessionDoc}
                  noun="mock test"
                  onNotice={setNotice}
                  onAdd={(test: TestSessionDoc, added: TestSessionQuestion[], source: TestSessionSource) =>
                    addQuestionsToMockTest(test as MockTestDoc, added, source)
                  }
                  onRemove={(test: TestSessionDoc, sourceId: string) => removeQuestionFromMockTest(test as MockTestDoc, sourceId)}
                />
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
