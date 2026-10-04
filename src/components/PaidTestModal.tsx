import { useEffect } from "react";
import { X, Lock, MessageCircle, Crown } from "lucide-react";
import { THEME, FONT_DISPLAY, FONT_BODY } from "../theme";
import { useAppStore } from "../store/useAppStore";
import { OFFER_PRICE } from "../data/offer";

// Same admin WhatsApp number the Blocks offer popup uses.
const WHATSAPP_NUMBER = "923150651584";

interface Props {
  testName: string;
  isLoggedIn: boolean;
  onClose: () => void;
  onViewPlans: () => void;
}

/** Shown when a non-premium student taps a paid Test Session. */
export default function PaidTestModal({ testName, isLoggedIn, onClose, onViewPlans }: Props) {
  const isDark = useAppStore((s) => s.isDark);
  const t = isDark ? THEME.dark : THEME.light;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const whatsapp = () => {
    const text = `Hi! I'd like to unlock the test "${testName}" (Blocks 1, 2 & 3 for PKR ${OFFER_PRICE}).`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(10,6,20,0.65)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl"
        style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}`, fontFamily: FONT_BODY }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: t.surfaceAlt, color: t.textMuted }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${t.gold}22` }}
        >
          <Lock size={26} color={t.gold} />
        </div>

        <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: t.text }}>
          This is a paid test
        </h2>
        <p className="mt-2 text-sm" style={{ color: t.textMuted }}>
          <strong style={{ color: t.text }}>{testName}</strong> is available to Premium students.
          Unlock it to start, or try one of the free tests instead.
        </p>

        <button
          onClick={onViewPlans}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-extrabold"
          style={{ backgroundColor: t.gold, color: "#241A08" }}
        >
          <Crown size={16} /> {isLoggedIn ? "View plans" : "Sign up to unlock"}
        </button>

        <button
          onClick={whatsapp}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-extrabold"
          style={{ backgroundColor: "#25D366", color: "#04241a" }}
        >
          <MessageCircle size={16} /> Message on WhatsApp
        </button>

        <button onClick={onClose} className="mt-3 text-xs font-semibold" style={{ color: t.textFaint }}>
          Maybe later
        </button>
      </div>
    </div>
  );
}
