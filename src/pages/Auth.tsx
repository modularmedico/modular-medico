import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import Card from "../components/Card";
import Btn from "../components/Btn";
import Logomark from "../components/Logomark";
import { THEME, FONT_DISPLAY, FONT_MONO } from "../theme";
import { useAppStore } from "../store/useAppStore";
import { signUp, logIn, authErrorMessage } from "../services/auth";

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const mode = location.pathname === "/signup" ? "signup" : "login";
  const isDark = useAppStore((s) => s.isDark);
  const t = isDark ? THEME.dark : THEME.light;
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    const cleanEmail = form.email.trim();
    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }
    if (!form.password) {
      setError("Please enter your password.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        await signUp(form.name, cleanEmail, form.password);
        navigate("/paywall");
      } else {
        await logIn(cleanEmail, form.password);
        navigate("/");
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-5 pt-4 sm:pt-8 pb-12">
      <div className="text-center">
        <Logomark size={36} color={t.purple} />
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, marginTop: 10 }}>
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p style={{ color: t.textMuted, fontSize: 13, marginTop: 4 }}>
          Sync your MB practice, spaced repetition, and streaks across devices.
        </p>
      </div>

      <Card t={t} className="flex flex-col gap-3">
        {mode === "signup" && (
          <div>
            <label className="mb-1 block text-xs font-bold" style={{ color: t.textFaint }}>
              Full name
            </label>
            <input
              placeholder="e.g. Dr. Alex Chen"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
              style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-bold" style={{ color: t.textFaint }}>
            Email address
          </label>
          <input
            placeholder="student@example.com"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
            style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-xs font-bold" style={{ color: t.textFaint }}>
              Password
            </label>
            {mode === "signup" && (
              <span style={{ fontSize: 11, color: t.textFaint, fontFamily: FONT_MONO }}>Min. 6 chars</span>
            )}
          </div>
          <div className="relative">
            <input
              placeholder="••••••••"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="w-full rounded-xl px-4 py-3 pr-11 text-sm outline-none transition-colors"
              style={{ backgroundColor: t.surfaceAlt, border: `1.5px solid ${t.border}`, color: t.text }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
              style={{ color: t.textFaint }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl p-3 text-xs" style={{ backgroundColor: `${t.red}18`, color: t.red, lineHeight: 1.4 }}>
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Btn t={t} full disabled={loading} onClick={submit} style={{ marginTop: 4 }}>
          {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create Account"}
        </Btn>

        <button
          onClick={() => {
            setError("");
            navigate(mode === "login" ? "/signup" : "/login");
          }}
          className="py-1 text-center text-xs font-bold"
          style={{ color: t.teal, fontFamily: FONT_MONO }}
        >
          {mode === "login" ? "New here? Create a free account" : "Already have an account? Log in"}
        </button>
      </Card>

      <button onClick={() => navigate("/")} className="text-center text-xs" style={{ color: t.textFaint }}>
        Continue as guest instead
      </button>
    </div>
  );
}
