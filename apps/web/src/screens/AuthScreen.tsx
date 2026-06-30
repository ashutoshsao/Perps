import { FormEvent, useState } from "react";
import { api } from "../api/client";
import { navigate } from "../app/navigation";
import { BrandBar, Field, Metric } from "../components/ui";

export function AuthScreen({ mode, onAuth }: { mode: "signin" | "signup"; onAuth: (token: string) => void }) {
  const isSignup = mode === "signup";
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "");

    try {
      const response = isSignup
        ? await api.signup({ name, username, password })
        : await api.signin({ username, password });
      onAuth(response.token);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.12),transparent_32%),#060d11] text-exchange-100">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="flex min-h-[44vh] flex-col justify-between border-b border-exchange-800 px-6 py-6 lg:min-h-screen lg:border-b-0 lg:border-r lg:px-10">
          <BrandBar />
          <div className="max-w-2xl py-16">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Perpetual Futures</p>
            <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Trade with the full market in view.
            </h1>
            <div className="mt-10 grid max-w-xl grid-cols-3 gap-px overflow-hidden rounded border border-exchange-800 bg-exchange-800">
              <Metric label="Mark" value="Live" />
              <Metric label="Trades" value="Fills" />
              <Metric label="Candles" value="OHLCV" />
            </div>
          </div>
          <div className="grid max-w-xl grid-cols-3 gap-px border border-exchange-800 bg-exchange-800">
            <Metric label="Markets" value="BTC / ETH / SOL" />
            <Metric label="Collateral" value="USD" />
            <Metric label="Mode" value="Perpetuals" />
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-md border border-exchange-800 bg-exchange-900/80 p-5 shadow-2xl shadow-black/30"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">{isSignup ? "Create account" : "Sign in"}</h2>
                <p className="mt-1 text-sm text-exchange-400">{isSignup ? "Start trading perpetuals." : "Return to your account."}</p>
              </div>
              <button
                type="button"
                onClick={() => navigate(isSignup ? "signin" : "signup")}
                className="text-sm font-medium text-cyan-300 hover:text-cyan-200"
              >
                {isSignup ? "Sign in" : "Create account"}
              </button>
            </div>

            {isSignup ? <Field label="Name" name="name" autoComplete="name" /> : null}
            <Field label="Username" name="username" autoComplete="username" />
            <Field label="Password" name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} />

            {error ? (
              <div className="rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-4 h-11 w-full rounded-md bg-cyan-300 text-sm font-semibold text-exchange-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-exchange-950"
            >
              {isSubmitting ? "Working..." : isSignup ? "Create account" : "Sign in"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
