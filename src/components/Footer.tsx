import { useNavigate } from "react-router-dom";
import { BookOpen, ShieldCheck, Heart, Sparkles, Layers, GraduationCap } from "lucide-react";
import Logomark from "./Logomark";
import WhatsAppCTA from "./WhatsAppCTA";
import { THEME, FONT_DISPLAY } from "../theme";
import { useAppStore } from "../store/useAppStore";
import { SUBJECT_LIST, SUBJECT_META } from "../data/subjects";

export default function Footer() {
  const navigate = useNavigate();
  const isDark = useAppStore((s) => s.isDark);
  const t = isDark ? THEME.dark : THEME.light;

  return (
    <footer
      className="mt-16 w-full border-t pt-12 pb-16 transition-colors"
      style={{ backgroundColor: t.surface, borderColor: t.border, color: t.text }}
    >
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        {/* Need Guidance? — WhatsApp Community CTA */}
        <div className="mb-10">
          <WhatsAppCTA compact />
        </div>

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand & Mission */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/")}>
              <Logomark size={30} color={t.purple} />
              <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20 }}>
                Modular <span style={{ color: t.teal }}>Medico</span>
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: t.textMuted }}>
              High-yield MBBS modular examination preparation platform designed for integrated medical education.
              Master Blocks 1 through 15 with clinical rationales, spaced repetition, and real-time exam simulations.
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: `${t.teal}20`, color: t.teal }}>
                <GraduationCap size={12} /> MBBS Modular
              </span>
              <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: `${t.purple}20`, color: t.purple }}>
                <ShieldCheck size={12} /> Verified MCQs
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
              Navigation
            </span>
            <ul className="flex flex-col gap-2 text-xs font-semibold" style={{ color: t.textMuted }}>
              <li>
                <button onClick={() => navigate("/subjects")} className="hover:opacity-80 transition-opacity">
                  Practice Library
                </button>
              </li>
              <li>
                <button onClick={() => navigate("/lectures")} className="hover:opacity-80 transition-opacity">
                  Lectures
                </button>
              </li>
              <li>
                <button onClick={() => navigate("/shop")} className="hover:opacity-80 transition-opacity">
                  Shop
                </button>
              </li>
              <li>
                <button onClick={() => navigate("/builder")} className="hover:opacity-80 transition-opacity">
                  Custom Quiz Builder
                </button>
              </li>
              <li>
                <button onClick={() => navigate("/bookmarks")} className="hover:opacity-80 transition-opacity">
                  Saved Bookmarks
                </button>
              </li>
              <li>
                <button onClick={() => navigate("/profile")} className="hover:opacity-80 transition-opacity">
                  Study Stats &amp; Streaks
                </button>
              </li>
              <li>
                <button onClick={() => navigate("/admin")} className="hover:opacity-80 transition-opacity">
                  Faculty Admin Portal
                </button>
              </li>
            </ul>
          </div>

          {/* Disciplines */}
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
              Curriculum Disciplines
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-xs font-medium" style={{ color: t.textMuted }}>
              {SUBJECT_LIST.slice(0, 8).map((s) => (
                <button
                  key={s}
                  onClick={() => navigate("/subjects")}
                  className="text-left truncate hover:opacity-80 transition-opacity"
                >
                  {SUBJECT_META[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Educational Disclaimer */}
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: t.textFaint }}>
              Medical Disclaimer
            </span>
            <p className="text-[11px] leading-relaxed" style={{ color: t.textFaint }}>
              Modular Medico is intended solely as an educational study aid for medical undergraduates preparing for university and licensure examinations. Content is not intended for clinical diagnostic or treatment decisions.
            </p>
            <div className="mt-2 text-[11px] font-bold" style={{ color: t.textMuted }}>
              &copy; {new Date().getFullYear()} Modular Medico. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
