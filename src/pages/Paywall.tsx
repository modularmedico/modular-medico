import { useNavigate } from "react-router-dom";
import { Crown, Check, MessageCircle, ArrowRight, ShieldCheck } from "lucide-react";
import Card from "../components/Card";
import Pill from "../components/Pill";
import Btn from "../components/Btn";
import { THEME, FONT_DISPLAY } from "../theme";
import { useAppStore, useIsPremium } from "../store/useAppStore";

const PERKS = [
  "Every MBBS subject, every module, and every block (Blocks 1–15)",
  "Full question bank with high-yield clinical vignettes",
  "Custom quiz builder across all subjects",
  "Spaced repetition across your complete session history",
  "Streaks, daily goals & weak-topic accuracy heatmap",
];

// Admin's WhatsApp number for handling purchases/upgrades manually — every
// "Subscribe" / "Unlock" action on this page hands off to a WhatsApp chat
// with this number instead of taking payment in-app.
const PURCHASE_WHATSAPP_NUMBER = "923150651584"; // +92 315 0651584, no punctuation for wa.me

export default function Paywall() {
  const navigate = useNavigate();
  const isDark = useAppStore((s) => s.isDark);
  const uid = useAppStore((s) => s.uid);
  const email = useAppStore((s) => s.email);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const isPremium = useIsPremium();
  const t = isDark ? THEME.dark : THEME.light;

  const isMaster = isAdmin;

  if (!uid) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-16 text-center">
        <Crown size={32} color={t.gold} />
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22 }}>Create a free account</h1>
        <p style={{ color: t.textMuted, fontSize: 14 }}>
          All premium features and modules are complimentary. Create or sign in to sync your progress.
        </p>
        <div className="flex w-full flex-col gap-2.5 mt-2">
          <Btn t={t} full onClick={() => navigate("/signup")}>
            Create free account
          </Btn>
          <Btn t={t} full variant="ghost" onClick={() => navigate("/login")}>
            Log in to existing account
          </Btn>
        </div>
      </div>
    );
  }

  if (isMaster || isPremium) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: `${t.gold}22` }}>
          <Crown size={32} color={t.gold} />
        </div>
        <div>
          <div className="mb-2">
            <Pill t={t} tone="gold" active>
              {isMaster ? "MASTER ADMIN ACTIVE" : "PREMIUM ACCESS UNLOCKED"}
            </Pill>
          </div>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24 }}>Full Access Active</h1>
          <p style={{ color: t.textMuted, fontSize: 14, marginTop: 4 }}>
            {isMaster
              ? "Signed in with admin access. All question sets, modules, and admin controls are completely unlocked."
              : "All subjects, blocks 1–15, custom quiz builders, and spaced repetition are unlocked."}
          </p>
        </div>

        <Card t={t} className="w-full text-left">
          <ul className="flex flex-col gap-2.5">
            {PERKS.map((p) => (
              <li key={p} className="flex items-center gap-2 text-xs" style={{ color: t.textMuted }}>
                <Check size={14} color={t.green} className="shrink-0" /> {p}
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex w-full flex-col gap-2">
          <Btn t={t} full icon={ArrowRight} onClick={() => navigate("/subjects")}>
            Start practicing now
          </Btn>
          {isMaster && (
            <Btn t={t} full variant="secondary" icon={ShieldCheck} onClick={() => navigate("/admin")}>
              Open Admin Dashboard
            </Btn>
          )}
        </div>
      </div>
    );
  }

  const handleActivateSubscription = () => {
    const messageLines = [
      "Hi! I'd like to subscribe to Modular Medico's Full MBBS Access (PKR 1500/year).",
      email ? `My account email: ${email}` : null,
    ].filter(Boolean);
    const waUrl = `https://wa.me/${PURCHASE_WHATSAPP_NUMBER}?text=${encodeURIComponent(messageLines.join("\n"))}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 py-6">
      <div className="text-center">
        <Crown size={32} color={t.gold} className="mx-auto mb-2" />
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26 }}>Full MBBS Access</h1>
        <p style={{ color: t.textMuted, fontSize: 14, marginTop: 4 }}>
          Message us on WhatsApp to subscribe and unlock all premium content.
        </p>
      </div>

      <Card t={t} style={{ borderColor: t.gold }}>
        <div className="mb-3 flex items-center justify-between">
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>Unlimited Practice Tier</span>
          <Pill t={t} tone="gold">PKR 1500 / Year</Pill>
        </div>
        <ul className="flex flex-col gap-2.5">
          {PERKS.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm" style={{ color: t.textMuted }}>
              <Check size={15} color={t.green} className="mt-0.5 shrink-0" /> {p}
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-col gap-3">
        <Btn t={t} full icon={MessageCircle} onClick={handleActivateSubscription} style={{ backgroundColor: "#25D366", color: "#04241a", border: "1.5px solid #25D366" }}>
          Subscribe via WhatsApp
        </Btn>
        <Btn t={t} full variant="ghost" onClick={() => navigate("/subjects")}>
          Return to Subjects
        </Btn>
      </div>

      <p className="text-center text-xs" style={{ color: t.textFaint }}>
        You'll be redirected to WhatsApp ({"+92 315 0651584"}) to complete your subscription.
      </p>
    </div>
  );
}
