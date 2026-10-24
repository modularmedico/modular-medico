import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Lock,
  Play,
  FolderTree,
  BookOpen,
  Trophy,
  ClipboardList,
  FileStack,
  Layers,
} from "lucide-react";
import Card from "../components/Card";
import Pill from "../components/Pill";
import Btn from "../components/Btn";
import Spinner from "../components/Spinner";
import SubjectIcon from "../components/SubjectIcon";
import { THEME, FONT_DISPLAY, FONT_MONO } from "../theme";
import { useAppStore, useCanAccessTestSeries, useIsLoggedIn, useIsPremium } from "../store/useAppStore";
import { DEFAULT_BLOCK_DEFINITIONS, isSubjectId, type SubjectId } from "../data/subjects";
import {
  subscribeBlockCounts,
  subscribeBlockDefinitions,
  subscribeBlockOutline,
  fetchPublishedBlock,
  type BlockOutline,
} from "../services/adminContent";
import { subscribePublishedPastPapers } from "../services/pastPapers";
import { subscribePublishedTestSessions } from "../services/testSessions";
import {
  GENERAL_LABEL,
  distinctCount,
  entriesFromPapers,
  entriesFromTests,
  isHubKind,
  subjectLabel,
  topicToKey,
  type HubEntry,
  type HubKind,
} from "./hubShared";

const YEARS = [
  { id: "all", label: "All Blocks" },
  { id: "1st", label: "1st Year (B1\u20133)" },
  { id: "2nd", label: "2nd Year (B4\u20136)" },
  { id: "3rd", label: "3rd Year (B7\u20139)" },
  { id: "4th", label: "4th Year (B10\u201312)" },
  { id: "5th", label: "Final Year (B13\u201315)" },
];

const KIND_INFO: Record<HubKind, { title: string; unit: string; units: string; icon: typeof BookOpen }> = {
  mcqs: { title: "Practice MCQs", unit: "Q", units: "Qs", icon: BookOpen },
  tests: { title: "Test Sessions", unit: "Test", units: "Tests", icon: ClipboardList },
  papers: { title: "UHS Past Papers", unit: "Paper", units: "Papers", icon: FileStack },
};

interface Row {
  key: string;
  title: string;
  subtitle?: string;
  count: number;
  subjectId?: string;
  locked?: boolean;
  free?: boolean;
  onClick: () => void;
}

/**
 * One page component for all four drill-down levels of all three hubs:
 *   /browse/:kind                              -> Blocks
 *   /browse/:kind/:block                       -> Modules
 *   /browse/:kind/:block/:moduleId             -> Subjects
 *   /browse/:kind/:block/:moduleId/:subjectId  -> Subheadings
 */
export default function HubBrowse() {
  const navigate = useNavigate();
  const { kind: kindParam, block: blockParam, moduleId, subjectId } = useParams();
  const kind: HubKind = isHubKind(kindParam) ? kindParam : "mcqs";
  const info = KIND_INFO[kind];
  const blockNum = blockParam === undefined ? undefined : Number(blockParam);
  const level: 0 | 1 | 2 | 3 = blockNum === undefined ? 0 : !moduleId ? 1 : !subjectId ? 2 : 3;

  const isDark = useAppStore((s) => s.isDark);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const isLoggedIn = useIsLoggedIn();
  const isPremium = useIsPremium();
  const canAccessTests = useCanAccessTestSeries();
  const unlockedBlocks = useAppStore((s) => s.profile?.unlockedBlocks);
  const freeBlocks = useAppStore((s) => s.freeBlocks);
  const freeSubjects = useAppStore((s) => s.freeSubjects);
  const t = isDark ? THEME.dark : THEME.light;
  const accent = kind === "mcqs" ? t.teal : kind === "tests" ? t.purple : t.gold;

  // MCQ access rules (same as the old Block page).
  const isBlockUnlocked = (b: number) => freeBlocks.includes(b) || isAdmin || isPremium || !!unlockedBlocks?.includes(b);
  const isBlockBadgeLocked = (b: number) => !freeBlocks.includes(b) && !isPremium && !unlockedBlocks?.includes(b);
  const isSubjectOpen = (b: number, s: string) => isBlockUnlocked(b) || !!freeSubjects[b]?.includes(s);
  const goPaywall = () => navigate(isLoggedIn ? "/paywall" : "/signup");

  const [yearFilter, setYearFilter] = useState("all");
  const [blockDefs, setBlockDefs] = useState(DEFAULT_BLOCK_DEFINITIONS);
  useEffect(() => subscribeBlockDefinitions(setBlockDefs), []);

  // ---- Tests / Papers: one flat list of entries placed on the tree ----
  const [entries, setEntries] = useState<HubEntry[]>([]);
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  useEffect(() => {
    setEntries([]);
    setEntriesLoaded(false);
    if (kind === "papers") {
      return subscribePublishedPastPapers((p) => {
        setEntries(entriesFromPapers(p));
        setEntriesLoaded(true);
      });
    }
    if (kind === "tests") {
      if (!canAccessTests) {
        setEntriesLoaded(true);
        return;
      }
      return subscribePublishedTestSessions(
        (list) => {
          setEntries(entriesFromTests(list.filter((x) => x.questions.length > 0)));
          setEntriesLoaded(true);
        },
        () => setEntriesLoaded(true)
      );
    }
    setEntriesLoaded(true);
  }, [kind, canAccessTests]);

  // ---- MCQs: block counts (level 0) and the module -> subject outline (levels 1-3) ----
  const [blockCounts, setBlockCounts] = useState<Record<number, number> | null>(null);
  const blockKey = blockDefs.map((b) => b.block).join(",");
  useEffect(() => {
    if (kind !== "mcqs" || level !== 0) return;
    const blocks = blockKey ? blockKey.split(",").map(Number) : [];
    return subscribeBlockCounts(blocks, setBlockCounts);
  }, [kind, level, blockKey]);

  const [outline, setOutline] = useState<BlockOutline | null>(null);
  useEffect(() => {
    setOutline(null);
    if (kind !== "mcqs" || blockNum === undefined || !Number.isInteger(blockNum)) return;
    return subscribeBlockOutline(blockNum, setOutline);
  }, [kind, blockNum]);

  // ---- MCQs level 3: subheading (topic) names with question counts ----
  const [topicCounts, setTopicCounts] = useState<{ name: string; count: number }[] | null>(null);
  useEffect(() => {
    setTopicCounts(null);
    if (kind !== "mcqs" || level !== 3 || !subjectId || !moduleId || blockNum === undefined) return;
    let cancelled = false;
    fetchPublishedBlock(subjectId, moduleId, blockNum).then((qs) => {
      if (cancelled) return;
      const map = new Map<string, number>();
      qs.forEach((q) => {
        const name = (q.topicName || q.subheadingName || "").trim();
        if (name) map.set(name, (map.get(name) || 0) + 1);
      });
      setTopicCounts(
        Array.from(map.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      );
    });
    return () => {
      cancelled = true;
    };
  }, [kind, level, subjectId, moduleId, blockNum]);

  const base = `/browse/${kind}`;
  const blockDef = blockDefs.find((b) => b.block === blockNum);
  const blockTitle = blockDef?.title ?? (blockNum !== undefined ? `Block ${blockNum}` : "");
  const blockLocked = blockNum !== undefined && kind === "mcqs" && !isBlockUnlocked(blockNum);

  // ---- Build the rows for the current level ----
  const loaded =
    kind !== "mcqs"
      ? entriesLoaded
      : level === 0
      ? blockCounts !== null
      : level === 3
      ? topicCounts !== null && outline !== null
      : outline !== null;

  const inBlock = useMemo(() => entries.filter((e) => e.block === blockNum), [entries, blockNum]);

  const moduleList = useMemo(() => {
    if (kind === "mcqs") {
      return (outline?.modules ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        count: m.total,
        subjectIds: m.subjects.map((s) => s.subjectId),
      }));
    }
    const map = new Map<string, { id: string; name: string; subjects: Set<string>; items: HubEntry[] }>();
    inBlock.forEach((e) => {
      const m = map.get(e.moduleId) ?? { id: e.moduleId, name: e.moduleName, subjects: new Set<string>(), items: [] };
      m.subjects.add(e.subjectId);
      m.items.push(e);
      map.set(e.moduleId, m);
    });
    return Array.from(map.values()).map((m) => ({
      id: m.id,
      name: m.name,
      count: distinctCount(m.items),
      subjectIds: Array.from(m.subjects),
    }));
  }, [kind, outline, inBlock]);

  const currentModule = moduleList.find((m) => m.id === moduleId);
  const moduleName = currentModule?.name ?? (moduleId ?? "");

  const subjectRows = useMemo(() => {
    if (level < 2) return [];
    if (kind === "mcqs") {
      return (outline?.modules.find((m) => m.id === moduleId)?.subjects ?? []).map((s) => ({
        subjectId: s.subjectId,
        count: s.count,
      }));
    }
    const map = new Map<string, HubEntry[]>();
    inBlock
      .filter((e) => e.moduleId === moduleId)
      .forEach((e) => map.set(e.subjectId, [...(map.get(e.subjectId) ?? []), e]));
    return Array.from(map.entries()).map(([sid, items]) => ({ subjectId: sid, count: distinctCount(items) }));
  }, [kind, level, outline, inBlock, moduleId]);

  const topicRows = useMemo(() => {
    if (level < 3) return [];
    if (kind === "mcqs") return topicCounts ?? [];
    const map = new Map<string, { name: string | null; items: HubEntry[] }>();
    inBlock
      .filter((e) => e.moduleId === moduleId && e.subjectId === subjectId)
      .forEach((e) => {
        const k = topicToKey(e.topic);
        const cur = map.get(k) ?? { name: e.topic, items: [] };
        cur.items.push(e);
        map.set(k, cur);
      });
    return Array.from(map.values())
      .map((g) => ({ name: g.name ?? GENERAL_LABEL, key: topicToKey(g.name), count: distinctCount(g.items) }))
      .sort((a, b) => (a.key === "__general" ? 1 : b.key === "__general" ? -1 : a.name.localeCompare(b.name, undefined, { numeric: true })));
  }, [kind, level, topicCounts, inBlock, moduleId, subjectId]);

  const countLabel = (n: number) => (kind === "mcqs" ? `${n} Qs` : `${n} ${n === 1 ? info.unit : info.units}`);

  // ---- Navigation helpers ----
  const openTopic = (name: string | null, key: string | null) => {
    if (blockNum === undefined || !moduleId || !subjectId) return;
    if (kind === "mcqs") {
      if (!isSubjectOpen(blockNum, subjectId)) return goPaywall();
      navigate(`/subjects/${subjectId}/${moduleId}/${blockNum}${name ? `?topic=${encodeURIComponent(name)}` : ""}`);
    } else if (kind === "tests") {
      const q = new URLSearchParams({ block: String(blockNum), module: moduleId, subject: subjectId });
      if (key) q.set("topic", key);
      navigate(`/tests?${q.toString()}`);
    } else {
      const q = new URLSearchParams({ module: moduleId });
      if (key) q.set("topic", key);
      navigate(`/past-papers/${blockNum}/${subjectId}?${q.toString()}`);
    }
  };

  const [rows, headerTitle, headerSub, backTo, backLabel]: [Row[], string, string, string, string] = (() => {
    if (level === 0) {
      const filtered = blockDefs.filter((b) => {
        if (yearFilter === "1st") return b.block <= 3;
        if (yearFilter === "2nd") return b.block >= 4 && b.block <= 6;
        if (yearFilter === "3rd") return b.block >= 7 && b.block <= 9;
        if (yearFilter === "4th") return b.block >= 10 && b.block <= 12;
        if (yearFilter === "5th") return b.block >= 13;
        return true;
      });
      const r: Row[] = filtered.map((b) => ({
        key: String(b.block),
        title: `B${b.block}`,
        subtitle: b.title.split(" ")[0],
        count:
          kind === "mcqs"
            ? blockCounts?.[b.block] ?? 0
            : distinctCount(entries.filter((e) => e.block === b.block)),
        locked: kind === "mcqs" && isBlockBadgeLocked(b.block),
        onClick: () => navigate(`${base}/${b.block}`),
      }));
      return [r, info.title, "Choose a Block to continue.", "/", "Home"];
    }
    if (level === 1) {
      const r: Row[] = moduleList.map((m) => ({
        key: m.id,
        title: m.name,
        subtitle: `${m.subjectIds.length} ${m.subjectIds.length === 1 ? "subject" : "subjects"}`,
        count: m.count,
        locked:
          kind === "mcqs" && m.subjectIds.length > 0 && m.subjectIds.every((s) => !isSubjectOpen(blockNum!, s)),
        onClick: () => navigate(`${base}/${blockNum}/${m.id}`),
      }));
      return [r, blockTitle, "Choose a Module.", base, info.title];
    }
    if (level === 2) {
      const r: Row[] = subjectRows.map((s) => {
        const open = kind !== "mcqs" || isSubjectOpen(blockNum!, s.subjectId);
        return {
          key: s.subjectId,
          title: subjectLabel(s.subjectId),
          count: s.count,
          subjectId: s.subjectId,
          locked: !open,
          free: kind === "mcqs" && blockLocked && open,
          onClick: () => (open ? navigate(`${base}/${blockNum}/${moduleId}/${s.subjectId}`) : goPaywall()),
        };
      });
      return [r, moduleName, "Choose a Subject.", `${base}/${blockNum}`, blockTitle];
    }
    const r: Row[] = topicRows.map((tp) => ({
      key: "key" in tp ? tp.key : tp.name,
      title: tp.name,
      count: tp.count,
      onClick: () => openTopic(kind === "mcqs" ? tp.name : null, "key" in tp ? tp.key : null),
    }));
    return [r, subjectLabel(subjectId!), "Choose a Subheading.", `${base}/${blockNum}/${moduleId}`, moduleName];
  })();

  // ---- Invalid URL guards ----
  if (!isHubKind(kindParam) || (blockNum !== undefined && !Number.isInteger(blockNum))) {
    return (
      <div className="py-16 text-center">
        <p style={{ color: t.textMuted }}>That page couldn't be found.</p>
        <button onClick={() => navigate("/")} className="mt-3 text-sm font-bold" style={{ color: t.teal }}>
          Back to Home
        </button>
      </div>
    );
  }

  const KindIcon = info.icon;
  const crumbs: { label: string; to: string }[] = [{ label: info.title, to: base }];
  if (level >= 1) crumbs.push({ label: `Block ${blockNum}`, to: `${base}/${blockNum}` });
  if (level >= 2) crumbs.push({ label: moduleName, to: `${base}/${blockNum}/${moduleId}` });
  if (level >= 3) crumbs.push({ label: subjectLabel(subjectId!), to: `${base}/${blockNum}/${moduleId}/${subjectId}` });

  const levelNames = ["Blocks", "Modules", "Subjects", "Subheadings"];
  const emptyText =
    level === 0
      ? "Nothing here yet."
      : `No ${info.units.toLowerCase()} have been added here yet. They appear automatically once published.`;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <button
        onClick={() => navigate(backTo)}
        className="flex items-center gap-1 self-start text-sm font-bold"
        style={{ color: t.textMuted }}
      >
        <ChevronLeft size={15} /> {backLabel}
      </button>

      {/* Breadcrumb trail */}
      {level > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-xs" style={{ color: t.textFaint }}>
          {crumbs.map((c, i) => (
            <span key={c.to} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={11} />}
              <button
                onClick={() => navigate(c.to)}
                className="font-semibold"
                style={{ color: i === crumbs.length - 1 ? t.text : t.textMuted }}
              >
                {c.label}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${accent}22` }}
            >
              <KindIcon size={18} color={accent} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: accent }}>
              {info.title} · {levelNames[level]}
            </span>
          </div>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em", marginTop: 8 }}>
            {headerTitle}
          </h1>
          <p style={{ color: t.textMuted, fontSize: 13.5, marginTop: 2 }}>{headerSub}</p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:w-60">
          {/* MCQs: whole-block and whole-module exams (kept from the old Block page) */}
          {kind === "mcqs" && level === 1 && (
            <Btn
              t={t}
              full
              icon={blockLocked ? Lock : Play}
              onClick={() =>
                blockLocked ? goPaywall() : navigate(`/subjects/all/all/${blockNum}?fullBlock=true`)
              }
            >
              {blockLocked ? `Unlock Block ${blockNum}` : `Start Block ${blockNum} Exam`}
            </Btn>
          )}
          {kind === "mcqs" && level === 2 && currentModule && (
            <Btn
              t={t}
              full
              icon={Play}
              onClick={() =>
                currentModule.subjectIds.some((s) => !isSubjectOpen(blockNum!, s))
                  ? goPaywall()
                  : navigate(`/subjects/all/${moduleId}/${blockNum}`)
              }
            >
              Practice whole Module
            </Btn>
          )}
          {kind === "mcqs" && level === 3 && (
            <Btn t={t} full icon={Play} onClick={() => openTopic(null, null)}>
              Practice all Subheadings
            </Btn>
          )}
          {kind === "tests" && level === 0 && canAccessTests && (
            <Btn t={t} full variant="ghost" icon={Trophy} onClick={() => navigate("/tests?tab=leaderboard")}>
              Leaderboard
            </Btn>
          )}
        </div>
      </div>

      {/* Year filter — blocks page only */}
      {level === 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {YEARS.map((y) => (
            <Pill key={y.id} t={t} active={yearFilter === y.id} onClick={() => setYearFilter(y.id)}>
              {y.label}
            </Pill>
          ))}
        </div>
      )}

      {kind === "tests" && !canAccessTests && (
        <Card t={t} style={{ textAlign: "center", padding: 32 }}>
          <Lock size={28} color={t.textFaint} style={{ margin: "0 auto 10px" }} />
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 16 }}>Test Series is locked</p>
          <p style={{ color: t.textMuted, fontSize: 13, marginTop: 4 }}>
            Test Series access is currently switched off. Check back later or reach out to the team.
          </p>
        </Card>
      )}

      {!(kind === "tests" && !canAccessTests) && !loaded && (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-2xl p-10 text-center"
          style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}` }}
        >
          <Spinner t={t} size={22} label={`Loading ${levelNames[level].toLowerCase()}\u2026`} />
        </div>
      )}

      {!(kind === "tests" && !canAccessTests) && loaded && rows.length === 0 && level > 0 && (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-2xl p-10 text-center"
          style={{ backgroundColor: t.surfaceAlt, border: `1.5px dashed ${t.border}` }}
        >
          <FolderTree size={22} color={t.textFaint} />
          <h4 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>Coming Soon</h4>
          <p className="max-w-sm text-xs" style={{ color: t.textMuted }}>
            {emptyText}
          </p>
        </div>
      )}

      {/* LEVEL 0 — block tiles */}
      {loaded && level === 0 && !(kind === "tests" && !canAccessTests) && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-8">
          {rows.map((r) => (
            <button
              key={r.key}
              onClick={r.onClick}
              className="relative flex flex-col items-center justify-center rounded-2xl p-2.5 text-center transition-all hover:scale-[1.02]"
              style={{
                backgroundColor: t.surfaceAlt,
                color: t.text,
                border: `1.5px solid ${t.border}`,
                opacity: kind !== "mcqs" && r.count === 0 ? 0.55 : 1,
              }}
            >
              {r.locked && (
                <div
                  className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full shadow-md"
                  style={{ backgroundColor: t.gold, color: "#241A08" }}
                  title="Requires Full Access"
                >
                  <Lock size={11} strokeWidth={2.75} />
                </div>
              )}
              <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>{r.title}</span>
              <span className="mt-0.5 max-w-[65px] truncate text-[10px] font-semibold" style={{ color: accent }}>
                {r.subtitle}
              </span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: t.textFaint, marginTop: 2 }}>
                {countLabel(r.count)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* LEVELS 1-3 — list cards */}
      {loaded && level > 0 && rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <Card
              key={r.key}
              t={t}
              onClick={r.onClick}
              className="flex cursor-pointer items-center gap-4 transition-all hover:scale-[1.01]"
            >
              <div
                className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${accent}22` }}
              >
                {r.locked && (
                  <div
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full shadow-sm"
                    style={{ backgroundColor: t.gold, color: "#241A08" }}
                  >
                    <Lock size={8} strokeWidth={3} />
                  </div>
                )}
                {level === 2 && r.subjectId && isSubjectId(r.subjectId) ? (
                  <SubjectIcon id={r.subjectId as SubjectId} color={accent} size={16} />
                ) : level === 1 ? (
                  <Layers size={18} color={accent} />
                ) : (
                  <FolderTree size={18} color={accent} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>{r.title}</span>
                {r.subtitle && (
                  <div className="truncate text-xs" style={{ color: t.textFaint }}>
                    {r.subtitle}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {r.free && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ backgroundColor: `${t.teal}22`, color: t.teal }}
                  >
                    FREE
                  </span>
                )}
                <span
                  className="rounded-full px-2.5 py-1 font-mono text-xs font-bold"
                  style={{ backgroundColor: `${t.gold}18`, color: t.gold }}
                >
                  {countLabel(r.count)}
                </span>
                <ArrowRight size={16} color={t.textFaint} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
