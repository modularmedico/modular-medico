import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { FONT_BODY, type ThemeTokens } from "../theme";

interface Props {
  t: ThemeTokens;
  saved: boolean;
  busy?: boolean;
  onClick: () => void;
  /** Stretch to the full width of its container (used under the question card). */
  full?: boolean;
}

/**
 * The prominent "Save MCQ" button. Deliberately big and labelled (not just a small icon) so
 * students notice it; the saved MCQs are listed on the Saved page.
 */
export default function SaveMcqButton({ t, saved, busy, onClick, full }: Props) {
  const Icon = busy ? Loader2 : saved ? BookmarkCheck : Bookmark;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={saved}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-extrabold transition-transform active:scale-[0.97] disabled:opacity-60 ${full ? "w-full" : ""}`}
      style={{
        fontFamily: FONT_BODY,
        backgroundColor: saved ? `${t.gold}26` : t.gold,
        color: saved ? t.goldDeep : "#241A08",
        border: `1.5px solid ${t.gold}`,
      }}
    >
      <Icon size={17} className={busy ? "animate-spin" : undefined} />
      {saved ? "Saved — tap to remove" : "Save MCQ"}
    </button>
  );
}
