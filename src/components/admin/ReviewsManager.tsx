import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Home, Loader2, MessageSquareHeart, Plus, Star, Trash2 } from "lucide-react";
import Card from "../Card";
import Pill from "../Pill";
import { FONT_DISPLAY, FONT_MONO, type ThemeTokens } from "../../theme";
import { MAX_FEATURED, MAX_REVIEW_CHARS, addAdminReview, deleteReview, setReviewFeatured, subscribeAllReviews } from "../../services/reviews";
import { getFirebaseAuth } from "../../firebase";
import type { ReviewDoc, ReviewSource } from "../../types";

const SOURCE_LABEL: Record<ReviewSource, string> = {
  mcq: "MCQ Bank",
  past_paper: "Past Paper",
  test: "Test Session",
  mock: "Mock Test",
  admin: "Added by admin",
};

/**
 * Admin > Reviews. Every review students send after a session lands here. Tick "Show on
 * homepage" on up to 5 of them — those are the reviews the homepage displays.
 */
export default function ReviewsManager({ t }: { t: ThemeTokens }) {
  const [reviews, setReviews] = useState<ReviewDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "featured">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  useEffect(
    () =>
      subscribeAllReviews(
        (list) => {
          setReviews(list);
          setLoading(false);
          setLoadError(null);
        },
        (msg) => {
          setLoadError(msg);
          setLoading(false);
        }
      ),
    []
  );

  // "Add a review" form (admin-written reviews, e.g. feedback received over WhatsApp)
  const [showForm, setShowForm] = useState(false);
  const [fName, setFName] = useState("");
  const [fContext, setFContext] = useState("");
  const [fRating, setFRating] = useState(5);
  const [fText, setFText] = useState("");
  const [fFeatured, setFFeatured] = useState(true);
  const [saving, setSaving] = useState(false);

  const featuredCount = reviews.filter((r) => r.featured).length;
  const shown = useMemo(() => (filter === "featured" ? reviews.filter((r) => r.featured) : reviews), [reviews, filter]);
  const avg = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  const toggleFeatured = async (r: ReviewDoc) => {
    if (!r.featured && featuredCount >= MAX_FEATURED) {
      setNotice({ tone: "err", text: `The homepage shows at most ${MAX_FEATURED} reviews. Remove one from the homepage first.` });
      return;
    }
    setBusyId(r.id);
    try {
      await setReviewFeatured(r.id, !r.featured);
      setNotice(null);
    } catch (e) {
      setNotice({ tone: "err", text: e instanceof Error ? e.message : "Couldn't update that review." });
    } finally {
      setBusyId(null);
    }
  };

  const submitNew = async () => {
    const adminUid = getFirebaseAuth().currentUser?.uid;
    if (!adminUid) {
      setNotice({ tone: "err", text: "You need to be signed in as admin to add a review." });
      return;
    }
    const wantFeatured = fFeatured && featuredCount < MAX_FEATURED;
    setSaving(true);
    try {
      await addAdminReview({ adminUid, displayName: fName, rating: fRating, text: fText, context: fContext, featured: wantFeatured });
      setNotice(
        fFeatured && !wantFeatured
          ? { tone: "err", text: `Review saved, but the homepage already has ${MAX_FEATURED} reviews. Remove one, then tick "Show on homepage" on this one.` }
          : null
      );
      setFName("");
      setFContext("");
      setFText("");
      setFRating(5);
      setFFeatured(true);
      setShowForm(false);
    } catch (e) {
      setNotice({ tone: "err", text: e instanceof Error ? e.message : "Couldn't save that review." });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: ReviewDoc) => {
    if (!window.confirm(`Delete ${r.displayName}'s review? This cannot be undone.`)) return;
    setBusyId(r.id);
    try {
      await deleteReview(r.id);
    } catch (e) {
      setNotice({ tone: "err", text: e instanceof Error ? e.message : "Couldn't delete that review." });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {notice && (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold"
          style={{ backgroundColor: `${t.red}22`, border: `1.5px solid ${t.red}`, color: t.red }}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="text-xs opacity-75 hover:opacity-100">Dismiss</button>
        </div>
      )}
      {loadError && (
        <div
          className="flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-bold"
          style={{ backgroundColor: `${t.amber}20`, border: `1.5px solid ${t.amber}`, color: t.amber }}
        >
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Couldn't load reviews ({loadError}). Deploy the updated <code>firestore.rules</code> (they add the
            <code> reviews</code> collection) and make sure your account has the admin claim.
          </span>
        </div>
      )}

      <Card t={t}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageSquareHeart size={18} color={t.teal} />
            <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18 }}>Student reviews</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill t={t} tone="muted">{reviews.length} total</Pill>
            {reviews.length > 0 && <Pill t={t} tone="gold"><Star size={11} fill={t.gold} /> {avg.toFixed(1)} avg</Pill>}
            <Pill t={t} tone={featuredCount >= MAX_FEATURED ? "green" : "teal"}>
              <Home size={11} /> {featuredCount}/{MAX_FEATURED} on homepage
            </Pill>
          </div>
        </div>
        <p className="mt-2 text-xs" style={{ color: t.textFaint }}>
          Students send reviews at the end of every MCQ session, past paper, test and mock test, and you can add your own. Pick up to {MAX_FEATURED} to show on the homepage.
        </p>
        <div className="mt-3">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold"
            style={{ backgroundColor: t.purpleStrong, color: "#fff" }}
          >
            <Plus size={14} /> {showForm ? "Close form" : "Add a review"}
          </button>
        </div>
        {showForm && (
          <div className="mt-3 flex flex-col gap-3 rounded-2xl p-4" style={{ border: `1.5px solid ${t.border}` }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-bold" style={{ color: t.textMuted }}>
                Reviewer name
                <input
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  maxLength={60}
                  placeholder="e.g. Ayesha K."
                  className="rounded-xl px-3 py-2 text-sm font-normal outline-none"
                  style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}`, color: t.text }}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold" style={{ color: t.textMuted }}>
                Detail (optional)
                <input
                  value={fContext}
                  onChange={(e) => setFContext(e.target.value)}
                  maxLength={160}
                  placeholder="e.g. MBBS Year 2"
                  className="rounded-xl px-3 py-2 text-sm font-normal outline-none"
                  style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}`, color: t.text }}
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold" style={{ color: t.textMuted }}>Rating</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setFRating(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`}>
                    <Star size={22} color={t.gold} fill={n <= fRating ? t.gold : "transparent"} />
                  </button>
                ))}
              </div>
            </div>
            <label className="flex flex-col gap-1 text-xs font-bold" style={{ color: t.textMuted }}>
              Review
              <textarea
                value={fText}
                onChange={(e) => setFText(e.target.value)}
                maxLength={MAX_REVIEW_CHARS}
                rows={4}
                placeholder="What the student said about Modular Medico…"
                className="rounded-xl px-3 py-2 text-sm font-normal outline-none"
                style={{ backgroundColor: t.surface, border: `1.5px solid ${t.border}`, color: t.text, lineHeight: 1.6 }}
              />
              <span className="self-end font-normal" style={{ color: t.textFaint }}>{fText.length}/{MAX_REVIEW_CHARS}</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-bold" style={{ color: t.textMuted }}>
              <input type="checkbox" checked={fFeatured} onChange={(e) => setFFeatured(e.target.checked)} />
              Show on homepage ({featuredCount}/{MAX_FEATURED} used)
            </label>
            <div>
              <button
                onClick={submitNew}
                disabled={saving || !fName.trim() || !fText.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50"
                style={{ backgroundColor: t.teal, color: "#fff" }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Save review
              </button>
            </div>
          </div>
        )}
        <div className="mt-3 flex gap-2">
          {(["all", "featured"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className="rounded-full px-3.5 py-1.5 text-xs font-bold"
              style={{
                backgroundColor: filter === k ? t.purpleStrong : "transparent",
                color: filter === k ? "#fff" : t.textMuted,
                border: `1.5px solid ${filter === k ? t.purpleStrong : t.border}`,
              }}
            >
              {k === "all" ? "All reviews" : "On homepage"}
            </button>
          ))}
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: t.textMuted }}>
          <Loader2 size={16} className="animate-spin" /> Loading reviews&hellip;
        </div>
      ) : shown.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: t.textMuted }}>
          {filter === "featured" ? "No reviews are on the homepage yet." : "No reviews yet. They show up here as students send them."}
        </p>
      ) : (
        shown.map((r) => (
          <Card key={r.id} t={t} className="flex flex-col gap-3" style={r.featured ? { borderColor: t.teal } : undefined}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>{r.displayName}</span>
                  <div className="flex items-center gap-0.5" aria-label={`${r.rating} out of 5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} size={13} color={t.gold} fill={n <= r.rating ? t.gold : "transparent"} />
                    ))}
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Pill t={t} tone="purple">{SOURCE_LABEL[r.source] ?? r.source}</Pill>
                  {r.featured && <Pill t={t} tone="green"><Home size={11} /> On homepage</Pill>}
                  <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: t.textFaint }}>
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}
                  </span>
                </div>
                {r.context && <div className="mt-1 text-xs" style={{ color: t.textFaint }}>{r.context}</div>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => toggleFeatured(r)}
                  disabled={busyId === r.id}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50"
                  style={{
                    backgroundColor: r.featured ? `${t.teal}22` : "transparent",
                    color: r.featured ? t.teal : t.textMuted,
                    border: `1.5px solid ${r.featured ? t.teal : t.border}`,
                  }}
                >
                  {busyId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Home size={13} />}
                  {r.featured ? "Remove from homepage" : "Show on homepage"}
                </button>
                <button
                  onClick={() => remove(r)}
                  disabled={busyId === r.id}
                  aria-label="Delete review"
                  title="Delete review"
                  className="rounded-xl p-2 disabled:opacity-50"
                  style={{ border: `1.5px solid ${t.red}55` }}
                >
                  <Trash2 size={14} color={t.red} />
                </button>
              </div>
            </div>
            <p className="text-sm" style={{ color: r.text ? t.text : t.textFaint, lineHeight: 1.6 }}>
              {r.text || "(No written comment — rating only)"}
            </p>
          </Card>
        ))
      )}
    </div>
  );
}
