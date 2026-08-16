import { useEffect, useState, useRef } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Home as HomeIcon,
  BookOpen,
  Bookmark,
  User,
  Moon,
  Sun,
  Menu,
  X,
  Flame,
  Wand2,
  Search,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Video,
  ShoppingBag,
} from "lucide-react";
import Logomark from "./Logomark";
import Footer from "./Footer";
import { THEME, FONT_DISPLAY, FONT_BODY } from "../theme";
import { useAppStore } from "../store/useAppStore";
import { logOut as firebaseLogOut } from "../services/auth";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: HomeIcon, end: true },
  { to: "/subjects", label: "Practice", icon: BookOpen },
  { to: "/builder", label: "Build", icon: Wand2, center: true },
  { to: "/bookmarks", label: "Saved", icon: Bookmark },
  { to: "/profile", label: "Profile", icon: User },
];

// Secondary links — shown in the hamburger drawer (mobile) and desktop sidebar, but
// not in the 5-slot bottom mobile tab bar (kept lean on purpose).
const SECONDARY_NAV_ITEMS = [
  { to: "/lectures", label: "Lectures", icon: Video },
  { to: "/shop", label: "Shop", icon: ShoppingBag },
];

export default function Shell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = useAppStore((s) => s.isDark);
  const toggleDark = useAppStore((s) => s.toggleDark);
  const uid = useAppStore((s) => s.uid);
  const profile = useAppStore((s) => s.profile);
  const isLoggedIn = !!uid;

  const t = isDark ? THEME.dark : THEME.light;

  /* ------------------------------------------------------------------------- */
  /* AUTO-HIDING SCROLL INDICATOR (Requirement 9)                              */
  /* ------------------------------------------------------------------------- */
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll > 0) {
        const currentProgress = (window.scrollY / totalScroll) * 100;
        setScrollProgress(currentProgress);
      }
      setIsScrolling(true);

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Hide scrolling indicator after 1.5 seconds of inactivity
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 1500);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  // Close mobile menu on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuOpen) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  // Close mobile menu when location changes
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const isActive = (to: string, end?: boolean) => (end ? location.pathname === to : location.pathname.startsWith(to));

  return (
    <div style={{ backgroundColor: t.bg, color: t.text, fontFamily: FONT_BODY, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Dynamic Auto-Fading Top Scroll Progress Bar */}
      <div
        className="fixed top-0 left-0 right-0 z-50 h-[3px] pointer-events-none transition-opacity duration-500 ease-out"
        style={{
          opacity: isScrolling ? 1 : 0,
          backgroundColor: `${t.purple}30`,
        }}
      >
        <div
          className="h-full transition-all duration-150"
          style={{
            width: `${scrollProgress}%`,
            background: `linear-gradient(90deg, ${t.teal}, ${t.purple})`,
            boxShadow: `0 0 8px ${t.purple}`,
          }}
        />
      </div>

      {/* Header */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 md:px-7"
        style={{ backgroundColor: `${t.bg}F2`, backdropFilter: "blur(12px)", borderBottom: `1.5px solid ${t.border}` }}
      >
        <div className="flex items-center gap-3">
          {/* Mobile Hamburger Toggle Button (Requirement 6) */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-xl md:hidden transition-transform active:scale-95"
            style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}` }}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          {/* Brand Logo & Name */}
          <button className="flex items-center gap-2.5" onClick={() => navigate("/")}>
            <Logomark size={28} color={t.purple} />
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 19, letterSpacing: "-0.02em" }}>
              Modular <span style={{ color: t.teal }}>Medico</span>
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {!isLoggedIn ? (
            <button
              onClick={() => navigate("/login")}
              className="hidden rounded-full px-4 py-1.5 text-xs font-extrabold sm:inline-flex"
              style={{ backgroundColor: t.gold, color: "#241A08", fontFamily: FONT_BODY }}
            >
              Log in
            </button>
          ) : (
            <span className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold sm:inline-flex" style={{ backgroundColor: `${t.green}22`, color: t.green }}>
              <Flame size={12} /> {profile?.streak ?? 0}-day streak
            </span>
          )}

          <button
            onClick={() => navigate("/search")}
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}` }}
            aria-label="Search questions"
          >
            <Search size={16} color={t.textMuted} />
          </button>

          <button
            onClick={toggleDark}
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}` }}
            aria-label="Toggle dark/light mode"
          >
            {isDark ? <Sun size={16} color={t.gold} /> : <Moon size={16} color={t.purple} />}
          </button>

          <button
            onClick={() => navigate("/admin")}
            className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}` }}
            title="Faculty Admin"
          >
            <Shield size={16} color={t.teal} />
          </button>
        </div>
      </header>

      {/* App Body Layout */}
      <div className="mx-auto flex w-full max-w-6xl flex-1">
        {/* Desktop Collapsible Sidebar */}
        <aside
          className={`sticky top-[61px] hidden h-[calc(100vh-61px)] shrink-0 flex-col justify-between py-6 pl-4 pr-2 md:flex transition-all duration-200 ${
            sidebarCollapsed ? "w-20" : "w-56"
          }`}
          style={{ borderRight: `1.5px solid ${t.border}` }}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-end px-2">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-xs opacity-60 hover:opacity-100"
                style={{ backgroundColor: t.surfaceAlt, color: t.textMuted }}
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>
            </div>

            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.to, item.end);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition-colors ${
                      sidebarCollapsed ? "justify-center px-2" : ""
                    }`}
                    style={{
                      backgroundColor: active ? t.purpleDeep : "transparent",
                      color: active ? (isDark ? "#fff" : t.purpleStrong) : t.textMuted,
                    }}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <item.icon size={18} />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </NavLink>
                );
              })}

              <div className="my-2 h-px" style={{ backgroundColor: t.border }} />

              {SECONDARY_NAV_ITEMS.map((item) => {
                const active = isActive(item.to);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition-colors ${
                      sidebarCollapsed ? "justify-center px-2" : ""
                    }`}
                    style={{
                      backgroundColor: active ? t.purpleDeep : "transparent",
                      color: active ? (isDark ? "#fff" : t.purpleStrong) : t.textMuted,
                    }}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <item.icon size={18} />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="flex flex-col gap-2">
            {isLoggedIn ? (
              <button
                onClick={() => {
                  firebaseLogOut();
                  navigate("/");
                }}
                className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-bold ${
                  sidebarCollapsed ? "justify-center px-2" : ""
                }`}
                style={{ color: t.textFaint }}
                title={sidebarCollapsed ? "Log out" : undefined}
              >
                <LogOut size={16} />
                {!sidebarCollapsed && <span>Log out</span>}
              </button>
            ) : (
              <NavLink
                to="/login"
                className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-bold ${
                  sidebarCollapsed ? "justify-center px-2" : ""
                }`}
                style={{ color: t.textFaint }}
                title={sidebarCollapsed ? "Log in" : undefined}
              >
                <User size={16} />
                {!sidebarCollapsed && <span>Log in</span>}
              </NavLink>
            )}
          </div>
        </aside>

        {/* Collapsible Mobile Menu Drawer (Requirement 6) */}
        {menuOpen && (
          <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMenuOpen(false)}>
            <div
              className="absolute inset-0 transition-opacity duration-300"
              style={{ backgroundColor: "rgba(10,6,20,0.65)", backdropFilter: "blur(4px)" }}
            />
            <div
              className="absolute left-0 top-0 h-full w-72 p-6 shadow-2xl flex flex-col justify-between"
              style={{ backgroundColor: t.surface, borderRight: `1.5px solid ${t.border}` }}
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <div className="mb-6 flex items-center justify-between border-b pb-4" style={{ borderColor: t.border }}>
                  <div className="flex items-center gap-2">
                    <Logomark size={24} color={t.purple} />
                    <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>
                      Modular <span style={{ color: t.teal }}>Medico</span>
                    </span>
                  </div>
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: t.surfaceAlt }}
                    aria-label="Close menu"
                  >
                    <X size={16} />
                  </button>
                </div>

                <nav className="flex flex-col gap-1.5">
                  {NAV_ITEMS.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all"
                      style={{
                        backgroundColor: isActive(item.to, item.end) ? t.purpleDeep : "transparent",
                        color: isActive(item.to, item.end) ? (isDark ? "#fff" : t.purpleStrong) : t.textMuted,
                      }}
                    >
                      <item.icon size={18} /> {item.label}
                    </NavLink>
                  ))}

                  <div className="my-3 h-px" style={{ backgroundColor: t.border }} />

                  {SECONDARY_NAV_ITEMS.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all"
                      style={{
                        backgroundColor: isActive(item.to) ? t.purpleDeep : "transparent",
                        color: isActive(item.to) ? (isDark ? "#fff" : t.purpleStrong) : t.textMuted,
                      }}
                    >
                      <item.icon size={18} /> {item.label}
                    </NavLink>
                  ))}

                  <div className="my-3 h-px" style={{ backgroundColor: t.border }} />

                  <NavLink
                    to="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold"
                    style={{ color: t.teal }}
                  >
                    <Shield size={18} /> Faculty Admin Panel
                  </NavLink>
                </nav>
              </div>

              <div className="border-t pt-4" style={{ borderColor: t.border }}>
                {isLoggedIn ? (
                  <button
                    onClick={() => {
                      firebaseLogOut();
                      setMenuOpen(false);
                      navigate("/");
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold"
                    style={{ color: t.textFaint }}
                  >
                    <LogOut size={17} /> Log out
                  </button>
                ) : (
                  <NavLink
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold"
                    style={{ color: t.textFaint }}
                  >
                    <User size={17} /> Log in to Account
                  </NavLink>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="w-full flex-1 px-4 pt-4 pb-24 md:px-8 md:pt-6 md:pb-12 min-h-[calc(100vh-61px)] overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      {/* Universal Footer Component (Requirement 4) */}
      <Footer />

      {/* Bottom Mobile Tab Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around py-2 px-2 pb-[max(0.625rem,env(safe-area-inset-bottom))] md:hidden backdrop-blur-md"
        style={{ backgroundColor: `${t.surface}F2`, borderTop: `1.5px solid ${t.border}` }}
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.to, item.end);
          if (item.center) {
            return (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className="flex flex-col items-center gap-1 px-2 active:scale-95 transition-transform"
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: t.gold,
                    marginTop: -18,
                    boxShadow: `0 6px 16px -4px ${t.gold}88`,
                  }}
                >
                  <item.icon size={19} color="#241A08" />
                </div>
                <span style={{ fontSize: 10, color: active ? t.text : t.textFaint, fontFamily: FONT_BODY, fontWeight: 700 }}>
                  {item.label}
                </span>
              </button>
            );
          }
          return (
            <button
              key={item.to}
              onClick={() => navigate(item.to)}
              className="flex flex-col items-center gap-1 px-2 py-1 active:scale-95 transition-transform"
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
                style={{ backgroundColor: active ? t.purpleStrong : "transparent" }}
              >
                <item.icon size={17} color={active ? "#fff" : t.textMuted} />
              </div>
              <span style={{ fontSize: 10, color: active ? t.text : t.textFaint, fontFamily: FONT_BODY, fontWeight: 700 }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
