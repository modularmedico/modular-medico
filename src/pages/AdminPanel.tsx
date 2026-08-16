import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PlusCircle,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  BookOpen,
  Layers,
  HelpCircle,
  Check,
  Plus,
  ArrowRight,
  Filter,
  RefreshCw,
  ListTree,
  X,
} from "lucide-react";
import Card from "../components/Card";
import Pill from "../components/Pill";
import Btn from "../components/Btn";
import Spinner from "../components/Spinner";
import { THEME, FONT_DISPLAY, FONT_MONO } from "../theme";
import { useAppStore } from "../store/useAppStore";
import {
  SUBJECT_LIST,
  SUBJECT_META,
  MASTER_MODULES,
  TOTAL_BLOCKS,
  type SubjectId,
} from "../data/subjects";
import {
  addQuestion,
  bulkAddQuestions,
  updateQuestionStatus,
  deleteQuestion,
  bulkDeleteQuestions,
  subscribeAllQuestions,
  subscribeSubheadings,
  createSubheading,
  deleteSubheading,
} from "../services/adminContent";
import { parseBracketFormat } from "../utils/parseBracketFormat";
import type { Difficulty, FirestoreQuestion, QuestionStatus, SubheadingDoc } from "../types";

const ADMIN_TABS = [
  { id: "add_mcq", label: "Add MCQs", icon: PlusCircle },
  { id: "manage_mcq", label: "Manage MCQs & Bank", icon: Search },
] as const;

type AdminTab = typeof ADMIN_TABS[number]["id"];

const DIFF_TONE: Record<Difficulty, string> = { easy: "green", medium: "gold", hard: "red" };

const SAMPLE_BRACKET_TEMPLATE = `[What is the primary pacemaker of the human heart? ; Sinoatrial (SA) node* | Atrioventricular (AV) node | Bundle of His | Purkinje fibers ; The SA node in the right atrium initiates normal cardiac electrical impulses at 60-100 bpm.]

[Which muscle initiates abduction of the shoulder for the first 15 degrees? ; Supraspinatus* | Deltoid | Infraspinatus | Subscapularis ; Supraspinatus initiates abduction (0-15°), after which the deltoid takes over (15-90°).]

[Which enzyme catalyzes the rate-limiting step of glycolysis? ; Phosphofructokinase-1 (PFK-1)* | Hexokinase | Pyruvate kinase | Aldolase ; PFK-1 catalyzes the irreversible conversion of fructose-6-phosphate to fructose-1,6-bisphosphate.]`;

export default function AdminPanel() {
  const navigate = useNavigate();
  const email = useAppStore((s) => s.email);
  const exitAdmin = useAppStore((s) => s.exitAdmin);
  const isDark = useAppStore((s) => s.isDark);
  const t = isDark ? THEME.dark : THEME.light;

  const [activeTab, setActiveTab] = useState<AdminTab>("add_mcq");

  // Questions state for management
  const [allQuestions, setAllQuestions] = useState<FirestoreQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  // Subscribe to all questions
  useEffect(() => {
    setLoadingQuestions(true);
    const unsub = subscribeAllQuestions((qs) => {
      setAllQuestions(qs);
      setLoadingQuestions(false);
    });
    return () => unsub();
  }, []);

  /* ------------------------------------------------------------------------- */
  /* ADD MCQ STATE                                                             */
  /* ------------------------------------------------------------------------- */
  const [inputMode, setInputMode] = useState<"bracket" | "traditional">("bracket");
  const [selectedBlock, setSelectedBlock] = useState<number>(1);
  const [isCustomBlock, setIsCustomBlock] = useState(false);
  const [customBlockInput, setCustomBlockInput] = useState("1");

  const [selectedModulePreset, setSelectedModulePreset] = useState<string>(MASTER_MODULES[0]?.name || "Foundation-I");
  const [isCustomModule, setIsCustomModule] = useState(false);
  const [customModuleName, setCustomModuleName] = useState("");

  const [subjectId, setSubjectId] = useState<SubjectId>("gross_anatomy");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [publishImmediately, setPublishImmediately] = useState(true);

  /* ------------------------------------------------------------------------- */
  /* HIERARCHY: Block -> Module -> Subject -> Subheading                       */
  /* ------------------------------------------------------------------------- */
  const [subheadings, setSubheadings] = useState<SubheadingDoc[]>([]);
  const [selectedSubheadingId, setSelectedSubheadingId] = useState<string>("");
  const [newSubheadingName, setNewSubheadingName] = useState("");
  const [creatingSubheading, setCreatingSubheading] = useState(false);

  // Bracket Mode State
  const [bracketText, setBracketText] = useState("");
  const [saveStatus, setSaveStatus] = useState<"success" | "error" | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  // Traditional Mode State
  const [traditionalQ, setTraditionalQ] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctOptionIdx, setCorrectOptionIdx] = useState(0);
  const [explanation, setExplanation] = useState("");

  /* ------------------------------------------------------------------------- */
  /* MANAGE MCQs FILTER STATE                                                  */
  /* ------------------------------------------------------------------------- */
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBlock, setFilterBlock] = useState<string>("all");
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSubheading, setFilterSubheading] = useState<string>("all");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const effectiveBlock = isCustomBlock ? parseInt(customBlockInput, 10) || 1 : selectedBlock;
  const effectiveModuleName = isCustomModule
    ? customModuleName.trim() || "General Module"
    : selectedModulePreset;
  const effectiveModuleId = effectiveModuleName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  // Subheadings are scoped to one exact (Block, Module, Subject) combination,
  // so re-subscribe any time that combination changes, and reset the
  // selection when it no longer applies to the freshly-loaded list.
  useEffect(() => {
    setSelectedSubheadingId("");
    setNewSubheadingName("");
    const unsub = subscribeSubheadings(effectiveBlock, effectiveModuleId, subjectId, setSubheadings);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveBlock, effectiveModuleId, subjectId]);

  const selectedSubheading = subheadings.find((s) => s.id === selectedSubheadingId) || null;

  const handleCreateSubheading = async () => {
    const name = newSubheadingName.trim();
    if (!name || creatingSubheading) return;
    setCreatingSubheading(true);
    try {
      const id = await createSubheading(effectiveBlock, effectiveModuleId, subjectId, name);
      setSelectedSubheadingId(id);
      setNewSubheadingName("");
    } finally {
      setCreatingSubheading(false);
    }
  };

  const handleDeleteSubheading = async (sh: SubheadingDoc) => {
    await deleteSubheading(effectiveBlock, effectiveModuleId, subjectId, sh.id);
    if (selectedSubheadingId === sh.id) setSelectedSubheadingId("");
  };

  // Resolves whatever is currently in the Subheading field to a concrete
  // { id, name } at save time — so typing a name and hitting Save works
  // even if the separate "Add" button was never clicked first.
  const resolveSubheadingForSave = async (): Promise<{ id: string | null; name: string | null }> => {
    if (selectedSubheading) return { id: selectedSubheading.id, name: selectedSubheading.name };
    const typed = newSubheadingName.trim();
    if (!typed) return { id: null, name: null };
    const id = await createSubheading(effectiveBlock, effectiveModuleId, subjectId, typed);
    setSelectedSubheadingId(id);
    return { id, name: typed };
  };

  // Real-time Bracket Parse
  const parsedBracketResults = useMemo(() => {
    if (!bracketText.trim()) return [];
    return parseBracketFormat(bracketText, allQuestions);
  }, [bracketText, allQuestions]);

  const validParsedMCQs = useMemo(() => {
    return parsedBracketResults.filter((p) => p.status !== "error" && p.q && p.options && p.correct !== undefined);
  }, [parsedBracketResults]);

  const errorParsedMCQs = useMemo(() => {
    return parsedBracketResults.filter((p) => p.status === "error");
  }, [parsedBracketResults]);

  // Handle Save Bracket MCQs
  const handleSaveBracket = async () => {
    if (validParsedMCQs.length === 0) return;
    try {
      const subheading = await resolveSubheadingForSave();
      const itemsToSave = validParsedMCQs.map((v) => ({
        subjectId,
        moduleId: effectiveModuleId,
        moduleName: effectiveModuleName,
        block: effectiveBlock,
        subheadingId: subheading.id,
        subheadingName: subheading.name,
        difficulty,
        q: v.q!,
        options: v.options!,
        correct: v.correct!,
        explanation: v.explanation || "High-yield MBBS concept explanation.",
        status: (publishImmediately ? "published" : "draft") as QuestionStatus,
      }));

      await bulkAddQuestions(itemsToSave);
      setSavedCount(itemsToSave.length);
      setSaveStatus("success");
      setBracketText("");
      setTimeout(() => setSaveStatus(null), 4000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(null), 4000);
    }
  };

  // Handle Save Traditional MCQ
  const isTraditionalValid =
    traditionalQ.trim() &&
    options.every((o) => o.trim()) &&
    explanation.trim() &&
    correctOptionIdx >= 0 &&
    correctOptionIdx < options.length;

  const handleSaveTraditional = async (addAnother = false) => {
    if (!isTraditionalValid) return;
    try {
      const subheading = await resolveSubheadingForSave();
      await addQuestion({
        subjectId,
        moduleId: effectiveModuleId,
        moduleName: effectiveModuleName,
        block: effectiveBlock,
        subheadingId: subheading.id,
        subheadingName: subheading.name,
        difficulty,
        q: traditionalQ.trim(),
        options: options.map((o) => o.trim()),
        correct: correctOptionIdx,
        explanation: explanation.trim(),
        status: (publishImmediately ? "published" : "draft") as QuestionStatus,
      });

      setSavedCount(1);
      setSaveStatus("success");
      setTimeout(() => setSaveStatus(null), 3000);

      if (addAnother) {
        setTraditionalQ("");
        setOptions(["", "", "", ""]);
        setExplanation("");
        setCorrectOptionIdx(0);
      } else {
        setTraditionalQ("");
        setOptions(["", "", "", ""]);
        setExplanation("");
        setCorrectOptionIdx(0);
      }
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  // Delete question handler
  const handleDeleteQuestion = async (qItem: FirestoreQuestion) => {
    try {
      await deleteQuestion(qItem.id, qItem.q);
      setDeleteConfirmId(null);
      setActionNotice(`Removed MCQ: "${qItem.q.slice(0, 35)}..."`);
      setTimeout(() => setActionNotice(null), 3500);
    } catch {
      setActionNotice("Failed to delete question.");
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  // Bulk delete handler — removes every MCQ currently matched by the active filters
  // (used to wipe out an entire subheading's questions in one go instead of one-by-one).
  const handleBulkDeleteFiltered = async () => {
    const targets = filteredQuestions;
    if (targets.length === 0) {
      setBulkDeleteConfirm(false);
      return;
    }
    setBulkDeleting(true);
    try {
      await bulkDeleteQuestions(targets.map((q) => ({ id: q.id, q: q.q })));
      setActionNotice(`Removed ${targets.length} MCQ${targets.length !== 1 ? "s" : ""}${
        filterSubheading !== "all" ? ` from "${filterSubheading}"` : ""
      }.`);
      setTimeout(() => setActionNotice(null), 3500);
    } catch {
      setActionNotice("Failed to bulk delete questions.");
      setTimeout(() => setActionNotice(null), 3000);
    } finally {
      setBulkDeleting(false);
      setBulkDeleteConfirm(false);
    }
  };

  // Toggle status handler
  const handleToggleStatus = async (qItem: FirestoreQuestion) => {
    const nextStatus: QuestionStatus = qItem.status === "published" ? "draft" : "published";
    try {
      await updateQuestionStatus(qItem.id, nextStatus);
      setActionNotice(`Question status set to ${nextStatus}.`);
      setTimeout(() => setActionNotice(null), 2500);
    } catch {
      setActionNotice("Failed to update status.");
      setTimeout(() => setActionNotice(null), 2500);
    }
  };

  // Filtered Questions for Management View
  const filteredQuestions = useMemo(() => {
    return allQuestions.filter((q) => {
      if (filterBlock !== "all" && q.block !== Number(filterBlock)) return false;
      if (filterSubject !== "all" && q.subjectId !== filterSubject) return false;
      if (filterDifficulty !== "all" && q.difficulty !== filterDifficulty) return false;
      if (filterStatus !== "all" && q.status !== filterStatus) return false;
      if (filterSubheading !== "all" && (q.subheadingName || "General / No subheading") !== filterSubheading) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const inQ = q.q.toLowerCase().includes(query);
        const inOpts = q.options.some((o) => o.toLowerCase().includes(query));
        const inExp = q.explanation?.toLowerCase().includes(query);
        const inMod = q.moduleName?.toLowerCase().includes(query);
        const inSub = q.subheadingName?.toLowerCase().includes(query);
        if (!inQ && !inOpts && !inExp && !inMod && !inSub) return false;
      }
      return true;
    });
  }, [allQuestions, filterBlock, filterSubject, filterDifficulty, filterStatus, filterSubheading, searchQuery]);

  // Any change to the active filters invalidates a pending bulk-delete confirmation,
  // so the count shown in the confirm prompt always matches what's on screen.
  useEffect(() => {
    setBulkDeleteConfirm(false);
  }, [filterBlock, filterSubject, filterDifficulty, filterStatus, filterSubheading, searchQuery]);

  // Distinct subheading names present in the bank, given the other active filters (Block/Subject scoped),
  // used to populate the Subheading filter dropdown in the Manage tab.
  const availableSubheadingNames = useMemo(() => {
    const names = new Set<string>();
    allQuestions.forEach((q) => {
      if (filterBlock !== "all" && q.block !== Number(filterBlock)) return;
      if (filterSubject !== "all" && q.subjectId !== filterSubject) return;
      names.add(q.subheadingName || "General / No subheading");
    });
    return Array.from(names).sort();
  }, [allQuestions, filterBlock, filterSubject]);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5" style={{ borderColor: t.border }}>
        <div>
          <div className="flex items-center gap-2">
            <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26 }}>Admin Panel</h1>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-bold"
              style={{ backgroundColor: `${t.purple}25`, color: isDark ? "#c4b5fd" : t.purpleStrong }}
            >
              {email ? `Staff: ${email}` : "Editor Mode"}
            </span>
          </div>
          <p style={{ color: t.textMuted, fontSize: 13.5, marginTop: 3 }}>
            Add and manage medical MCQs across any block, module, and subject.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Btn t={t} variant="ghost" onClick={() => navigate("/subjects")}>
            Student View
          </Btn>
          <Btn
            t={t}
            variant="ghost"
            onClick={() => {
              exitAdmin();
              navigate("/");
            }}
          >
            Exit Admin
          </Btn>
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div
        className="flex rounded-2xl p-1.5 self-start"
        style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}` }}
      >
        {ADMIN_TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all"
              style={{
                backgroundColor: active ? t.purpleStrong : "transparent",
                color: active ? "#fff" : t.textMuted,
                boxShadow: active ? `0 2px 8px ${t.purpleStrong}55` : "none",
              }}
            >
              <tab.icon size={16} />
              {tab.label}
              {tab.id === "manage_mcq" && (
                <span
                  className="rounded-full px-2 py-0.2 text-[11px] font-mono font-bold"
                  style={{ backgroundColor: active ? "rgba(255,255,255,0.25)" : t.surface, color: active ? "#fff" : t.teal }}
                >
                  {allQuestions.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Action Notification Toast */}
      {actionNotice && (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold transition-all shadow-md"
          style={{ backgroundColor: `${t.teal}22`, border: `1.5px solid ${t.teal}`, color: t.teal }}
        >
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-xs opacity-75 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 1: ADD MCQS (BRACKET MODE + TRADITIONAL FORM)                     */}
      {/* ===================================================================== */}
      {activeTab === "add_mcq" && (
        <div className="flex flex-col gap-6">
          {/* Target Classification Card (Block, Module, Subject, Difficulty) */}
          <Card t={t} style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}>
            <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: t.border }}>
              <div className="flex items-center gap-2">
                <Layers size={17} color={t.purple} />
                <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>
                  Target Assignment (Combine Any Block with Any Module)
                </span>
              </div>
              <span className="text-xs" style={{ color: t.textFaint }}>
                Questions will be dynamically assigned to this Block &amp; Module
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* 1. Block Selector */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                  Target Block
                </label>
                {!isCustomBlock ? (
                  <select
                    value={selectedBlock}
                    onChange={(e) => setSelectedBlock(Number(e.target.value))}
                    className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
                    style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                  >
                    {Array.from({ length: TOTAL_BLOCKS }, (_, i) => i + 1).map((b) => (
                      <option key={b} value={b} style={{ backgroundColor: t.surface, color: t.text }}>
                        Block {b}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={customBlockInput}
                    onChange={(e) => setCustomBlockInput(e.target.value)}
                    placeholder="Enter Block #"
                    className="w-full rounded-xl px-3 py-2 text-sm font-semibold outline-none"
                    style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                  />
                )}
                <button
                  onClick={() => setIsCustomBlock(!isCustomBlock)}
                  className="mt-1 text-[11px] font-bold underline"
                  style={{ color: t.teal }}
                >
                  {isCustomBlock ? "Choose from standard 1–15" : "+ Custom Block #"}
                </button>
              </div>

              {/* 2. Module Selector */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                  Target Module
                </label>
                {!isCustomModule ? (
                  <select
                    value={selectedModulePreset}
                    onChange={(e) => setSelectedModulePreset(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
                    style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                  >
                    {MASTER_MODULES.map((m) => (
                      <option key={m.id} value={m.name} style={{ backgroundColor: t.surface, color: t.text }}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={customModuleName}
                    onChange={(e) => setCustomModuleName(e.target.value)}
                    placeholder="e.g. Cardiovascular-I or Clinical Oncology"
                    className="w-full rounded-xl px-3 py-2 text-sm font-semibold outline-none"
                    style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                  />
                )}
                <button
                  onClick={() => setIsCustomModule(!isCustomModule)}
                  className="mt-1 text-[11px] font-bold underline"
                  style={{ color: t.teal }}
                >
                  {isCustomModule ? "Choose from standard modules" : "+ Type Custom Module Name"}
                </button>
              </div>

              {/* 3. Subject Selector */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                  Discipline / Subject
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value as SubjectId)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
                  style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                >
                  {SUBJECT_LIST.map((s) => (
                    <option key={s} value={s} style={{ backgroundColor: t.surface, color: t.text }}>
                      {SUBJECT_META[s].label}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px]" style={{ color: t.textFaint }}>
                  {SUBJECT_META[subjectId]?.defaultYear}
                </span>
              </div>

              {/* 4. Difficulty & Publish Toggle */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                  Difficulty
                </label>
                <div className="flex gap-1.5">
                  {(["easy", "medium", "hard"] as Difficulty[]).map((d) => {
                    const sel = difficulty === d;
                    return (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className="flex-1 rounded-xl py-2 text-xs font-bold capitalize transition-all"
                        style={{
                          backgroundColor: sel ? t.purpleStrong : t.surfaceAlt,
                          color: sel ? "#fff" : t.textMuted,
                          border: `1.5px solid ${sel ? t.purpleStrong : t.border}`,
                        }}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
                <label className="mt-2 flex items-center gap-2 text-xs font-bold cursor-pointer" style={{ color: t.textMuted }}>
                  <input
                    type="checkbox"
                    checked={publishImmediately}
                    onChange={(e) => setPublishImmediately(e.target.checked)}
                    className="accent-purple-500 rounded"
                  />
                  Publish immediately (Live)
                </label>
              </div>
            </div>

            {/* 5. Subheading — 4th level of the hierarchy, scoped to this exact Block + Module + Subject */}
            <div className="mt-4 border-t pt-4" style={{ borderColor: t.border }}>
              <div className="mb-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                  <ListTree size={13} /> Subheading
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={selectedSubheading ? selectedSubheading.name : newSubheadingName}
                  onChange={(e) => {
                    setSelectedSubheadingId("");
                    setNewSubheadingName(e.target.value);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateSubheading()}
                  placeholder="Type a subheading, e.g. Coronary Circulation"
                  className="flex-1 min-w-[200px] rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
                  style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                />
                {selectedSubheading ? (
                  <button
                    onClick={() => {
                      setSelectedSubheadingId("");
                      setNewSubheadingName("");
                    }}
                    className="flex items-center gap-1 rounded-xl px-3 py-2.5 text-xs font-bold transition-all"
                    style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.textMuted }}
                  >
                    <X size={13} /> Clear
                  </button>
                ) : (
                  <Btn t={t} variant="secondary" disabled={!newSubheadingName.trim() || creatingSubheading} onClick={handleCreateSubheading}>
                    {creatingSubheading ? "Adding\u2026" : "Add"}
                  </Btn>
                )}
              </div>

              {/* Previously used subheadings in this scope, for quick reuse or removal */}
              {subheadings.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {subheadings.map((s) => (
                    <Pill
                      key={s.id}
                      t={t}
                      tone="teal"
                      active={selectedSubheadingId === s.id}
                      onClick={() => {
                        setSelectedSubheadingId(s.id);
                        setNewSubheadingName("");
                      }}
                    >
                      {s.name}
                      <X
                        size={11}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSubheading(s);
                        }}
                      />
                    </Pill>
                  ))}
                </div>
              )}
            </div>

            {/* Target Summary Pill */}
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl p-3 text-xs" style={{ backgroundColor: t.surfaceAlt }}>
              <span className="font-bold" style={{ color: t.textMuted }}>Adding to:</span>
              <Pill t={t} tone="teal">Block {effectiveBlock}</Pill>
              <Pill t={t} tone="purple">{effectiveModuleName}</Pill>
              <Pill t={t} tone="gold">{SUBJECT_META[subjectId].label}</Pill>
              {selectedSubheading && <Pill t={t} tone="muted">{selectedSubheading.name}</Pill>}
              <Pill t={t} tone={DIFF_TONE[difficulty] as any}>{difficulty}</Pill>
            </div>
          </Card>

          {/* Mode Switcher: Bracket Mode vs Traditional Form */}
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: t.border }}>
            <div className="flex gap-2">
              <button
                onClick={() => setInputMode("bracket")}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all"
                style={{
                  backgroundColor: inputMode === "bracket" ? t.purpleStrong : t.surfaceAlt,
                  color: inputMode === "bracket" ? "#fff" : t.textMuted,
                  border: `1.5px solid ${inputMode === "bracket" ? t.purpleStrong : t.border}`,
                }}
              >
                <Sparkles size={14} /> Bracket Mode (Live Preview)
              </button>
              <button
                onClick={() => setInputMode("traditional")}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all"
                style={{
                  backgroundColor: inputMode === "traditional" ? t.purpleStrong : t.surfaceAlt,
                  color: inputMode === "traditional" ? "#fff" : t.textMuted,
                  border: `1.5px solid ${inputMode === "traditional" ? t.purpleStrong : t.border}`,
                }}
              >
                <BookOpen size={14} /> Traditional Form Mode
              </button>
            </div>
          </div>

          {/* Status Message */}
          {saveStatus === "success" && (
            <div
              className="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold shadow-sm"
              style={{ backgroundColor: `${t.green}20`, border: `1.5px solid ${t.green}`, color: t.green }}
            >
              <CheckCircle2 size={18} />
              <span>Successfully saved {savedCount} MCQ{savedCount !== 1 ? "s" : ""} to Block {effectiveBlock} &bull; {effectiveModuleName}!</span>
            </div>
          )}

          {saveStatus === "error" && (
            <div
              className="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold shadow-sm"
              style={{ backgroundColor: `${t.red}20`, border: `1.5px solid ${t.red}`, color: t.red }}
            >
              <XCircle size={18} />
              <span>Failed to save MCQs. Please check the format and try again.</span>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* SUB-TAB A: BRACKET MODE (WITH LIVE INTERACTIVE PREVIEW)            */}
          {/* ----------------------------------------------------------------- */}
          {inputMode === "bracket" && (
            <div className="grid gap-6 lg:grid-cols-2 items-start">
              {/* Left Column: Textarea & Guide */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                    Raw Bracket Input
                  </label>
                  <span className="text-[11px]" style={{ color: t.textMuted }}>
                    Format: <code>[Question ; Opt A | Opt B | *Opt C | Opt D ; Explanation]</code>
                  </span>
                </div>

                <textarea
                  value={bracketText}
                  onChange={(e) => setBracketText(e.target.value)}
                  rows={14}
                  placeholder={`Type or paste your MCQs here...\n\nExample:\n[What is the major extracellular cation? ; Sodium* | Potassium | Calcium | Magnesium ; Sodium (Na+) is the principal cation of the extracellular fluid.]`}
                  className="w-full rounded-2xl p-4 text-xs font-mono outline-none resize-y leading-relaxed"
                  style={{
                    backgroundColor: t.surfaceAlt,
                    border: `1.5px solid ${t.border}`,
                    color: t.text,
                    minHeight: "320px",
                  }}
                />

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono" style={{ color: t.textMuted }}>
                    Parsed: <strong style={{ color: validParsedMCQs.length > 0 ? t.green : t.textFaint }}>{validParsedMCQs.length} valid</strong>
                    {errorParsedMCQs.length > 0 && <span style={{ color: t.red }}> ({errorParsedMCQs.length} errors)</span>}
                  </span>

                  <Btn
                    t={t}
                    icon={Plus}
                    disabled={validParsedMCQs.length === 0}
                    onClick={handleSaveBracket}
                  >
                    Save &amp; {publishImmediately ? "Publish" : "Draft"} ({validParsedMCQs.length} MCQs)
                  </Btn>
                </div>
              </div>

              {/* Right Column: Live Interactive Preview */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                    Live Preview ({parsedBracketResults.length} Detected)
                  </label>
                  <span className="text-[11px]" style={{ color: t.teal }}>
                    Updates in real-time
                  </span>
                </div>

                <div
                  className="flex flex-col gap-4 rounded-2xl p-4 max-h-[500px] overflow-y-auto"
                  style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}
                >
                  {parsedBracketResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center gap-2" style={{ color: t.textFaint }}>
                      <HelpCircle size={32} />
                      <p className="text-sm">Type bracket MCQs on the left to see the live preview rendered here.</p>
                      <button
                        onClick={() => setBracketText(SAMPLE_BRACKET_TEMPLATE)}
                        className="text-xs font-bold underline"
                        style={{ color: t.purple }}
                      >
                        Click here to load 3 sample questions
                      </button>
                    </div>
                  ) : (
                    parsedBracketResults.map((item, idx) => {
                      if (item.status === "error") {
                        return (
                          <div
                            key={idx}
                            className="rounded-xl p-3 text-xs"
                            style={{ backgroundColor: `${t.red}15`, border: `1px solid ${t.red}`, color: t.red }}
                          >
                            <div className="flex items-center gap-1.5 font-bold mb-1">
                              <AlertTriangle size={14} /> MCQ #{item.line}: Parse Error
                            </div>
                            <p>{item.message}</p>
                            <div className="mt-1 font-mono text-[10px] opacity-75 truncate">{item.raw}</div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={idx}
                          className="rounded-xl p-4 flex flex-col gap-2.5 transition-all"
                          style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}` }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${t.teal}22`, color: t.teal }}>
                              MCQ #{idx + 1} &bull; Ready
                            </span>
                            <Pill t={t} tone={DIFF_TONE[difficulty] as any}>{difficulty}</Pill>
                          </div>

                          <h4 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14.5 }}>
                            {item.q}
                          </h4>

                          {/* Options List */}
                          <div className="grid gap-1.5 sm:grid-cols-2">
                            {item.options?.map((opt, optIdx) => {
                              const isCorrect = optIdx === item.correct;
                              const letter = String.fromCharCode(65 + optIdx);
                              return (
                                <div
                                  key={optIdx}
                                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                                  style={{
                                    backgroundColor: isCorrect ? `${t.green}25` : t.surface,
                                    border: `1.5px solid ${isCorrect ? t.green : t.border}`,
                                    color: isCorrect ? t.green : t.text,
                                  }}
                                >
                                  <span className="font-mono text-[10px] font-bold">{letter}.</span>
                                  <span className="flex-1">{opt}</span>
                                  {isCorrect && <Check size={13} color={t.green} />}
                                </div>
                              );
                            })}
                          </div>

                          {/* Explanation */}
                          {item.explanation && (
                            <div className="rounded-lg p-2.5 text-xs" style={{ backgroundColor: `${t.purple}15`, border: `1px solid ${t.purple}44` }}>
                              <span className="font-bold block mb-0.5" style={{ color: isDark ? "#c4b5fd" : t.purpleStrong }}>
                                Rationale:
                              </span>
                              <p style={{ color: t.textMuted }}>{item.explanation}</p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* SUB-TAB B: TRADITIONAL FORM MODE                                   */}
          {/* ----------------------------------------------------------------- */}
          {inputMode === "traditional" && (
            <Card t={t} style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                    Question Prompt / Clinical Stem
                  </label>
                  <textarea
                    value={traditionalQ}
                    onChange={(e) => setTraditionalQ(e.target.value)}
                    rows={3}
                    placeholder="Enter the complete question text..."
                    className="w-full rounded-xl p-3 text-sm outline-none resize-y"
                    style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                    Options (Select the Radio for the Correct Answer)
                  </label>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {options.map((opt, i) => {
                      const letter = String.fromCharCode(65 + i);
                      const isCorrect = correctOptionIdx === i;
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-xl p-2.5 transition-all"
                          style={{
                            backgroundColor: isCorrect ? `${t.green}18` : t.surfaceAlt,
                            border: `1.5px solid ${isCorrect ? t.green : t.border}`,
                          }}
                        >
                          <input
                            type="radio"
                            name="correctOption"
                            checked={isCorrect}
                            onChange={() => setCorrectOptionIdx(i)}
                            className="accent-emerald-500 h-4 w-4 cursor-pointer"
                          />
                          <span className="font-mono text-xs font-bold">{letter}.</span>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const next = [...options];
                              next[i] = e.target.value;
                              setOptions(next);
                            }}
                            placeholder={`Option ${letter}`}
                            className="w-full bg-transparent text-xs font-medium outline-none"
                            style={{ color: t.text }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                    Clinical Explanation &amp; Rationale
                  </label>
                  <textarea
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    rows={2}
                    placeholder="Explain why the correct answer is right and why distractors are wrong..."
                    className="w-full rounded-xl p-3 text-sm outline-none resize-y"
                    style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                  <Btn
                    t={t}
                    variant="ghost"
                    disabled={!isTraditionalValid}
                    onClick={() => handleSaveTraditional(true)}
                  >
                    Save &amp; Add Another
                  </Btn>
                  <Btn
                    t={t}
                    disabled={!isTraditionalValid}
                    onClick={() => handleSaveTraditional(false)}
                  >
                    Save MCQ
                  </Btn>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: MANAGE ALL MCQS & QUESTION BANK (REQUEST 2)                     */}
      {/* ===================================================================== */}
      {activeTab === "manage_mcq" && (
        <div className="flex flex-col gap-6">
          {/* Controls Bar & Filters */}
          <Card t={t} style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}>
            <div className="flex flex-col gap-4">
              {/* Search input */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search question text, options, module, or explanation..."
                  className="w-full rounded-2xl pl-10 pr-4 py-3 text-sm outline-none"
                  style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                />
                <Search size={17} className="absolute left-3.5 top-3.5" color={t.textFaint} />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-3 text-xs opacity-60 hover:opacity-100"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Filter Row */}
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                {/* Block Filter */}
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                    Block
                  </label>
                  <select
                    value={filterBlock}
                    onChange={(e) => setFilterBlock(e.target.value)}
                    className="w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none"
                    style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                  >
                    <option value="all">All Blocks (1–15)</option>
                    {Array.from({ length: TOTAL_BLOCKS }, (_, i) => i + 1).map((b) => (
                      <option key={b} value={b}>Block {b}</option>
                    ))}
                  </select>
                </div>

                {/* Subject Filter */}
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                    Subject
                  </label>
                  <select
                    value={filterSubject}
                    onChange={(e) => setFilterSubject(e.target.value)}
                    className="w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none"
                    style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                  >
                    <option value="all">All Subjects</option>
                    {SUBJECT_LIST.map((s) => (
                      <option key={s} value={s}>{SUBJECT_META[s].label}</option>
                    ))}
                  </select>
                </div>

                {/* Difficulty Filter */}
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                    Difficulty
                  </label>
                  <select
                    value={filterDifficulty}
                    onChange={(e) => setFilterDifficulty(e.target.value)}
                    className="w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none"
                    style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                  >
                    <option value="all">All Difficulties</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                    Status
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none"
                    style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>

                {/* Subheading Filter */}
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                    Subheading
                  </label>
                  <select
                    value={filterSubheading}
                    onChange={(e) => setFilterSubheading(e.target.value)}
                    className="w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none"
                    style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                  >
                    <option value="all">All Subheadings</option>
                    {availableSubheadingNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </Card>

          {/* Results Summary Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold" style={{ color: t.textMuted }}>
              Showing {filteredQuestions.length} of {allQuestions.length} Total MCQs
            </span>
            <div className="flex items-center gap-3">
              {(filterBlock !== "all" || filterSubject !== "all" || filterDifficulty !== "all" || filterStatus !== "all" || filterSubheading !== "all" || searchQuery) && (
                <button
                  onClick={() => {
                    setFilterBlock("all");
                    setFilterSubject("all");
                    setFilterDifficulty("all");
                    setFilterStatus("all");
                    setFilterSubheading("all");
                    setSearchQuery("");
                    setBulkDeleteConfirm(false);
                  }}
                  className="text-xs font-bold underline"
                  style={{ color: t.teal }}
                >
                  Reset All Filters
                </button>
              )}

              {/* Bulk delete — only surfaced once a Subheading is selected, so it's scoped to
                  "delete this subheading's MCQs" rather than an easy way to wipe everything. */}
              {filterSubheading !== "all" && filteredQuestions.length > 0 && (
                !bulkDeleteConfirm ? (
                  <button
                    onClick={() => setBulkDeleteConfirm(true)}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all text-red-400 hover:bg-red-500/10"
                    title={`Delete all ${filteredQuestions.length} MCQs in "${filterSubheading}"`}
                  >
                    <Trash2 size={13} /> Delete All {filteredQuestions.length} in "{filterSubheading}"
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-red-400">
                      Delete {filteredQuestions.length} MCQ{filteredQuestions.length !== 1 ? "s" : ""}? This can't be undone.
                    </span>
                    <button
                      onClick={handleBulkDeleteFiltered}
                      disabled={bulkDeleting}
                      className="rounded-lg px-2.5 py-1 text-xs font-extrabold bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {bulkDeleting ? "Deleting\u2026" : "Yes, Delete All"}
                    </button>
                    <button
                      onClick={() => setBulkDeleteConfirm(false)}
                      disabled={bulkDeleting}
                      className="rounded-lg px-2 py-1 text-xs font-bold opacity-75 hover:opacity-100"
                      style={{ color: t.textMuted }}
                    >
                      Cancel
                    </button>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Questions List */}
          {loadingQuestions ? (
            <div className="py-16 text-center">
              <Spinner t={t} size={24} label="Loading question bank\u2026" />
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="rounded-2xl p-12 text-center flex flex-col items-center gap-3" style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}>
              <Search size={32} color={t.textFaint} />
              <p style={{ color: t.textMuted, fontSize: 15 }}>No questions matched your current filters.</p>
              <Btn t={t} variant="ghost" onClick={() => setActiveTab("add_mcq")}>
                Add New Questions
              </Btn>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredQuestions.map((qItem, idx) => {
                const subjectMeta = SUBJECT_META[qItem.subjectId as keyof typeof SUBJECT_META];
                const isDeletePrompt = deleteConfirmId === qItem.id;

                return (
                  <div
                    key={qItem.id || idx}
                    className="rounded-2xl p-5 transition-all flex flex-col gap-3 relative"
                    style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}
                  >
                    {/* Top Meta Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3" style={{ borderColor: t.border }}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill t={t} tone="teal">Block {qItem.block}</Pill>
                        <Pill t={t} tone="purple">{qItem.moduleName || "General"}</Pill>
                        <Pill t={t} tone="gold">{subjectMeta?.label || qItem.subjectId}</Pill>
                        {qItem.subheadingName && <Pill t={t} tone="muted">{qItem.subheadingName}</Pill>}
                        <Pill t={t} tone={DIFF_TONE[qItem.difficulty] as any}>{qItem.difficulty}</Pill>
                        <button
                          onClick={() => handleToggleStatus(qItem)}
                          className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-all"
                          style={{
                            backgroundColor: qItem.status === "published" ? `${t.green}20` : `${t.gold}20`,
                            color: qItem.status === "published" ? t.green : t.gold,
                          }}
                          title="Click to toggle status"
                        >
                          {qItem.status === "published" ? <Eye size={12} /> : <EyeOff size={12} />}
                          {qItem.status === "published" ? "Published" : "Draft"}
                        </button>
                      </div>

                      {/* Actions: Delete with confirmation */}
                      <div>
                        {!isDeletePrompt ? (
                          <button
                            onClick={() => setDeleteConfirmId(qItem.id)}
                            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all text-red-400 hover:bg-red-500/10"
                            title="Delete this question"
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-red-400">Confirm delete?</span>
                            <button
                              onClick={() => handleDeleteQuestion(qItem)}
                              className="rounded-lg px-2.5 py-1 text-xs font-extrabold bg-red-600 text-white hover:bg-red-700"
                            >
                              Yes, Delete
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="rounded-lg px-2 py-1 text-xs font-bold opacity-75 hover:opacity-100"
                              style={{ color: t.textMuted }}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Question Stem */}
                    <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, lineHeight: 1.4 }}>
                      {qItem.q}
                    </h3>

                    {/* Options Grid */}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {qItem.options.map((opt, optIdx) => {
                        const isCorrect = optIdx === qItem.correct;
                        const letter = String.fromCharCode(65 + optIdx);
                        return (
                          <div
                            key={optIdx}
                            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
                            style={{
                              backgroundColor: isCorrect ? `${t.green}20` : t.surfaceAlt,
                              border: `1.5px solid ${isCorrect ? t.green : t.border}`,
                              color: isCorrect ? t.green : t.text,
                            }}
                          >
                            <span className="font-mono text-[11px] font-bold">{letter}.</span>
                            <span className="flex-1">{opt}</span>
                            {isCorrect && <Check size={14} color={t.green} />}
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation */}
                    {qItem.explanation && (
                      <div className="rounded-xl p-3 text-xs" style={{ backgroundColor: `${t.purple}12`, border: `1px solid ${t.purple}33` }}>
                        <span className="font-bold block mb-1" style={{ color: isDark ? "#c4b5fd" : t.purpleStrong }}>
                          Rationale &amp; High-Yield Concept:
                        </span>
                        <p style={{ color: t.textMuted, lineHeight: 1.5 }}>{qItem.explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
