import { useEffect, useMemo, useState } from "react";
import { Trophy, Medal, Loader2, Globe, Clock, Lock } from "lucide-react";
import Card from "./Card";
import { THEME, FONT_DISPLAY, FONT_MONO } from "../theme";
import { useAppStore } from "../store/useAppStore";
import {
  LEADERBOARD_TOP_N,
  rankGlobal,
  rankPerTest,
  subscribeLeaderboardEntries,
} from "../services/testLeaderboard";
import type { TestLeaderboardEntry, TestSessionDoc } from "../types";

interface Props {
  tests: TestSessionDoc[];
  initialTestId?: string | null;
}

const fmtTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const rankColor = (rank: number, fallback: string) =>
  rank === 1 ? "#EAB308" : rank === 2 ? "#9CA3AF" : rank === 3 ? "#CD7F32" : fallback;

/** Global + per-test leaderboard for the Test Series. */
export default function TestLeaderboard({ tests, initialTestId = null }: Props) {
  const isDark = useAppStore((s) => s.isDark);
  const uid = useAppStore((s) => s.uid);
  const t = isDark ? THEME.dark : THEME.light;

  // One board per test (defaults to the first test); null = global (all tests combined)
  const [scope, setScope] = useState<string | null>(initialTestId ?? tests[0]?.id ?? null);
  const [entries, setEntries] = useState<TestLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    return subscribeLeaderboardEntries(
      scope,
      (list) => {
        setEntries(list);
        setLoading(false);
      },
      (msg) => setError(msg)
    );
  }, [scope, uid]);

  const globalRows = useMemo(() => (scope === null ? rankGlobal(entries) : []), [entries, scope]);
  const testRows = useMemo(() => (scope !== null ? rankPerTest(entries) : []), [entries, scope]);
  const rows = scope === null ? globalRows : testRows;
  const topRows = rows.slice(0, LEADERBOARD_TOP_N);

  if (!uid) {
    return (
      <Card t={t} style={{ textAlign: "center", padding: 32 }}>
        <Lock size={28} color={t.textFaint} style={{ margin: "0 auto 10px" }} />
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 16 }}>Sign in to see the leaderboard</p>
        <p style={{ color: t.textMuted, fontSize: 13, marginTop: 4 }}>
          Rankings are tied to student accounts, so you need to be signed in.
        </p>
      </Card>
    );
  }

  const myIndex = rows.findIndex((r) => r.uid === uid);

  return (
    <div className="flex flex-col gap-4">
      {/* Scope picker: Global + each test */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setScope(null)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold"
          style={{
            backgroundColor: scope === null ? t.gold : "transparent",
            color: scope === null ? "#241A08" : t.textMuted,
            border: `1.5px solid ${scope === null ? t.gold : t.border}`,
          }}
        >
          <Globe size={12} /> Global
        </button>
        {tests.map((test) => (
          <button
            key={test.id}
            onClick={() => setScope(test.id)}
            className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold"
            style={{
              backgroundColor: scope === test.id ? t.gold : "transparent",
              color: scope === test.id ? "#241A08" : t.textMuted,
              border: `1.5px solid ${scope === test.id ? t.gold : t.border}`,
            }}
          >
            {test.name}
          </button>
        ))}
      </div>

      <p style={{ color: t.textMuted, fontSize: 12 }}>
        {scope === null
          ? "Global ranking: each student's best score on every test added together. Ties go to the faster total time."
          : "Ranked by best score on this test. Ties go to the faster finish."}
        {" "}Showing the top {LEADERBOARD_TOP_N}.
      </p>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm" style={{ color: t.textMuted }}>
          <Loader2 size={16} className="animate-spin" /> Loading leaderboard&hellip;
        </div>
      ) : error ? (
        <Card t={t} style={{ textAlign: "center", padding: 24 }}>
          <p style={{ color: t.red, fontSize: 13 }}>Couldn't load the leaderboard: {error}</p>
        </Card>
      ) : rows.length === 0 ? (
        <Card t={t} style={{ textAlign: "center", padding: 32 }}>
          <Trophy size={28} color={t.textFaint} style={{ margin: "0 auto 10px" }} />
          <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 16 }}>No scores yet</p>
          <p style={{ color: t.textMuted, fontSize: 13, marginTop: 4 }}>Finish a test to be the first on the board.</p>
        </Card>
      ) : (
        <>
          {myIndex >= 0 && (
            <Card t={t} style={{ borderColor: t.gold, padding: 14 }}>
              <span style={{ fontSize: 12, color: t.textMuted }}>Your rank</span>
              <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 18, marginLeft: 8, color: t.gold }}>
                #{myIndex + 1}
              </span>
              <span style={{ fontSize: 12, color: t.textMuted }}> of {rows.length}</span>
            </Card>
          )}

          <Card t={t} style={{ padding: 0, overflow: "hidden" }}>
            {topRows.map((r, i) => {
              const rank = i + 1;
              const isMe = r.uid === uid;
              const isGlobalRow = scope === null;
              const g = r as ReturnType<typeof rankGlobal>[number];
              const p = r as TestLeaderboardEntry;
              return (
                <div
                  key={r.uid}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{
                    backgroundColor: isMe ? `${t.gold}18` : "transparent",
                    borderTop: i === 0 ? "none" : `1px solid ${t.border}`,
                  }}
                >
                  <div className="flex w-8 shrink-0 justify-center">
                    {rank <= 3 ? (
                      <Medal size={20} color={rankColor(rank, t.textFaint)} />
                    ) : (
                      <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 13, color: t.textFaint }}>{rank}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">
                      {r.displayName}
                      {isMe && <span style={{ color: t.gold, fontSize: 11, marginLeft: 6 }}>You</span>}
                    </div>
                    {r.college && (
                      <div className="truncate text-[11px]" style={{ color: t.textMuted }}>
                        {r.college}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-[11px]" style={{ color: t.textFaint }}>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={10} /> {fmtTime(r.timeTakenSec)}
                      </span>
                      {isGlobalRow && <span>{g.testsTaken} test{g.testsTaken === 1 ? "" : "s"}</span>}
                      {isGlobalRow && <span>avg {g.avgPct}%</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 15 }}>
                      {r.correct}
                      <span style={{ color: t.textFaint, fontSize: 11 }}>/{r.total}</span>
                    </div>
                    {!isGlobalRow && (
                      <div style={{ fontSize: 11, color: t.textMuted }}>{p.scorePct}%</div>
                    )}
                  </div>
                </div>
              );
            })}
          </Card>
          {myIndex >= LEADERBOARD_TOP_N && (
            <p style={{ color: t.textMuted, fontSize: 12, textAlign: "center" }}>
              You're outside the top {LEADERBOARD_TOP_N} for now. Retake the test to climb the board.
            </p>
          )}
        </>
      )}
    </div>
  );
}
