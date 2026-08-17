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
  Loader2,
  Video,
  Youtube,
  ExternalLink,
  BookMarked,
  Library,
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
  subscribeTopics,
  createTopic,
  deleteTopic,
  subscribeSubheadings,
  createSubheading,
  deleteSubheading,
  QuestionSaveError,
} from "../services/adminContent";
import {
  addLecture,
  updateLectureStatus,
  deleteLecture,
  subscribeAllLectures,
  toYouTubeEmbedUrl,
} from "../services/lectures";
import {
  addOspeBook,
  updateOspeBookStatus,
  deleteOspeBook,
  subscribeAllOspeBooks,
} from "../services/ospeBooks";
import { parseBracketFormat } from "../utils/parseBracketFormat";
import type { Difficulty, FirestoreLecture, FirestoreOspeBook, FirestoreQuestion, QuestionStatus, SubheadingDoc, TopicDoc } from "../types";

const ADMIN_TABS = [
  { id: "add_mcq", label: "Add MCQs", icon: PlusCircle },
  { id: "manage_mcq", label: "Manage MCQs & Bank", icon: Search },
  { id: "add_lecture", label: "Add Lecture", icon: Video },
  { id: "manage_lecture", label: "Manage Lectures", icon: Youtube },
  { id: "add_ospe_book", label: "Add OSPE Book", icon: BookMarked },
  { id: "manage_ospe_book", label: "Manage OSPE Books", icon: Library },
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
  // Set when the bank listing itself couldn't be loaded from Firestore (e.g. this
  // account lacks the real admin custom claim) — tells the admin the list below is
  // incomplete rather than letting an empty bank look like "0 questions saved".
  const [bankLoadWarning, setBankLoadWarning] = useState<string | null>(null);

  // Subscribe to all questions
  useEffect(() => {
    setLoadingQuestions(true);
    const unsub = subscribeAllQuestions(
      (qs) => {
        setAllQuestions(qs);
        setLoadingQuestions(false);
      },
      (_reason, message) => setBankLoadWarning(message)
    );
    return () => unsub();
  }, []);

  /* ------------------------------------------------------------------------- */
  /* ADD MCQ STATE                                                             */
  /* ------------------------------------------------------------------------- */
  const [inputMode, setInputMode] = useState<"bracket" | "traditional">("bracket");
  // "success" = confirmed saved to Firestore. "error" = the write was rejected and
  // NOTHING was saved anywhere (no more silent localStorage fallback) — saveWarning
  // holds the specific, actionable reason so the admin knows exactly what to fix.
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
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
  /* HIERARCHY: Block -> Module -> Subject -> Topic (MCQ-side; kept in its own */
  /* "topics" collection, deliberately separate from Lectures' Subheadings)    */
  /* ------------------------------------------------------------------------- */
  const [topics, setTopics] = useState<TopicDoc[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [newTopicName, setNewTopicName] = useState("");
  const [creatingTopic, setCreatingTopic] = useState(false);

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
  const [filterTopic, setFilterTopic] = useState<string>("all");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  /* ------------------------------------------------------------------------- */
  /* LECTURES STATE (own Block -> Module -> Subject -> Subheading hierarchy,   */
  /* mirroring the MCQ form exactly per the same 4-tier content scaffold)      */
  /* ------------------------------------------------------------------------- */
  const [lectures, setLectures] = useState<FirestoreLecture[]>([]);
  const [loadingLectures, setLoadingLectures] = useState(true);
  const [lectureBankWarning, setLectureBankWarning] = useState<string | null>(null);

  useEffect(() => {
    setLoadingLectures(true);
    const unsub = subscribeAllLectures(
      (ls) => {
        setLectures(ls);
        setLoadingLectures(false);
      },
      (_reason, message) => setLectureBankWarning(message)
    );
    return () => unsub();
  }, []);

  const [lectureBlock, setLectureBlock] = useState<number>(1);
  const [isCustomLectureBlock, setIsCustomLectureBlock] = useState(false);
  const [customLectureBlockInput, setCustomLectureBlockInput] = useState("1");
  const [lectureModulePreset, setLectureModulePreset] = useState<string>(MASTER_MODULES[0]?.name || "Foundation-I");
  const [isCustomLectureModule, setIsCustomLectureModule] = useState(false);
  const [customLectureModuleName, setCustomLectureModuleName] = useState("");
  const [lectureSubjectId, setLectureSubjectId] = useState<SubjectId>("gross_anatomy");
  const [lecturePublishImmediately, setLecturePublishImmediately] = useState(true);

  const [lectureSubheadings, setLectureSubheadings] = useState<SubheadingDoc[]>([]);
  const [lectureSubheadingsLoading, setLectureSubheadingsLoading] = useState(true);
  const [selectedLectureSubheadingId, setSelectedLectureSubheadingId] = useState<string>("");
  const [newLectureSubheadingName, setNewLectureSubheadingName] = useState("");
  const [creatingLectureSubheading, setCreatingLectureSubheading] = useState(false);

  const [lectureTitle, setLectureTitle] = useState("");
  const [lectureUrl, setLectureUrl] = useState("");
  const [lectureDescription, setLectureDescription] = useState("");
  const [lectureSaveStatus, setLectureSaveStatus] = useState<"success" | "success-local" | "error" | null>(null);
  const [lectureSaveWarning, setLectureSaveWarning] = useState<string | null>(null);

  const effectiveLectureBlock = isCustomLectureBlock ? parseInt(customLectureBlockInput, 10) || 1 : lectureBlock;
  const effectiveLectureModuleName = isCustomLectureModule
    ? customLectureModuleName.trim() || "General Module"
    : lectureModulePreset;
  const effectiveLectureModuleId = effectiveLectureModuleName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  useEffect(() => {
    setSelectedLectureSubheadingId("");
    setNewLectureSubheadingName("");
    setLectureSubheadingsLoading(true);
    const unsub = subscribeSubheadings(effectiveLectureBlock, effectiveLectureModuleId, lectureSubjectId, (list) => {
      setLectureSubheadings(list);
      setLectureSubheadingsLoading(false);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveLectureBlock, effectiveLectureModuleId, lectureSubjectId]);

  const selectedLectureSubheading = lectureSubheadings.find((s) => s.id === selectedLectureSubheadingId) || null;

  const handleCreateLectureSubheading = async () => {
    const name = newLectureSubheadingName.trim();
    if (!name || creatingLectureSubheading) return;
    setCreatingLectureSubheading(true);
    try {
      const id = await createSubheading(effectiveLectureBlock, effectiveLectureModuleId, lectureSubjectId, name);
      setSelectedLectureSubheadingId(id);
      setNewLectureSubheadingName("");
    } finally {
      setCreatingLectureSubheading(false);
    }
  };

  const resolveLectureSubheadingForSave = async (): Promise<{ id: string | null; name: string | null }> => {
    if (selectedLectureSubheading) return { id: selectedLectureSubheading.id, name: selectedLectureSubheading.name };
    const typed = newLectureSubheadingName.trim();
    if (!typed) return { id: null, name: null };
    const id = await createSubheading(effectiveLectureBlock, effectiveLectureModuleId, lectureSubjectId, typed);
    setSelectedLectureSubheadingId(id);
    return { id, name: typed };
  };

  const isLectureValid = lectureTitle.trim().length > 0 && !!toYouTubeEmbedUrl(lectureUrl);

  const handleSaveLecture = async () => {
    if (!isLectureValid) return;
    try {
      const subheading = await resolveLectureSubheadingForSave();
      const result = await addLecture({
        title: lectureTitle.trim(),
        youtubeUrl: lectureUrl.trim(),
        description: lectureDescription.trim(),
        subjectId: lectureSubjectId,
        moduleId: effectiveLectureModuleId,
        moduleName: effectiveLectureModuleName,
        block: effectiveLectureBlock,
        subheadingId: subheading.id,
        subheadingName: subheading.name,
        status: (lecturePublishImmediately ? "published" : "draft") as QuestionStatus,
      });
      if (result.source === "firestore") {
        setLectureSaveStatus("success");
        setLectureSaveWarning(null);
        setTimeout(() => setLectureSaveStatus(null), 3000);
      } else {
        setLectureSaveStatus("success-local");
        setLectureSaveWarning(result.message);
        setTimeout(() => setLectureSaveStatus(null), 9000);
      }
      setLectureTitle("");
      setLectureUrl("");
      setLectureDescription("");
    } catch {
      setLectureSaveStatus("error");
      setLectureSaveWarning(null);
      setTimeout(() => setLectureSaveStatus(null), 4000);
    }
  };

  const handleDeleteLecture = async (l: FirestoreLecture) => {
    try {
      await deleteLecture(l.id);
      setActionNotice(`Removed lecture: "${l.title.slice(0, 40)}"`);
      setTimeout(() => setActionNotice(null), 3500);
    } catch {
      setActionNotice("Failed to delete lecture.");
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  const handleToggleLectureStatus = async (l: FirestoreLecture) => {
    const nextStatus: QuestionStatus = l.status === "published" ? "draft" : "published";
    try {
      await updateLectureStatus(l.id, nextStatus);
      setActionNotice(`Lecture status set to ${nextStatus}.`);
      setTimeout(() => setActionNotice(null), 2500);
    } catch {
      setActionNotice("Failed to update lecture status.");
      setTimeout(() => setActionNotice(null), 2500);
    }
  };

  const [lectureFilterBlock, setLectureFilterBlock] = useState<string>("all");
  const [lectureFilterSubject, setLectureFilterSubject] = useState<string>("all");
  const [lectureFilterStatus, setLectureFilterStatus] = useState<string>("all");
  const [lectureSearchQuery, setLectureSearchQuery] = useState("");

  const filteredLectures = useMemo(() => {
    return lectures
      .filter((l) => {
        if (lectureFilterBlock !== "all" && l.block !== Number(lectureFilterBlock)) return false;
        if (lectureFilterSubject !== "all" && l.subjectId !== lectureFilterSubject) return false;
        if (lectureFilterStatus !== "all" && l.status !== lectureFilterStatus) return false;
        if (lectureSearchQuery.trim()) {
          const query = lectureSearchQuery.toLowerCase();
          const inTitle = l.title.toLowerCase().includes(query);
          const inDesc = l.description?.toLowerCase().includes(query);
          const inMod = l.moduleName?.toLowerCase().includes(query);
          const inSub = l.subheadingName?.toLowerCase().includes(query);
          if (!inTitle && !inDesc && !inMod && !inSub) return false;
        }
        return true;
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [lectures, lectureFilterBlock, lectureFilterSubject, lectureFilterStatus, lectureSearchQuery]);

  /* ------------------------------------------------------------------------- */
  /* OSPE BOOKS STATE (Subject-scoped only — a Google Drive PDF link per book) */
  /* ------------------------------------------------------------------------- */
  const [ospeBooks, setOspeBooks] = useState<FirestoreOspeBook[]>([]);
  const [loadingOspeBooks, setLoadingOspeBooks] = useState(true);
  const [ospeBankWarning, setOspeBankWarning] = useState<string | null>(null);

  useEffect(() => {
    setLoadingOspeBooks(true);
    const unsub = subscribeAllOspeBooks(
      (books) => {
        setOspeBooks(books);
        setLoadingOspeBooks(false);
      },
      (_reason, message) => setOspeBankWarning(message)
    );
    return () => unsub();
  }, []);

  const [ospeSubjectId, setOspeSubjectId] = useState<SubjectId>("gross_anatomy");
  const [ospeTitle, setOspeTitle] = useState("");
  const [ospeDriveUrl, setOspeDriveUrl] = useState("");
  const [ospeDescription, setOspeDescription] = useState("");
  const [ospePublishImmediately, setOspePublishImmediately] = useState(true);
  const [ospeSaveStatus, setOspeSaveStatus] = useState<"success" | "success-local" | "error" | null>(null);
  const [ospeSaveWarning, setOspeSaveWarning] = useState<string | null>(null);

  const isOspeValid = ospeTitle.trim().length > 0 && ospeDriveUrl.trim().length > 0;

  const handleSaveOspeBook = async () => {
    if (!isOspeValid) return;
    try {
      const result = await addOspeBook({
        title: ospeTitle.trim(),
        driveUrl: ospeDriveUrl.trim(),
        description: ospeDescription.trim(),
        subjectId: ospeSubjectId,
        status: (ospePublishImmediately ? "published" : "draft") as QuestionStatus,
      });
      if (result.source === "firestore") {
        setOspeSaveStatus("success");
        setOspeSaveWarning(null);
        setTimeout(() => setOspeSaveStatus(null), 3000);
      } else {
        setOspeSaveStatus("success-local");
        setOspeSaveWarning(result.message);
        setTimeout(() => setOspeSaveStatus(null), 9000);
      }
      setOspeTitle("");
      setOspeDriveUrl("");
      setOspeDescription("");
    } catch {
      setOspeSaveStatus("error");
      setOspeSaveWarning(null);
      setTimeout(() => setOspeSaveStatus(null), 4000);
    }
  };

  const handleDeleteOspeBook = async (b: FirestoreOspeBook) => {
    try {
      await deleteOspeBook(b.id);
      setActionNotice(`Removed OSPE Book: "${b.title.slice(0, 40)}"`);
      setTimeout(() => setActionNotice(null), 3500);
    } catch {
      setActionNotice("Failed to delete OSPE Book.");
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  const handleToggleOspeBookStatus = async (b: FirestoreOspeBook) => {
    const nextStatus: QuestionStatus = b.status === "published" ? "draft" : "published";
    try {
      await updateOspeBookStatus(b.id, nextStatus);
      setActionNotice(`OSPE Book status set to ${nextStatus}.`);
      setTimeout(() => setActionNotice(null), 2500);
    } catch {
      setActionNotice("Failed to update OSPE Book status.");
      setTimeout(() => setActionNotice(null), 2500);
    }
  };

  const [ospeFilterSubject, setOspeFilterSubject] = useState<string>("all");
  const [ospeFilterStatus, setOspeFilterStatus] = useState<string>("all");
  const [ospeSearchQuery, setOspeSearchQuery] = useState("");

  const filteredOspeBooks = useMemo(() => {
    return ospeBooks
      .filter((b) => {
        if (ospeFilterSubject !== "all" && b.subjectId !== ospeFilterSubject) return false;
        if (ospeFilterStatus !== "all" && b.status !== ospeFilterStatus) return false;
        if (ospeSearchQuery.trim()) {
          const query = ospeSearchQuery.toLowerCase();
          const inTitle = b.title.toLowerCase().includes(query);
          const inDesc = b.description?.toLowerCase().includes(query);
          if (!inTitle && !inDesc) return false;
        }
        return true;
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [ospeBooks, ospeFilterSubject, ospeFilterStatus, ospeSearchQuery]);

  const effectiveBlock = isCustomBlock ? parseInt(customBlockInput, 10) || 1 : selectedBlock;
  const effectiveModuleName = isCustomModule
    ? customModuleName.trim() || "General Module"
    : selectedModulePreset;
  const effectiveModuleId = effectiveModuleName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  // Topics are scoped to one exact (Block, Module, Subject) combination,
  // so re-subscribe any time that combination changes, and reset the
  // selection when it no longer applies to the freshly-loaded list.
  useEffect(() => {
    setSelectedTopicId("");
    setNewTopicName("");
    setTopicsLoading(true);
    const unsub = subscribeTopics(effectiveBlock, effectiveModuleId, subjectId, (list) => {
      setTopics(list);
      setTopicsLoading(false);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveBlock, effectiveModuleId, subjectId]);

  const selectedTopic = topics.find((s) => s.id === selectedTopicId) || null;

  const handleCreateTopic = async () => {
    const name = newTopicName.trim();
    if (!name || creatingTopic) return;
    setCreatingTopic(true);
    try {
      const id = await createTopic(effectiveBlock, effectiveModuleId, subjectId, name);
      setSelectedTopicId(id);
      setNewTopicName("");
    } finally {
      setCreatingTopic(false);
    }
  };

  const handleDeleteTopic = async (sh: TopicDoc) => {
    await deleteTopic(effectiveBlock, effectiveModuleId, subjectId, sh.id);
    if (selectedTopicId === sh.id) setSelectedTopicId("");
  };

  // Resolves whatever is currently in the Topic field to a concrete
  // { id, name } at save time — so typing a name and hitting Save works
  // even if the separate "Add" button was never clicked first.
  const resolveTopicForSave = async (): Promise<{ id: string | null; name: string | null }> => {
    if (selectedTopic) return { id: selectedTopic.id, name: selectedTopic.name };
    const typed = newTopicName.trim();
    if (!typed) return { id: null, name: null };
    const id = await createTopic(effectiveBlock, effectiveModuleId, subjectId, typed);
    setSelectedTopicId(id);
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
    if (!email) {
      setSaveStatus("error");
      setSaveWarning("You aren't logged in, so this can't be saved. Log in with an admin-enabled account first.");
      setTimeout(() => setSaveStatus(null), 12000);
      return;
    }
    try {
      const topic = await resolveTopicForSave();
      const itemsToSave = validParsedMCQs.map((v) => ({
        subjectId,
        moduleId: effectiveModuleId,
        moduleName: effectiveModuleName,
        block: effectiveBlock,
        topicId: topic.id,
        topicName: topic.name,
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
      setSaveWarning(null);
      setBracketText("");
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err) {
      setSaveStatus("error");
      setSaveWarning(err instanceof QuestionSaveError ? err.message : "Failed to save MCQs. Please check the format and try again.");
      setTimeout(() => setSaveStatus(null), 12000);
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
    if (!email) {
      setSaveStatus("error");
      setSaveWarning("You aren't logged in, so this can't be saved. Log in with an admin-enabled account first.");
      setTimeout(() => setSaveStatus(null), 12000);
      return;
    }
    try {
      const topic = await resolveTopicForSave();
      await addQuestion({
        subjectId,
        moduleId: effectiveModuleId,
        moduleName: effectiveModuleName,
        block: effectiveBlock,
        topicId: topic.id,
        topicName: topic.name,
        difficulty,
        q: traditionalQ.trim(),
        options: options.map((o) => o.trim()),
        correct: correctOptionIdx,
        explanation: explanation.trim(),
        status: (publishImmediately ? "published" : "draft") as QuestionStatus,
      });

      setSavedCount(1);
      setSaveStatus("success");
      setSaveWarning(null);
      setTimeout(() => setSaveStatus(null), 3000);

      setTraditionalQ("");
      setOptions(["", "", "", ""]);
      setExplanation("");
      setCorrectOptionIdx(0);
    } catch (err) {
      setSaveStatus("error");
      setSaveWarning(err instanceof QuestionSaveError ? err.message : "Failed to save this MCQ. Please try again.");
      setTimeout(() => setSaveStatus(null), 12000);
      // Deliberately do NOT clear the form on error — the admin's typed question,
      // options, and explanation must stay so nothing is lost on a failed save.
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
  // (used to wipe out an entire topic's questions in one go instead of one-by-one).
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
        filterTopic !== "all" ? ` from "${filterTopic}"` : ""
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
      if (filterTopic !== "all" && (q.topicName || "General / No topic") !== filterTopic) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const inQ = q.q.toLowerCase().includes(query);
        const inOpts = q.options.some((o) => o.toLowerCase().includes(query));
        const inExp = q.explanation?.toLowerCase().includes(query);
        const inMod = q.moduleName?.toLowerCase().includes(query);
        const inSub = q.topicName?.toLowerCase().includes(query);
        if (!inQ && !inOpts && !inExp && !inMod && !inSub) return false;
      }
      return true;
    });
  }, [allQuestions, filterBlock, filterSubject, filterDifficulty, filterStatus, filterTopic, searchQuery]);

  // Any change to the active filters invalidates a pending bulk-delete confirmation,
  // so the count shown in the confirm prompt always matches what's on screen.
  useEffect(() => {
    setBulkDeleteConfirm(false);
  }, [filterBlock, filterSubject, filterDifficulty, filterStatus, filterTopic, searchQuery]);

  // Distinct topic names present in the bank, given the other active filters (Block/Subject scoped),
  // used to populate the Topic filter dropdown in the Manage tab.
  const availableTopicNames = useMemo(() => {
    const names = new Set<string>();
    allQuestions.forEach((q) => {
      if (filterBlock !== "all" && q.block !== Number(filterBlock)) return;
      if (filterSubject !== "all" && q.subjectId !== filterSubject) return;
      names.add(q.topicName || "General / No topic");
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
        className="flex flex-nowrap gap-1 overflow-x-auto rounded-2xl p-1.5 self-start max-w-full"
        style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, scrollbarWidth: "none" }}
      >
        {ADMIN_TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all sm:gap-2 sm:px-5 sm:text-sm"
              style={{
                backgroundColor: active ? t.purpleStrong : "transparent",
                color: active ? "#fff" : t.textMuted,
                boxShadow: active ? `0 2px 8px ${t.purpleStrong}55` : "none",
              }}
            >
              <tab.icon size={15} className="shrink-0" />
              {tab.label}
              {tab.id === "manage_mcq" && (
                <span
                  className="rounded-full px-2 py-0.2 text-[11px] font-mono font-bold"
                  style={{ backgroundColor: active ? "rgba(255,255,255,0.25)" : t.surface, color: active ? "#fff" : t.teal }}
                >
                  {allQuestions.length}
                </span>
              )}
              {tab.id === "manage_lecture" && (
                <span
                  className="rounded-full px-2 py-0.2 text-[11px] font-mono font-bold"
                  style={{ backgroundColor: active ? "rgba(255,255,255,0.25)" : t.surface, color: active ? "#fff" : t.teal }}
                >
                  {lectures.length}
                </span>
              )}
              {tab.id === "manage_ospe_book" && (
                <span
                  className="rounded-full px-2 py-0.2 text-[11px] font-mono font-bold"
                  style={{ backgroundColor: active ? "rgba(255,255,255,0.25)" : t.surface, color: active ? "#fff" : t.teal }}
                >
                  {ospeBooks.length}
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
          {!email && (
            <div
              className="flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-bold shadow-sm"
              style={{ backgroundColor: `${t.red}20`, border: `1.5px solid ${t.red}`, color: t.red }}
            >
              <XCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                You aren't logged in. The admin panel password only unlocks this screen — Firestore also requires
                you to be signed in with an account that has been granted real admin rights. Log in first, then make
                sure that account has run through scripts/setAdminClaim.mjs, or saves below will fail.
              </span>
            </div>
          )}

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

            {/* 5. Topic — MCQ-side 4th level of the hierarchy, scoped to this exact Block + Module + Subject.
                Kept deliberately separate from Lectures' Subheadings (see TopicDoc in types.ts) so the
                two pickers never show or mutate the same list. */}
            <div className="mt-4 border-t pt-4" style={{ borderColor: t.border }}>
              <div className="mb-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                  <ListTree size={13} /> Topic
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={selectedTopic ? selectedTopic.name : newTopicName}
                  onChange={(e) => {
                    setSelectedTopicId("");
                    setNewTopicName(e.target.value);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateTopic()}
                  placeholder="Type a topic, e.g. Coronary Circulation"
                  className="flex-1 min-w-[200px] rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
                  style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                />
                {selectedTopic ? (
                  <button
                    onClick={() => {
                      setSelectedTopicId("");
                      setNewTopicName("");
                    }}
                    className="flex items-center gap-1 rounded-xl px-3 py-2.5 text-xs font-bold transition-all"
                    style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.textMuted }}
                  >
                    <X size={13} /> Clear
                  </button>
                ) : (
                  <Btn t={t} variant="secondary" disabled={!newTopicName.trim() || creatingTopic} onClick={handleCreateTopic}>
                    {creatingTopic ? "Adding\u2026" : "Add"}
                  </Btn>
                )}
              </div>

              {/* Previously used topics in this scope, for quick reuse or removal */}
              {topicsLoading ? (
                <div className="mt-3 flex items-center gap-1.5 text-xs" style={{ color: t.textFaint }}>
                  <Loader2 size={13} className="animate-spin" /> Loading topics&hellip;
                </div>
              ) : (
                topics.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {topics.map((s) => (
                      <Pill
                        key={s.id}
                        t={t}
                        tone="teal"
                        active={selectedTopicId === s.id}
                        onClick={() => {
                          setSelectedTopicId(s.id);
                          setNewTopicName("");
                        }}
                      >
                        {s.name}
                        <X
                          size={11}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTopic(s);
                          }}
                        />
                      </Pill>
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Target Summary Pill */}
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl p-3 text-xs" style={{ backgroundColor: t.surfaceAlt }}>
              <span className="font-bold" style={{ color: t.textMuted }}>Adding to:</span>
              <Pill t={t} tone="teal">Block {effectiveBlock}</Pill>
              <Pill t={t} tone="purple">{effectiveModuleName}</Pill>
              <Pill t={t} tone="gold">{SUBJECT_META[subjectId].label}</Pill>
              {selectedTopic && <Pill t={t} tone="muted">{selectedTopic.name}</Pill>}
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
              className="flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-bold shadow-sm"
              style={{ backgroundColor: `${t.red}20`, border: `1.5px solid ${t.red}`, color: t.red }}
            >
              <XCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{saveWarning || "Failed to save. Please check the format and try again."}</span>
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
          {bankLoadWarning && (
            <div
              className="flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-bold shadow-sm"
              style={{ backgroundColor: `${t.amber}20`, border: `1.5px solid ${t.amber}`, color: t.amber }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>This list may be incomplete. {bankLoadWarning}</span>
            </div>
          )}

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

                {/* Topic Filter */}
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                    Topic
                  </label>
                  {loadingQuestions ? (
                    <div
                      className="flex w-full items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold"
                      style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.textFaint }}
                    >
                      <Loader2 size={13} className="animate-spin" /> Loading topics&hellip;
                    </div>
                  ) : (
                    <select
                      value={filterTopic}
                      onChange={(e) => setFilterTopic(e.target.value)}
                      className="w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none"
                      style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                    >
                      <option value="all">All Topics</option>
                      {availableTopicNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  )}
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
              {(filterBlock !== "all" || filterSubject !== "all" || filterDifficulty !== "all" || filterStatus !== "all" || filterTopic !== "all" || searchQuery) && (
                <button
                  onClick={() => {
                    setFilterBlock("all");
                    setFilterSubject("all");
                    setFilterDifficulty("all");
                    setFilterStatus("all");
                    setFilterTopic("all");
                    setSearchQuery("");
                    setBulkDeleteConfirm(false);
                  }}
                  className="text-xs font-bold underline"
                  style={{ color: t.teal }}
                >
                  Reset All Filters
                </button>
              )}

              {/* Bulk delete — only surfaced once a Topic is selected, so it's scoped to
                  "delete this topic's MCQs" rather than an easy way to wipe everything. */}
              {filterTopic !== "all" && filteredQuestions.length > 0 && (
                !bulkDeleteConfirm ? (
                  <button
                    onClick={() => setBulkDeleteConfirm(true)}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all text-red-400 hover:bg-red-500/10"
                    title={`Delete all ${filteredQuestions.length} MCQs in "${filterTopic}"`}
                  >
                    <Trash2 size={13} /> Delete All {filteredQuestions.length} in "{filterTopic}"
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
                        {qItem.topicName && <Pill t={t} tone="muted">{qItem.topicName}</Pill>}
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

      {/* ===================================================================== */}
      {/* TAB 3: ADD LECTURE                                                    */}
      {/* ===================================================================== */}
      {activeTab === "add_lecture" && (
        <div className="flex flex-col gap-6">
          <Card t={t} style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}>
            <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: t.border }}>
              <div className="flex items-center gap-2">
                <Layers size={17} color={t.purple} />
                <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>
                  Target Assignment (Combine Any Block with Any Module)
                </span>
              </div>
              <span className="text-xs" style={{ color: t.textFaint }}>
                Lectures follow the same Block &rarr; Module &rarr; Subject &rarr; Subheading scaffold as MCQs
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* 1. Block Selector */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                  Target Block
                </label>
                {!isCustomLectureBlock ? (
                  <select
                    value={lectureBlock}
                    onChange={(e) => setLectureBlock(Number(e.target.value))}
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
                    value={customLectureBlockInput}
                    onChange={(e) => setCustomLectureBlockInput(e.target.value)}
                    placeholder="Enter Block #"
                    className="w-full rounded-xl px-3 py-2 text-sm font-semibold outline-none"
                    style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                  />
                )}
                <button
                  onClick={() => setIsCustomLectureBlock(!isCustomLectureBlock)}
                  className="mt-1 text-[11px] font-bold underline"
                  style={{ color: t.teal }}
                >
                  {isCustomLectureBlock ? "Choose from standard 1–15" : "+ Custom Block #"}
                </button>
              </div>

              {/* 2. Module Selector */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                  Target Module
                </label>
                {!isCustomLectureModule ? (
                  <select
                    value={lectureModulePreset}
                    onChange={(e) => setLectureModulePreset(e.target.value)}
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
                    value={customLectureModuleName}
                    onChange={(e) => setCustomLectureModuleName(e.target.value)}
                    placeholder="e.g. Cardiovascular-I"
                    className="w-full rounded-xl px-3 py-2 text-sm font-semibold outline-none"
                    style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                  />
                )}
                <button
                  onClick={() => setIsCustomLectureModule(!isCustomLectureModule)}
                  className="mt-1 text-[11px] font-bold underline"
                  style={{ color: t.teal }}
                >
                  {isCustomLectureModule ? "Choose from standard modules" : "+ Type Custom Module Name"}
                </button>
              </div>

              {/* 3. Subject Selector */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                  Discipline / Subject
                </label>
                <select
                  value={lectureSubjectId}
                  onChange={(e) => setLectureSubjectId(e.target.value as SubjectId)}
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
                  {SUBJECT_META[lectureSubjectId]?.defaultYear}
                </span>
              </div>
            </div>

            {/* 4. Subheading — 4th level of the hierarchy, scoped to this exact Block + Module + Subject */}
            <div className="mt-4 border-t pt-4" style={{ borderColor: t.border }}>
              <div className="mb-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                  <ListTree size={13} /> Subheading
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={selectedLectureSubheading ? selectedLectureSubheading.name : newLectureSubheadingName}
                  onChange={(e) => {
                    setSelectedLectureSubheadingId("");
                    setNewLectureSubheadingName(e.target.value);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateLectureSubheading()}
                  placeholder="Type a subheading, e.g. Coronary Circulation"
                  className="flex-1 min-w-[200px] rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
                  style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                />
                {selectedLectureSubheading ? (
                  <button
                    onClick={() => {
                      setSelectedLectureSubheadingId("");
                      setNewLectureSubheadingName("");
                    }}
                    className="flex items-center gap-1 rounded-xl px-3 py-2.5 text-xs font-bold transition-all"
                    style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.textMuted }}
                  >
                    <X size={13} /> Clear
                  </button>
                ) : (
                  <Btn t={t} variant="secondary" disabled={!newLectureSubheadingName.trim() || creatingLectureSubheading} onClick={handleCreateLectureSubheading}>
                    {creatingLectureSubheading ? "Adding\u2026" : "Add"}
                  </Btn>
                )}
              </div>

              {lectureSubheadingsLoading ? (
                <div className="mt-3 flex items-center gap-1.5 text-xs" style={{ color: t.textFaint }}>
                  <Loader2 size={13} className="animate-spin" /> Loading subheadings&hellip;
                </div>
              ) : (
                lectureSubheadings.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {lectureSubheadings.map((s) => (
                      <Pill
                        key={s.id}
                        t={t}
                        tone="teal"
                        active={selectedLectureSubheadingId === s.id}
                        onClick={() => {
                          setSelectedLectureSubheadingId(s.id);
                          setNewLectureSubheadingName("");
                        }}
                      >
                        {s.name}
                      </Pill>
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Target Summary Pill */}
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl p-3 text-xs" style={{ backgroundColor: t.surfaceAlt }}>
              <span className="font-bold" style={{ color: t.textMuted }}>Adding to:</span>
              <Pill t={t} tone="teal">Block {effectiveLectureBlock}</Pill>
              <Pill t={t} tone="purple">{effectiveLectureModuleName}</Pill>
              <Pill t={t} tone="gold">{SUBJECT_META[lectureSubjectId].label}</Pill>
              {selectedLectureSubheading && <Pill t={t} tone="muted">{selectedLectureSubheading.name}</Pill>}
            </div>
          </Card>

          {/* Lecture Details Card */}
          <Card t={t} style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}>
            <div className="flex items-center gap-2 border-b pb-3 mb-4" style={{ borderColor: t.border }}>
              <Youtube size={17} color={t.purple} />
              <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>Lecture Details</span>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                  Lecture Title
                </label>
                <input
                  type="text"
                  value={lectureTitle}
                  onChange={(e) => setLectureTitle(e.target.value)}
                  placeholder="e.g. Cardiac Cycle Explained"
                  className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
                  style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                  YouTube Link
                </label>
                <input
                  type="text"
                  value={lectureUrl}
                  onChange={(e) => setLectureUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
                  style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                />
                {lectureUrl.trim() && !toYouTubeEmbedUrl(lectureUrl) && (
                  <span className="mt-1 block text-[11px] font-bold" style={{ color: t.gold }}>
                    Couldn't recognize that as a YouTube link — paste the full video URL.
                  </span>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                  Description (optional)
                </label>
                <textarea
                  value={lectureDescription}
                  onChange={(e) => setLectureDescription(e.target.value)}
                  placeholder="What this lecture covers..."
                  rows={3}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                  style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer" style={{ color: t.textMuted }}>
                <input
                  type="checkbox"
                  checked={lecturePublishImmediately}
                  onChange={(e) => setLecturePublishImmediately(e.target.checked)}
                  className="accent-purple-500 rounded"
                />
                Publish immediately (Live)
              </label>

              {lectureSaveStatus === "success" && (
                <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold" style={{ backgroundColor: `${t.green}20`, color: t.green }}>
                  <CheckCircle2 size={16} /> Lecture saved to Firestore!
                </div>
              )}
              {lectureSaveStatus === "success-local" && (
                <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs font-semibold" style={{ backgroundColor: `${t.gold}20`, color: t.gold }}>
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{lectureSaveWarning}</span>
                </div>
              )}
              {lectureSaveStatus === "error" && (
                <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold" style={{ backgroundColor: `${t.red}20`, color: t.red }}>
                  <XCircle size={16} /> Failed to save lecture. Try again.
                </div>
              )}

              <Btn t={t} disabled={!isLectureValid} onClick={handleSaveLecture}>
                Save Lecture
              </Btn>
            </div>
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: MANAGE LECTURES                                                */}
      {/* ===================================================================== */}
      {activeTab === "manage_lecture" && (
        <div className="flex flex-col gap-5">
          {lectureBankWarning && (
            <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs font-semibold" style={{ backgroundColor: `${t.gold}20`, color: t.gold }}>
              <AlertTriangle size={15} className="shrink-0 mt-0.5" /> <span>{lectureBankWarning}</span>
            </div>
          )}

          {/* Filters */}
          <Card t={t} style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}>
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" color={t.textFaint} />
                <input
                  type="text"
                  value={lectureSearchQuery}
                  onChange={(e) => setLectureSearchQuery(e.target.value)}
                  placeholder="Search lectures by title, description, module, subheading..."
                  className="w-full rounded-xl py-2.5 pl-9 pr-3 text-sm font-semibold outline-none"
                  style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={lectureFilterBlock}
                  onChange={(e) => setLectureFilterBlock(e.target.value)}
                  className="rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                >
                  <option value="all">All Blocks</option>
                  {Array.from({ length: TOTAL_BLOCKS }, (_, i) => i + 1).map((b) => (
                    <option key={b} value={b}>Block {b}</option>
                  ))}
                </select>
                <select
                  value={lectureFilterSubject}
                  onChange={(e) => setLectureFilterSubject(e.target.value)}
                  className="rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                >
                  <option value="all">All Subjects</option>
                  {SUBJECT_LIST.map((s) => (
                    <option key={s} value={s}>{SUBJECT_META[s].label}</option>
                  ))}
                </select>
                <select
                  value={lectureFilterStatus}
                  onChange={(e) => setLectureFilterStatus(e.target.value)}
                  className="rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                >
                  <option value="all">All Statuses</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>
          </Card>

          {loadingLectures ? (
            <div className="flex items-center justify-center py-16">
              <Spinner t={t} size={22} label="Loading lectures\u2026" />
            </div>
          ) : filteredLectures.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-2 rounded-2xl p-10 text-center"
              style={{ backgroundColor: t.surfaceAlt, border: `1.5px dashed ${t.border}` }}
            >
              <Youtube size={22} color={t.textFaint} />
              <p className="text-sm font-semibold" style={{ color: t.textMuted }}>No lectures match these filters.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredLectures.map((l) => (
                <div
                  key={l.id}
                  className="flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
                  style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}` }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <Pill t={t} tone="teal">Block {l.block}</Pill>
                      <Pill t={t} tone="purple">{l.moduleName}</Pill>
                      <Pill t={t} tone="gold">{SUBJECT_META[l.subjectId as SubjectId]?.label || l.subjectId}</Pill>
                      {l.subheadingName && <Pill t={t} tone="muted">{l.subheadingName}</Pill>}
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{
                          backgroundColor: l.status === "published" ? `${t.green}20` : `${t.textFaint}20`,
                          color: l.status === "published" ? t.green : t.textFaint,
                        }}
                      >
                        {l.status === "published" ? "Published" : "Draft"}
                      </span>
                    </div>
                    <h4 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>{l.title}</h4>
                    {l.description && (
                      <p className="mt-0.5 text-xs" style={{ color: t.textMuted }}>{l.description}</p>
                    )}
                    <a
                      href={l.youtubeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 flex w-fit items-center gap-1 text-[11px] font-bold hover:opacity-80"
                      style={{ color: t.teal }}
                    >
                      Watch on YouTube <ExternalLink size={11} />
                    </a>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => handleToggleLectureStatus(l)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}
                      title={l.status === "published" ? "Unpublish" : "Publish"}
                    >
                      {l.status === "published" ? <EyeOff size={15} color={t.textMuted} /> : <Eye size={15} color={t.green} />}
                    </button>
                    <button
                      onClick={() => handleDeleteLecture(l)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${t.red}15`, border: `1.5px solid ${t.red}40` }}
                      title="Delete lecture"
                    >
                      <Trash2 size={15} color={t.red} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: ADD OSPE BOOK                                                  */}
      {/* ===================================================================== */}
      {activeTab === "add_ospe_book" && (
        <div className="flex flex-col gap-6">
          <Card t={t} style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}>
            <div className="flex items-center gap-2 border-b pb-3 mb-4" style={{ borderColor: t.border }}>
              <BookMarked size={17} color={t.purple} />
              <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>OSPE Book Details</span>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                  Discipline / Subject
                </label>
                <select
                  value={ospeSubjectId}
                  onChange={(e) => setOspeSubjectId(e.target.value as SubjectId)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
                  style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                >
                  {SUBJECT_LIST.map((s) => (
                    <option key={s} value={s} style={{ backgroundColor: t.surface, color: t.text }}>
                      {SUBJECT_META[s].label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                  Book Title
                </label>
                <input
                  type="text"
                  value={ospeTitle}
                  onChange={(e) => setOspeTitle(e.target.value)}
                  placeholder="e.g. Gross Anatomy OSPE Guide"
                  className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
                  style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                  Google Drive Link
                </label>
                <input
                  type="text"
                  value={ospeDriveUrl}
                  onChange={(e) => setOspeDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                  className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
                  style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                />
                <span className="mt-1 block text-[11px]" style={{ color: t.textFaint }}>
                  Set the file's sharing to "Anyone with the link" in Google Drive so students can open it.
                </span>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
                  Description (optional)
                </label>
                <textarea
                  value={ospeDescription}
                  onChange={(e) => setOspeDescription(e.target.value)}
                  placeholder="What this book covers..."
                  rows={3}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                  style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer" style={{ color: t.textMuted }}>
                <input
                  type="checkbox"
                  checked={ospePublishImmediately}
                  onChange={(e) => setOspePublishImmediately(e.target.checked)}
                  className="accent-purple-500 rounded"
                />
                Publish immediately (Live)
              </label>

              {ospeSaveStatus === "success" && (
                <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold" style={{ backgroundColor: `${t.green}20`, color: t.green }}>
                  <CheckCircle2 size={16} /> OSPE Book saved to Firestore!
                </div>
              )}
              {ospeSaveStatus === "success-local" && (
                <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs font-semibold" style={{ backgroundColor: `${t.gold}20`, color: t.gold }}>
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{ospeSaveWarning}</span>
                </div>
              )}
              {ospeSaveStatus === "error" && (
                <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold" style={{ backgroundColor: `${t.red}20`, color: t.red }}>
                  <XCircle size={16} /> Failed to save OSPE Book. Try again.
                </div>
              )}

              <Btn t={t} disabled={!isOspeValid} onClick={handleSaveOspeBook}>
                Save OSPE Book
              </Btn>
            </div>
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 6: MANAGE OSPE BOOKS                                              */}
      {/* ===================================================================== */}
      {activeTab === "manage_ospe_book" && (
        <div className="flex flex-col gap-5">
          {ospeBankWarning && (
            <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs font-semibold" style={{ backgroundColor: `${t.gold}20`, color: t.gold }}>
              <AlertTriangle size={15} className="shrink-0 mt-0.5" /> <span>{ospeBankWarning}</span>
            </div>
          )}

          {/* Filters */}
          <Card t={t} style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}>
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" color={t.textFaint} />
                <input
                  type="text"
                  value={ospeSearchQuery}
                  onChange={(e) => setOspeSearchQuery(e.target.value)}
                  placeholder="Search OSPE Books by title or description..."
                  className="w-full rounded-xl py-2.5 pl-9 pr-3 text-sm font-semibold outline-none"
                  style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={ospeFilterSubject}
                  onChange={(e) => setOspeFilterSubject(e.target.value)}
                  className="rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                >
                  <option value="all">All Subjects</option>
                  {SUBJECT_LIST.map((s) => (
                    <option key={s} value={s}>{SUBJECT_META[s].label}</option>
                  ))}
                </select>
                <select
                  value={ospeFilterStatus}
                  onChange={(e) => setOspeFilterStatus(e.target.value)}
                  className="rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
                >
                  <option value="all">All Statuses</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>
          </Card>

          {loadingOspeBooks ? (
            <div className="flex items-center justify-center py-16">
              <Spinner t={t} size={22} label="Loading OSPE Books\u2026" />
            </div>
          ) : filteredOspeBooks.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-2 rounded-2xl p-10 text-center"
              style={{ backgroundColor: t.surfaceAlt, border: `1.5px dashed ${t.border}` }}
            >
              <Library size={22} color={t.textFaint} />
              <p className="text-sm font-semibold" style={{ color: t.textMuted }}>No OSPE Books match these filters.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredOspeBooks.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
                  style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}` }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <Pill t={t} tone="gold">{SUBJECT_META[b.subjectId as SubjectId]?.label || b.subjectId}</Pill>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{
                          backgroundColor: b.status === "published" ? `${t.green}20` : `${t.textFaint}20`,
                          color: b.status === "published" ? t.green : t.textFaint,
                        }}
                      >
                        {b.status === "published" ? "Published" : "Draft"}
                      </span>
                    </div>
                    <h4 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>{b.title}</h4>
                    {b.description && (
                      <p className="mt-0.5 text-xs" style={{ color: t.textMuted }}>{b.description}</p>
                    )}
                    <a
                      href={b.driveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 flex w-fit items-center gap-1 text-[11px] font-bold hover:opacity-80"
                      style={{ color: t.teal }}
                    >
                      Open in Google Drive <ExternalLink size={11} />
                    </a>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => handleToggleOspeBookStatus(b)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}
                      title={b.status === "published" ? "Unpublish" : "Publish"}
                    >
                      {b.status === "published" ? <EyeOff size={15} color={t.textMuted} /> : <Eye size={15} color={t.green} />}
                    </button>
                    <button
                      onClick={() => handleDeleteOspeBook(b)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${t.red}15`, border: `1.5px solid ${t.red}40` }}
                      title="Delete OSPE Book"
                    >
                      <Trash2 size={15} color={t.red} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>

  );
}
