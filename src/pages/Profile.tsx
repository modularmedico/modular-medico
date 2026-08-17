import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { User, Flame, Crown, LogOut, PieChart as PieChartIcon, TrendingUp, BarChart2, Activity, Calendar } from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import Card from "../components/Card";
import Btn from "../components/Btn";
import { THEME, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../theme";
import { useAppStore, useIsPremium } from "../store/useAppStore";
import { fetchAllUserAttempts } from "../services/firestore";
import { logOut } from "../services/auth";
import { SUBJECT_LIST, SUBJECT_META } from "../data/subjects";
import type { AttemptRecord } from "../types";

export default function Profile() {
  const navigate = useNavigate();
  const isDark = useAppStore((s) => s.isDark);
  const uid = useAppStore((s) => s.uid);
  const email = useAppStore((s) => s.email);
  const displayName = useAppStore((s) => s.displayName);
  const profile = useAppStore((s) => s.profile);
  const isPremium = useIsPremium();
  const t = isDark ? THEME.dark : THEME.light;

  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    fetchAllUserAttempts(uid).then(data => {
      setAttempts(data);
      setLoading(false);
    });
  }, [uid]);

  const accuracyData = useMemo(() => {
    return SUBJECT_LIST.map((id) => {
      const subjectAttempts = attempts.filter((a) => a.subjectId === id);
      const totalQ = subjectAttempts.reduce((s, a) => s + a.total, 0);
      const totalCorrect = subjectAttempts.reduce((s, a) => s + a.correct, 0);
      return {
        subject: SUBJECT_META[id].label,
        accuracy: totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0,
        attempted: totalQ > 0,
      };
    });
  }, [attempts]);

  const stats = useMemo(() => {
    if (attempts.length === 0) return null;
    
    let totalQuestions = 0;
    let totalCorrect = 0;
    const subjectMap: Record<string, { total: number, correct: number }> = {};
    const blockMap: Record<string, { total: number, correct: number }> = {};
    const dateMap: Record<string, { total: number, correct: number }> = {};
    
    attempts.forEach(a => {
      totalQuestions += a.total;
      totalCorrect += a.correct;
      
      if (!subjectMap[a.subjectId]) subjectMap[a.subjectId] = { total: 0, correct: 0 };
      subjectMap[a.subjectId].total += a.total;
      subjectMap[a.subjectId].correct += a.correct;
      
      const bKey = `B${a.block}`;
      if (!blockMap[bKey]) blockMap[bKey] = { total: 0, correct: 0 };
      blockMap[bKey].total += a.total;
      blockMap[bKey].correct += a.correct;
      
      const date = new Date(a.createdAt);
      const dKey = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (!dateMap[dKey]) dateMap[dKey] = { total: 0, correct: 0 };
      dateMap[dKey].total += a.total;
      dateMap[dKey].correct += a.correct;
    });
    
    const subjectData = Object.keys(subjectMap).map(k => ({
      name: SUBJECT_META[k as keyof typeof SUBJECT_META]?.label || k,
      accuracy: Math.round((subjectMap[k].correct / subjectMap[k].total) * 100),
      attempted: subjectMap[k].total
    })).sort((a, b) => b.accuracy - a.accuracy);
    
    const blockData = Object.keys(blockMap).map(k => ({
      name: k,
      accuracy: Math.round((blockMap[k].correct / blockMap[k].total) * 100),
      attempted: blockMap[k].total
    })).sort((a, b) => parseInt(a.name.replace('B', '')) - parseInt(b.name.replace('B', '')));
    
    const trendData = Object.keys(dateMap).map(k => ({
      date: k,
      accuracy: Math.round((dateMap[k].correct / dateMap[k].total) * 100),
      questions: dateMap[k].total
    }));
    
    const overallAccuracy = Math.round((totalCorrect / totalQuestions) * 100);
    const strongestSubject = subjectData.length > 0 ? subjectData[0].name : "N/A";
    const weakestSubject = subjectData.length > 0 ? subjectData[subjectData.length - 1].name : "N/A";

    return {
      totalQuestions,
      overallAccuracy,
      strongestSubject,
      weakestSubject,
      subjectData,
      blockData,
      trendData
    };
  }, [attempts]);

  if (!uid) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-16 text-center">
        <User size={30} color={t.purple} />
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 21 }}>Sign in to see your profile</h1>
        <p style={{ color: t.textMuted, fontSize: 14 }}>Streaks, daily goals, and your weak-topic breakdown live here once you have an account.</p>
        <Btn t={t} onClick={() => navigate("/login")}>
          Log in
        </Btn>
      </div>
    );
  }

  const goalTarget = profile?.dailyGoalTarget ?? 50;
  const goalToday = profile?.dailyGoalDate === new Date().toISOString().slice(0, 10) ? profile?.dailyGoalCount ?? 0 : 0;
  const goalPct = Math.min(100, Math.round((goalToday / goalTarget) * 100));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const acc = payload.find((p: any) => p.dataKey === "accuracy")?.value;
      const qs = payload.find((p: any) => p.dataKey === "questions" || p.dataKey === "attempted")?.value;
      return (
        <div className="rounded-xl p-3 shadow-lg" style={{ backgroundColor: t.surface, border: `1px solid ${t.border}` }}>
          <p className="font-bold mb-1" style={{ fontSize: 13 }}>{label}</p>
          <p style={{ color: t.teal, fontSize: 12, fontWeight: 600 }}>Accuracy: {acc}%</p>
          {qs !== undefined && <p style={{ color: t.textMuted, fontSize: 12 }}>Questions: {qs}</p>}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 pt-2 pb-12">
      {/* Profile Header section (max-w-xl centered for better readability) */}
      <div className="mx-auto w-full max-w-xl flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold"
            style={{ backgroundColor: t.purpleStrong, color: "#fff", fontFamily: FONT_DISPLAY }}
          >
            {(displayName || "S").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 21 }}>{displayName || "Student"}</h1>
              {isPremium && (
                <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: `${t.gold}22`, color: t.gold }}>
                  <Crown size={10} /> PREMIUM
                </span>
              )}
            </div>
            <span style={{ color: t.textFaint, fontSize: 13 }}>{email}</span>
          </div>
          <button onClick={() => logOut()} title="Log out">
            <LogOut size={18} color={t.textFaint} />
          </button>
        </div>

        {!isPremium && (
          <Card t={t} style={{ borderColor: t.gold }} className="flex items-center justify-between gap-3">
            <div>
              <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14 }}>You're on the free plan</span>
              <p className="text-xs" style={{ color: t.textFaint }}>Block 3 only, in every module</p>
            </div>
            <Btn t={t} icon={Crown} onClick={() => navigate("/paywall")}>
              Upgrade
            </Btn>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Card t={t} className="flex items-center gap-3">
            <Flame size={22} color={t.gold} />
            <div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700 }}>{profile?.streak ?? 0}</div>
              <div style={{ fontSize: 11, color: t.textFaint }}>day streak</div>
            </div>
          </Card>
          <Card t={t}>
            <div className="mb-1 flex items-center justify-between">
              <span style={{ fontSize: 12, color: t.textFaint }}>Daily goal</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12 }}>
                {goalToday}/{goalTarget}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: t.surfaceAlt }}>
              <div className="h-full rounded-full" style={{ width: `${goalPct}%`, backgroundColor: t.teal }} />
            </div>
          </Card>
        </div>
      </div>

      <div className="h-px w-full my-4" style={{ backgroundColor: t.border }} />

      {/* Analytics Section */}
      <div>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22, marginBottom: 4 }}>Analytics & Performance</h2>
        <p style={{ color: t.textMuted, fontSize: 14, marginBottom: 16 }}>Visualize your accuracy trends and identify weak areas.</p>
        
        {loading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Activity className="animate-pulse" size={32} color={t.purple} />
              <span style={{ color: t.textMuted, fontSize: 14 }}>Loading analytics...</span>
            </div>
          </div>
        ) : !stats ? (
          <Card t={t} className="py-16 text-center mx-auto max-w-2xl mt-4">
            <PieChartIcon size={48} color={t.textFaint} className="mx-auto mb-4" />
            <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18 }}>No data yet</h3>
            <p className="mt-2 text-sm" style={{ color: t.textMuted }}>
              Complete some practice blocks to see your analytics and performance trends here.
            </p>
            <div className="mt-6 flex justify-center">
              <Btn t={t} onClick={() => navigate("/subjects")}>
                Start Practicing
              </Btn>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Card t={t} className="flex flex-col items-center text-center">
                <Activity size={24} color={t.teal} className="mb-2" />
                <span style={{ fontSize: 24, fontWeight: 800, fontFamily: FONT_DISPLAY }}>{stats.overallAccuracy}%</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>Overall Accuracy</span>
              </Card>
              <Card t={t} className="flex flex-col items-center text-center">
                <BarChart2 size={24} color={t.purple} className="mb-2" />
                <span style={{ fontSize: 24, fontWeight: 800, fontFamily: FONT_DISPLAY }}>{stats.totalQuestions}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>Questions Attempted</span>
              </Card>
              <Card t={t} className="flex flex-col items-center text-center">
                <TrendingUp size={24} color={t.green} className="mb-2" />
                <span style={{ fontSize: 18, fontWeight: 800, fontFamily: FONT_DISPLAY, lineHeight: 1.2 }} className="truncate w-full">{stats.strongestSubject}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", marginTop: 4 }}>Strongest Subject</span>
              </Card>
              <Card t={t} className="flex flex-col items-center text-center">
                <TrendingUp size={24} color={t.red} className="mb-2 rotate-180 transform" />
                <span style={{ fontSize: 18, fontWeight: 800, fontFamily: FONT_DISPLAY, lineHeight: 1.2 }} className="truncate w-full">{stats.weakestSubject}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", marginTop: 4 }}>Weakest Subject</span>
              </Card>
            </div>

            {/* Trend Over Time & Radar */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card t={t} className="lg:col-span-2">
                <div className="mb-6 flex items-center gap-2">
                  <Calendar size={18} color={t.purple} />
                  <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>Accuracy Over Time</h2>
                </div>
                <div style={{ width: "100%", height: 300 }}>
                  <ResponsiveContainer>
                    <AreaChart data={stats.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={t.purple} stopOpacity={0.4}/>
                          <stop offset="95%" stopColor={t.purple} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: t.textFaint, fontSize: 11, fontFamily: FONT_BODY }} axisLine={false} tickLine={false} dy={10} />
                      <YAxis domain={[0, 100]} tick={{ fill: t.textFaint, fontSize: 11, fontFamily: FONT_BODY }} axisLine={false} tickLine={false} dx={-10} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="accuracy" stroke={t.purple} strokeWidth={3} fillOpacity={1} fill="url(#colorAcc)" />
                      {/* Invisible line just to pass data to tooltip for question count */}
                      <Area type="monotone" dataKey="questions" stroke="none" fill="none" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card t={t}>
                <div className="mb-2 flex items-center gap-2">
                  <PieChartIcon size={18} color={t.gold} />
                  <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>Proficiency Radar</h2>
                </div>
                <div style={{ width: "100%", height: 300 }}>
                  <ResponsiveContainer>
                    <RadarChart data={accuracyData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <PolarGrid stroke={t.border} />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: t.textFaint, fontSize: 10, fontFamily: FONT_BODY }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar
                        name="Accuracy"
                        dataKey="accuracy"
                        stroke={t.gold}
                        fill={t.gold}
                        fillOpacity={0.4}
                      />
                      <Tooltip contentStyle={{ backgroundColor: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, fontFamily: FONT_BODY, fontSize: 12 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* Block Breakdown */}
            <Card t={t}>
              <div className="mb-6 flex items-center gap-2">
                <BarChart2 size={18} color={t.teal} />
                <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>Accuracy by Block</h2>
              </div>
              <div style={{ width: "100%", height: 250 }}>
                <ResponsiveContainer>
                  <BarChart data={stats.blockData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: t.textFaint, fontSize: 11, fontFamily: FONT_BODY }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis domain={[0, 100]} tick={{ fill: t.textFaint, fontSize: 11, fontFamily: FONT_BODY }} axisLine={false} tickLine={false} dx={-10} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: `${t.teal}15` }} />
                    <Bar dataKey="accuracy" radius={[6, 6, 0, 0]} maxBarSize={40}>
                      {stats.blockData.map((d, i) => (
                        <Cell key={i} fill={d.accuracy < 60 ? t.gold : t.teal} />
                      ))}
                    </Bar>
                    <Bar dataKey="attempted" fill="none" stroke="none" hide />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            
          </div>
        )}
      </div>
    </div>
  );
}
