import { ShoppingBag, ExternalLink, Package } from "lucide-react";
import Card from "../components/Card";
import Pill from "../components/Pill";
import { THEME, FONT_DISPLAY } from "../theme";
import { useAppStore } from "../store/useAppStore";
import { SHOP_ITEMS } from "../data/shopItems";

/**
 * Shop is intentionally static — items come from src/data/shopItems.ts, edited
 * by hand, not from Firestore or an admin panel.
 */
export default function Shop() {
  const isDark = useAppStore((s) => s.isDark);
  const t = isDark ? THEME.dark : THEME.light;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em" }}>
          Shop
        </h1>
        <p style={{ color: t.textMuted, fontSize: 13.5, marginTop: 2 }}>
          Notes, guides, and study materials curated by Modular Medico.
        </p>
      </div>

      {SHOP_ITEMS.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-2xl p-12 text-center"
          style={{ backgroundColor: t.surfaceAlt, border: `1.5px dashed ${t.border}` }}
        >
          <ShoppingBag size={22} color={t.textFaint} />
          <h4 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>Nothing here yet</h4>
          <p className="max-w-sm text-xs" style={{ color: t.textMuted }}>
            Check back soon — new study materials are on the way.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SHOP_ITEMS.map((item) => (
            <Card key={item.id} t={t} className="flex flex-col gap-3" style={{ backgroundColor: t.surface }}>
              <div
                className="flex h-36 w-full items-center justify-center overflow-hidden rounded-xl"
                style={{ backgroundColor: t.surfaceAlt }}
              >
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <Package size={30} color={t.textFaint} />
                )}
              </div>

              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  {item.badge && <Pill t={t} tone="gold">{item.badge}</Pill>}
                </div>
                <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>{item.name}</h3>
                <p className="mt-1 text-xs" style={{ color: t.textMuted, lineHeight: 1.5 }}>
                  {item.description}
                </p>
              </div>

              <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: t.border }}>
                <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: t.teal }}>
                  {item.price}
                </span>
                <a
                  href={item.buyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all hover:scale-[1.02]"
                  style={{ backgroundColor: t.purpleStrong, color: "#fff" }}
                >
                  Buy Now <ExternalLink size={12} />
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
