import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, MessageSquareHeart, Star } from "lucide-react";
import Card from "./Card";
import Btn from "./Btn";
import { FONT_DISPLAY, THEME } from "../theme";
import { useAppStore } from "../store/useAppStore";
import { MAX_REVIEW_CHARS, submitReview } from "../services/reviews";
import type { ReviewSource } from "../types";

interface Props {
  /** Which part of the app the session was in — shown to the admin next to the review. */
  source: ReviewSource;
  /** Human-readable title of the session/paper, e.g. "Block 3 · Cardiovascular-I". */
  context: string;
}

/**
 * "How was this session?" — shown when an MCQ session / past paper / test / mock test ends.
 * Reviews go to the admin panel (Reviews tab); the admin picks which ones appear on the homepage.
 */
export default function ReviewPrompt({ source, context }: Props) {
  const navigate = useNavigate();
  const isDark = useAppStore((s) => s.isDark);
  const uid = useAppStore((s) => s.uid);
  const displayName = useAppStore((s) => s.displayName || s.profile?.displayName || "Student");
  const t = isDark ? THEME.dark : THEME.light;

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    if (!uid || busy) return;
    if (rating === 0) {
      setError("Tap a star to rate your experience first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await submitReview({ uid, displayName, rating, text, source, context });
      setDone(true);
    } catch (e) {
      console.warn("Review failed:", e);
      setError(e instanceof Error && e.message.includes("star") ? e.message : "Couldn't send your review. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Card t={t} style={{ borderColor: t.green, textAlign: "center" }}>
        <CheckCircle2 size={26} color={t.green} className="mx-auto mb-2" />
        <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>Thank you for your review!</p>
        <p className="mt-1 text-sm" style={{ color: t.textMuted }}>
          It helps us improve Modular Medico for every student.
        </p>
      </Card>
    );
  }

  const shown = hover || rating;

  return (
    <Card t={t}>
      <div className="mb-3 flex items-center gap-2">
        <MessageSquareHeart size={18} color={t.teal} />
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>How was this session?</span>
      </div>

      {!uid ? (
        <>
          <p className="mb-3 text-sm" style={{ color: t.textMuted }}>
            Log in to leave a review — it goes straight to our team.
          </p>
          <Btn t={t} variant="ghost" full onClick={() => navigate("/login")}>
            Log in to review
          </Btn>
        </>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setRating(n);
                  setError("");
                }}
                onMouseEnter={() => setHover(n)}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                className="p-0.5 transition-transform active:scale-90"
              >
                <Star size={30} color={t.gold} fill={n <= shown ? t.gold : "transparent"} />
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_REVIEW_CHARS))}
            rows={3}
            placeholder="Tell us what you liked or what we should improve (optional)"
            className="w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none"
            style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
          />
          <div className="mt-1 text-right text-[11px]" style={{ color: t.textFaint }}>
            {text.length}/{MAX_REVIEW_CHARS}
          </div>
          {error && (
            <p className="mb-2 text-xs font-semibold" style={{ color: t.red }}>
              {error}
            </p>
          )}
          <Btn t={t} full icon={busy ? Loader2 : undefined} spin={busy} disabled={busy} onClick={send}>
            Send review
          </Btn>
        </>
      )}
    </Card>
  );
}
