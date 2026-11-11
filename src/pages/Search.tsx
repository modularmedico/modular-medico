import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search as SearchIcon, ArrowRight, Loader2, BookOpen } from "lucide-react";
import { THEME, FONT_DISPLAY, FONT_BODY } from "../theme";
import { useAppStore } from "../store/useAppStore";
import { searchGlobalQuestions } from "../services/adminContent";
import type { FirestoreQuestion, PracticeConfig } from "../types";
import Card from "../components/Card";
import Btn from "../components/Btn";
import Pill from "../components/Pill";
import { useStartGuard } from "../hooks/useStartGuard";

export default function Search() {
  const navigate = useNavigate();
  const isDark = useAppStore((s) => s.isDark);
  const t = isDark ? THEME.dark : THEME.light;
  const startSession = useAppStore((s) => s.startSession);
  const { guard, modal } = useStartGuard();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FirestoreQuestion[]>([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const delay = setTimeout(() => {
      if (query.trim().length >= 3) {
        performSearch(query);
      } else {
        setResults([]);
        setSearched(false);
      }
    }, 500);
    return () => clearTimeout(delay);
  }, [query]);

  const performSearch = async (q: string) => {
    setLoading(true);
    setSearched(true);
    try {
      const res = await searchGlobalQuestions(q);
      setResults(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startPractice = () => {
    if (results.length === 0) return;
    const config: PracticeConfig = {
      mode: "traditional",
      timing: "untimed",
      spacedRep: true,
      difficultyFilter: "all"
    };
    guard(() => {
      startSession(
        {
          subjectId: "search",
          moduleId: "global-search",
          moduleName: "Global Search",
          block: 0,
          setTitle: `Search Results: "${query}"`,
          questions: results
        },
        config
      );
      navigate("/practice");
    }, `the search results for "${query}"`);
  };

  return (
    <div className="mx-auto max-w-3xl flex flex-col gap-6 pt-4 pb-12">
      <div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26, marginBottom: 8 }}>Global Search</h1>
        <p style={{ color: t.textMuted, fontSize: 14 }}>Search for keywords across all blocks, modules, and subjects to generate custom practice sets.</p>
      </div>

      <div className="relative">
        <input
          autoFocus
          placeholder="e.g. tuberculosis, cranial nerve, ACE inhibitor..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-2xl pl-12 pr-4 py-4 outline-none transition-all shadow-sm focus:shadow-md"
          style={{
            backgroundColor: t.surface,
            border: `2px solid ${query.length > 0 ? t.purple : t.border}`,
            color: t.text,
            fontFamily: FONT_BODY,
            fontSize: 16
          }}
        />
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2" color={t.textFaint} size={20} />
        {loading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin" color={t.purple} size={20} />}
      </div>

      {searched && !loading && (
        <div className="flex items-center justify-between mt-2">
          <span className="font-bold text-sm" style={{ color: t.textMuted }}>
            {results.length} {results.length === 1 ? "question" : "questions"} found
          </span>
          {results.length > 0 && (
            <Btn t={t} onClick={startPractice} icon={ArrowRight}>
              Practice These
            </Btn>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 mt-2">
        {results.map((q, idx) => (
          <Card key={q.id || idx} t={t} className="flex flex-col gap-3">
            <div className="flex gap-2 mb-2 flex-wrap">
              <Pill t={t} tone="purple">Block {q.block}</Pill>
              <Pill t={t} tone="teal">{q.moduleName}</Pill>
              <Pill t={t} tone="gold">{q.subjectId}</Pill>
            </div>
            <h3 style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 15, lineHeight: 1.5 }}>
              {q.q}
            </h3>
            <p className="line-clamp-2 mt-1 text-sm" style={{ color: t.textMuted }}>
              {q.explanation}
            </p>
          </Card>
        ))}

        {searched && !loading && results.length === 0 && (
          <div className="text-center py-12 rounded-2xl border-dashed border-2" style={{ borderColor: t.border, backgroundColor: t.surfaceAlt }}>
            <BookOpen size={32} color={t.textFaint} className="mx-auto mb-3" />
            <p className="font-bold text-sm" style={{ color: t.textMuted }}>No questions found matching "{query}"</p>
          </div>
        )}
      </div>
      {modal}
    </div>
  );
}
