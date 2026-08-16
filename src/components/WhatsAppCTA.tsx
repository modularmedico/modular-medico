import { MessageCircle, ArrowUpRight } from "lucide-react";
import { THEME, FONT_DISPLAY } from "../theme";
import { useAppStore } from "../store/useAppStore";

const WHATSAPP_CHANNEL_URL = "https://whatsapp.com/channel/0029Vb7bpFIInlqGHJVnOF1o";

interface Props {
  compact?: boolean;
}

/** "Need Guidance?" WhatsApp Group/Channel call-to-action, shared by Home and Footer. */
export default function WhatsAppCTA({ compact = false }: Props) {
  const isDark = useAppStore((s) => s.isDark);
  const t = isDark ? THEME.dark : THEME.light;

  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-2xl text-center sm:flex-row sm:items-center sm:justify-between sm:text-left ${
        compact ? "p-4" : "p-6"
      }`}
      style={{ backgroundColor: "#25D36618", border: "1.5px solid #25D36655" }}
    >
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-4 sm:text-left">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: "#25D366" }}
        >
          <MessageCircle size={22} color="#fff" />
        </div>
        <div>
          <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: compact ? 14 : 16 }}>
            Need Guidance?
          </h3>
          <p className="mt-0.5 text-xs" style={{ color: t.textMuted }}>
            Join our WhatsApp Group and Channel &mdash; follow the Modular Medico &#127973;&#129502; channel on WhatsApp.
          </p>
        </div>
      </div>
      <a
        href={WHATSAPP_CHANNEL_URL}
        target="_blank"
        rel="noreferrer"
        className="flex shrink-0 items-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-extrabold transition-transform hover:scale-[1.03]"
        style={{ backgroundColor: "#25D366", color: "#04241a" }}
      >
        Join on WhatsApp <ArrowUpRight size={14} />
      </a>
    </div>
  );
}
