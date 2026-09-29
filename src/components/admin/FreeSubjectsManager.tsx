import { useEffect, useState } from "react";
import { Lock, Unlock, Save } from "lucide-react";
import Card from "../Card";
import Btn from "../Btn";
import { THEME, FONT_DISPLAY } from "../../theme";
import { useAppStore } from "../../store/useAppStore";
import { SUBJECT_LIST, SUBJECT_META, DEFAULT_BLOCK_DEFINITIONS, type SubjectId } from "../../data/subjects";
import {
  subscribeBlockDefinitions,
  subscribeBlockOutline,
  subscribeFreeSubjects,
  saveBlockFreeSubjects,
  type FreeSubjectsMap,
} from "../../services/adminContent";
import type { BlockDefinition } from "../../data/subjects";

/**
 * Admin > Manage Access > "Subjects inside a block".
 * Pick a block, then tap each subject to make it Free or Paid.
 * Only subjects that actually have published MCQs in that block are listed.
 */
export default function FreeSubjectsManager() {
  const isDark = useAppStore((s) => s.isDark);
  const t = isDark ? THEME.dark : THEME.light;

  const [blockDefs, setBlockDefs] = useState<BlockDefinition[]>(DEFAULT_BLOCK_DEFINITIONS);
  const [block, setBlock] = useState(1);
  const [saved, setSaved] = useState<FreeSubjectsMap>({});
  const [draft, setDraft] = useState<string[]>([]);
  const [present, setPresent] = useState<string[] | null>(null); // subjects with MCQs in this block
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => subscribeBlockDefinitions(setBlockDefs), []);
  useEffect(() => subscribeFreeSubjects(setSaved), []);

  // Reset the draft whenever the block or the saved data changes.
  useEffect(() => setDraft(saved[block] ?? []), [block, saved]);

  useEffect(() => {
    setPresent(null);
    return subscribeBlockOutline(block, (o) => {
      const ids = new Set<string>();
      o.modules.forEach((m) => m.subjects.forEach((s) => ids.add(s.subjectId)));
      setPresent(SUBJECT_LIST.filter((id) => ids.has(id)));
    });
  }, [block]);

  const toggle = (id: string) =>
    setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  const dirty = JSON.stringify([...draft].sort()) !== JSON.stringify([...(saved[block] ?? [])].sort());

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      await saveBlockFreeSubjects(block, draft);
      setMsg("Saved");
    } catch (e) {
      setMsg("Could not save — check admin permissions");
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const subjects = (present ?? []) as SubjectId[];

  return (
    <Card t={t} className="flex flex-col gap-4 p-5">
      <div>
        <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17 }}>Free subjects inside a block</h3>
        <p style={{ color: t.textMuted, fontSize: 12.5, marginTop: 2 }}>
          The block stays paid; the subjects you mark Free are open to everyone. A block with at least one free
          subject shows no lock on Home.
        </p>
      </div>

      {/* Block picker */}
      <div className="flex flex-wrap gap-1.5">
        {blockDefs.map((b) => {
          const n = saved[b.block]?.length ?? 0;
          const active = b.block === block;
          return (
            <button
              key={b.block}
              onClick={() => setBlock(b.block)}
              className="rounded-xl px-3 py-1.5 text-xs font-bold"
              style={{
                backgroundColor: active ? t.purpleStrong : t.surfaceAlt,
                color: active ? "#fff" : t.text,
                border: `1.5px solid ${active ? t.purpleStrong : t.border}`,
              }}
            >
              B{b.block}
              {n > 0 && <span style={{ color: active ? "#fff" : t.teal }}> · {n} free</span>}
            </button>
          );
        })}
      </div>

      {/* Subjects */}
      {present === null && <span style={{ color: t.textFaint, fontSize: 12.5 }}>Loading subjects…</span>}
      {present && subjects.length === 0 && (
        <span style={{ color: t.textFaint, fontSize: 12.5 }}>No published MCQs in Block {block} yet.</span>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {subjects.map((id) => {
          const free = draft.includes(id);
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              className="flex items-center justify-between rounded-xl p-3 text-left"
              style={{
                backgroundColor: t.surfaceAlt,
                border: `1.5px solid ${free ? t.teal : t.border}`,
              }}
            >
              <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13 }}>
                {SUBJECT_META[id]?.label ?? id}
              </span>
              <span
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{
                  backgroundColor: free ? `${t.teal}22` : `${t.gold}22`,
                  color: free ? t.teal : t.gold,
                }}
              >
                {free ? <Unlock size={11} /> : <Lock size={11} />}
                {free ? "Free" : "Paid"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Btn t={t} icon={Save} onClick={save} disabled={!dirty || busy}>
          {busy ? "Saving…" : "Save changes"}
        </Btn>
        <button
          className="text-xs font-semibold"
          style={{ color: t.textMuted }}
          onClick={() => setDraft(subjects)}
        >
          All free
        </button>
        <button className="text-xs font-semibold" style={{ color: t.textMuted }} onClick={() => setDraft([])}>
          All paid
        </button>
        {msg && <span style={{ color: t.textMuted, fontSize: 12 }}>{msg}</span>}
      </div>
    </Card>
  );
}
