import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { BackpackLogo } from "../../icons";

const DEMO_DEPOSIT_AMOUNT = 10000;

function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function AuthModal() {
  const { modalOpen, modalMode, closeAuthModal, login, signup } = useAuth();
  const { push } = useToast();
  const [mode, setMode] = useState(modalMode);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (modalOpen) setMode(modalMode);
  }, [modalOpen, modalMode]);

  if (!modalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Enter a username");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      if (mode === "login") {
        await login(username.trim(), password);
        push(`Welcome back, ${username.trim()}`, "success");
      } else {
        await signup(name.trim(), username.trim(), password);
        push(`Account created for ${username.trim()}`, "success");
      }
      setName("");
      setUsername("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemo = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const guestId = Math.random().toString(36).slice(2, 8);
      const guestUsername = `guest_${guestId}`;
      const guestPassword = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const response = await signup("Guest", guestUsername, guestPassword);
      await api.addBalance(response.token, DEMO_DEPOSIT_AMOUNT);
      push(`Trying demo mode as ${guestUsername}`, "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start demo");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={closeAuthModal}
    >
      <div
        className="w-[380px] rounded-2xl border border-border bg-panel p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BackpackLogo size={24} />
            <span className="text-[16px] font-bold text-text">Backpack</span>
          </div>
          <button
            type="button"
            onClick={closeAuthModal}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-surface hover:text-text"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="mb-5 flex items-center gap-1 rounded-lg bg-surface p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded-md py-1.5 text-[13px] font-semibold transition-colors ${
              mode === "login" ? "bg-surface-2 text-text" : "text-text-muted hover:text-text"
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-md py-1.5 text-[13px] font-semibold transition-colors ${
              mode === "signup" ? "bg-surface-2 text-text" : "text-text-muted hover:text-text"
            }`}
          >
            Sign up
          </button>
        </div>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] text-text-muted">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Trader"
                autoComplete="name"
                className="rounded-lg bg-surface px-3 py-2.5 text-[14px] text-text placeholder:text-text-dim"
              />
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-text-muted">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="trader"
              autoComplete="username"
              className="rounded-lg bg-surface px-3 py-2.5 text-[14px] text-text placeholder:text-text-dim"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-text-muted">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="rounded-lg bg-surface px-3 py-2.5 text-[14px] text-text placeholder:text-text-dim"
            />
          </label>

          {error && <span className="text-[12px] text-red">{error}</span>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 w-full rounded-lg bg-text py-3 text-[14px] font-semibold text-bg hover:bg-text/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Working..." : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <div className="mt-3 flex items-center gap-2 text-[11px] text-text-dim">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={handleDemo}
          disabled={isSubmitting}
          className="mt-3 w-full rounded-lg border border-border py-2.5 text-[13px] font-semibold text-text hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
        >
          Try Demo
        </button>

        <p className="mt-4 text-center text-[12px] text-text-muted">
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            className="font-semibold text-blue hover:opacity-80"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}
