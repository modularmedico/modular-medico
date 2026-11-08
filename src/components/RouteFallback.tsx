import { Loader2 } from "lucide-react";
import { THEME } from "../theme";
import { useAppStore } from "../store/useAppStore";

/** Lightweight placeholder shown while a lazily-loaded page chunk downloads. */
export default function RouteFallback() {
  const isDark = useAppStore((s) => s.isDark);
  const t = isDark ? THEME.dark : THEME.light;
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={22} color={t.purple} className="animate-spin" />
    </div>
  );
}
