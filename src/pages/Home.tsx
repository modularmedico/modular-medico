import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  ArrowRight,
  Check,
  X,
  HelpCircle,
  ChevronRight,
  Brain,
  Grid3x3,
  Flame,
  Award,
  Layers,
  GraduationCap,
  BookOpen,
  BarChart3,
  Clock,
  ShieldCheck,
  ListChecks,
} from "lucide-react";
import Pill from "../components/Pill";
import Card from "../components/Card";
import Btn from "../components/Btn";
import { THEME, FONT_DISPLAY } from "../theme";
import { useAppStore, useIsLoggedIn, useIsPremium } from "../store/useAppStore";
import { SUBJECT_LIST, SUBJECT_META } from "../data/subjects";

const SCATTER_ROTATIONS = [-4, 3, -2, 5, -6, 2, -3, 4];
const SCATTER_SUBJECTS = SUBJECT_LIST.map((id, i) => ({ id, rotate: SCATTER_ROTATIONS[i % SCATTER_ROTATIONS.length] }));

const FEATURES = [
  {
    icon: Grid3x3,
    title: "OMR Sheet & Exam Simulation",
    desc: "Practice with realistic university examination bubble sheets and timed testing environments to build speed and eliminate bubbling errors.",
    tone: "teal",
  },
  {
    icon: Brain,
    title: "Smart Spaced Repetition",
    desc: "Missed questions are intelligently reinserted in your session queue at calibrated intervals so challenging concepts stick before test day.",
    tone: "purple",
  },
  {
    icon: Layers,
    title: "Integrated Modular Curriculum",
    desc: "Seamlessly navigate across all 15 Blocks and 12 Disciplines structured according to the modern undergraduate MBBS modular syllabus.",
    tone: "gold",
  },
  {
    icon: BarChart3,
    title: "Performance Heatmaps & Streaks",
    desc: "Track daily revision goals, monitor topic-wise accuracy, and pinpoint high-yield knowledge gaps with real-time clinical analytics.",
    tone: "green",
  },
];

const FAQS = [
  {
    q: "How does the modular MBBS block system work in Modular Medico?",
    a: "Instead of isolating subjects, Modular Medico organizes questions by integrated clinical blocks (Blocks 1–15) and organ systems (Cardiovascular, Respiratory, Neurosciences, etc.), combining Anatomy, Physiology, Biochemistry, and Pathology seamlessly.",
  },
  {
    q: "What is the difference between Traditional, OMR, and Mock Exam modes?",
    a: "Traditional mode gives instant feedback with high-yield rationale after every question. OMR mode simulates paper-based bubble sheets with quick sequential input. Mock Exam mode introduces a strict countdown timer and locks answers until final submission.",
  },
  {
    q: "How does the Spaced Repetition algorithm reinforce retention?",
    a: "When you miss a question during practice, our algorithm quietly queues the question 5 to 10 questions later in your active session, forcing active recall before your session concludes.",
  },
  {
    q: "Can I adjust practice and exam timers?",
    a: "Yes! You can choose untimed practice, preset session durations (3 min, 5 min, 10 min, 30 min, 60 min), custom per-question time limits (30s–90s), or adjust active timers on-the-fly during a quiz.",
  },
  {
    q: "What is included in the Free vs. Premium plan?",
    a: "Guest and free registered accounts have access to sample practice sets across all subjects and custom quizzes. Premium unlocks unlimited access across all 15 blocks, full modular question banks, and detailed weakness tracking.",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const isDark = useAppStore((s) => s.isDark);
  const isLoggedIn = useIsLoggedIn();
  const isPremium = useIsPremium();
  const t = isDark ? THEME.dark : THEME.light;
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div className="flex flex-col gap-16 pb-8">
      {/* Hero Section */}
      <section
        className="relative overflow-hidden rounded-[32px] px-6 py-12 md:px-12 md:py-16 transition-all"
        style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}
      >
        <div className="relative z-10 flex flex-col items-start gap-5">
          <Pill t={t} tone="teal">
            <Sparkles size={13} /> Built specifically for MBBS Undergraduate Prep
          </Pill>

          <h1
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: "clamp(2.2rem, 5.5vw, 3.4rem)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            Master Medical MCQs
            <br />
            <span style={{ color: isDark ? t.teal : t.purple }}>The way exams actually test you.</span>
          </h1>

          <p style={{ color: t.textMuted, fontSize: 16.5, maxWidth: 600, lineHeight: 1.6 }}>
            Explore all 15 integrated blocks, choose between Traditional and OMR examination sheets,
            and leverage intelligent spaced repetition to conquer high-yield medical concepts.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Btn t={t} icon={ArrowRight} onClick={() => navigate("/subjects")}>
              Start Practicing Free
            </Btn>
            <Btn t={t} variant="ghost" onClick={() => navigate(isLoggedIn ? "/builder" : "/login")}>
              {isLoggedIn ? "Build a Custom Quiz" : "Create Free Account"}
            </Btn>
          </div>
        </div>

        {/* Scattered Subject Badges */}
        <div className="relative z-10 mt-12 flex flex-wrap gap-2.5 md:mt-16">
          {SCATTER_SUBJECTS.map((s, i) => (
            <Pill
              key={s.id}
              t={t}
              tone={t.chip[i % t.chip.length]}
              rotate={s.rotate}
              onClick={() => navigate("/subjects")}
            >
              {SUBJECT_META[s.id].label}
            </Pill>
          ))}
        </div>
      </section>

      {/* Quick Metrics Bar */}
      <section
        className="grid grid-cols-2 gap-4 rounded-3xl p-6 sm:grid-cols-4 md:p-8"
        style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}` }}
      >
        <div className="flex flex-col items-center text-center p-2">
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 32, color: t.teal }}>15</span>
          <span className="text-xs font-bold uppercase tracking-wider mt-1" style={{ color: t.textMuted }}>
            Integrated Blocks
          </span>
        </div>
        <div className="flex flex-col items-center text-center p-2">
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 32, color: t.purple }}>
            12
          </span>
          <span className="text-xs font-bold uppercase tracking-wider mt-1" style={{ color: t.textMuted }}>
            Core Disciplines
          </span>
        </div>
        <div className="flex flex-col items-center text-center p-2">
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 32, color: t.gold }}>3</span>
          <span className="text-xs font-bold uppercase tracking-wider mt-1" style={{ color: t.textMuted }}>
            Testing Modes
          </span>
        </div>
        <div className="flex flex-col items-center text-center p-2">
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 32, color: t.green }}>100%</span>
          <span className="text-xs font-bold uppercase tracking-wider mt-1" style={{ color: t.textMuted }}>
            High-Yield Focus
          </span>
        </div>
      </section>

      {/* Core Highlights & Feature Cards */}
      <section className="flex flex-col gap-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: t.teal }}>
            Engineered for Precision
          </span>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, marginTop: 4 }}>
            Why medical students choose Modular Medico
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {FEATURES.map((feat, i) => (
            <Card key={i} t={t} className="flex flex-col gap-3 p-6" style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}>
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{
                  backgroundColor:
                    feat.tone === "teal"
                      ? `${t.teal}20`
                      : feat.tone === "purple"
                      ? `${t.purple}20`
                      : feat.tone === "gold"
                      ? `${t.gold}20`
                      : `${t.green}20`,
                }}
              >
                <feat.icon
                  size={22}
                  color={
                    feat.tone === "teal"
                      ? t.teal
                      : feat.tone === "purple"
                      ? t.purple
                      : feat.tone === "gold"
                      ? t.gold
                      : t.green
                  }
                />
              </div>

              <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17 }}>{feat.title}</h3>
              <p style={{ color: t.textMuted, fontSize: 14, lineHeight: 1.6 }}>{feat.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing / Plan Comparison Section */}
      <section className="grid gap-6 md:grid-cols-2 items-stretch">
        <Card t={t} className="flex flex-col justify-between p-6" style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}>
          <div>
            <div className="mb-4 flex items-center justify-between border-b pb-3" style={{ borderColor: t.border }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20 }}>Starter Free Mode</span>
              <Pill t={t} tone="teal">Free Always</Pill>
            </div>
            <ul className="flex flex-col gap-3.5 text-sm" style={{ color: t.textMuted }}>
              <li className="flex items-center gap-3">
                <Check size={16} color={t.green} /> Open access to Block 1 sets
              </li>
              <li className="flex items-center gap-3">
                <Check size={16} color={t.green} /> Instant answer rationales &amp; explanations
              </li>
              <li className="flex items-center gap-3">
                <Check size={16} color={t.green} /> Traditional &amp; OMR practice modes
              </li>
              <li className="flex items-center gap-3 opacity-60">
                <X size={16} color={t.red} /> Complete Blocks 1–15 library
              </li>
              <li className="flex items-center gap-3 opacity-60">
                <X size={16} color={t.red} /> Advanced topic heatmaps &amp; progress backup
              </li>
            </ul>
          </div>
          <Btn t={t} variant="ghost" full style={{ marginTop: 24 }} onClick={() => navigate("/subjects")}>
            Browse Free Sets
          </Btn>
        </Card>

        <Card t={t} className="flex flex-col justify-between p-6" style={{ backgroundColor: t.surface, borderColor: t.purple, boxShadow: `0 8px 24px -6px ${t.purple}30` }}>
          <div>
            <div className="mb-4 flex items-center justify-between border-b pb-3" style={{ borderColor: t.border }}>
              <div>
                <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20 }}>Full Access Pass</span>
              </div>
              <Pill t={t} tone="purple" active>
                Most Popular
              </Pill>
            </div>
            <ul className="flex flex-col gap-3.5 text-sm" style={{ color: t.textMuted }}>
              <li className="flex items-center gap-3">
                <Check size={16} color={t.green} /> Full unrestricted access to all 15 Blocks &amp; Modules
              </li>
              <li className="flex items-center gap-3">
                <Check size={16} color={t.green} /> Timed Exam Simulations with custom timers
              </li>
              <li className="flex items-center gap-3">
                <Check size={16} color={t.green} /> Active Spaced Repetition engine
              </li>
              <li className="flex items-center gap-3">
                <Check size={16} color={t.green} /> Custom Quiz Builder by topic &amp; difficulty
              </li>
              <li className="flex items-center gap-3">
                <Check size={16} color={t.green} /> Bookmark review, study streaks &amp; history
              </li>
            </ul>
          </div>
          <Btn t={t} full style={{ marginTop: 24 }} onClick={() => navigate("/paywall")}>
            {isPremium ? "Access Unlocked" : "Unlock Full Pass"}
          </Btn>
        </Card>
      </section>

      {/* Frequently Asked Questions */}
      <section className="flex flex-col gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: t.teal }}>
            Got Questions?
          </span>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22, marginTop: 3 }}>
            Frequently Asked Questions
          </h2>
        </div>

        <div className="flex flex-col gap-2.5">
          {FAQS.map((f, i) => (
            <div
              key={f.q}
              className="rounded-2xl transition-all"
              style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}` }}
            >
              <button
                className="flex w-full items-center justify-between px-5 py-4 text-left font-bold text-sm"
                onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
              >
                <span className="flex items-center gap-2.5">
                  <HelpCircle size={15} color={t.teal} /> {f.q}
                </span>
                <ChevronRight
                  size={16}
                  style={{
                    transform: openFaq === i ? "rotate(90deg)" : "none",
                    transition: "transform 0.2s ease",
                  }}
                  color={t.textFaint}
                />
              </button>
              {openFaq === i && (
                <div className="px-5 pb-5 pt-1 text-sm leading-relaxed" style={{ color: t.textMuted }}>
                  {f.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
