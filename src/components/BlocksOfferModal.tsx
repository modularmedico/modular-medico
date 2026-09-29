import { useEffect, useState } from "react";
import { X, MessageCircle, Layers } from "lucide-react";
import { THEME, FONT_DISPLAY, FONT_BODY } from "../theme";
import { useAppStore } from "../store/useAppStore";
import { OFFER_PRICE, OFFER_POPUP_TITLE, OFFER_WHATSAPP_TEXT } from "../data/offer";

// Admin's WhatsApp number for handling this promo purchase manually.
const OFFER_WHATSAPP_NUMBER = "923150651584"; // 0315 0651584, no punctuation for wa.me

/**
 * Promo popup advertising "Get Block 1, 2 & 3 for PKR 499", shown once per page
 * load/refresh on top of the student-facing app (mounted in Shell).
 */
export default function BlocksOfferModal() {
  const isDark = useAppStore((s) => s.isDark);
  const t = isDark ? THEME.dark : THEME.light;
  const [open, setOpen] = useState(true);

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!open) return null;

  const handleMessage = () => {
    const text = OFFER_WHATSAPP_TEXT;
    const waUrl = `https://wa.me/${OFFER_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(10,6,20,0.65)", backdropFilter: "blur(4px)" }}
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl"
        style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}`, fontFamily: FONT_BODY }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setOpen(false)}
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
          <Layers size={26} color={t.gold} />
        </div>

        <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: t.text }}>
          {OFFER_POPUP_TITLE}
        </h2>
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 30, color: t.gold, marginTop: 4 }}>
          Just PKR {OFFER_PRICE}
        </p>

        <p className="mt-2 text-sm" style={{ color: t.textMuted }}>
          To get Blocks 1, 2 & 3, message us on WhatsApp:
        </p>
        <p className="mt-1 text-sm font-bold" style={{ color: t.text }}>
          0315 0651584
        </p>

        <button
          onClick={handleMessage}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-extrabold transition-transform hover:scale-[1.02]"
          style={{ backgroundColor: "#25D366", color: "#04241a" }}
        >
          <MessageCircle size={17} /> Message on WhatsApp
        </button>

        <button
          onClick={() => setOpen(false)}
          className="mt-3 text-xs font-semibold"
          style={{ color: t.textFaint }}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
