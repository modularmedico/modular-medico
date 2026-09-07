import { Loader2 } from "lucide-react";
import type { ThemeTokens } from "../theme";

interface Props {
  t: ThemeTokens;
  size?: number;
  color?: string;
  label?: string;
  className?: string;
  hint?: boolean;
}

/** A circular spinning loading indicator, for use anywhere content is being fetched from the backend. */
export default function Spinner({ t, size = 20, color, label, className = "", hint = true }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${className}`}>
      <div className="flex items-center justify-center gap-2">
        <Loader2 size={size} color={color || t.purple} className="animate-spin" />
        {label && (
          <span style={{ color: t.textMuted, fontSize: 13 }}>{label}</span>
        )}
      </div>
      {hint && (
        <span style={{ color: t.textFaint, fontSize: 11 }}>
          It may take 1-2 minutes when loading first time
        </span>
      )}
    </div>
  );
}
