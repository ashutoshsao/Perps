import { FormEvent, useState } from "react";
import { api } from "../api/client";
import { navigate } from "../app/navigation";
import { useAsyncData } from "../hooks/useAsyncData";
import { BrandBar, HeaderActionButton, Metric } from "../components/ui";
import { formatNumber, parsePositiveInt } from "../lib/format";

export function WalletScreen({ token, onSignOut }: { token: string | null; onSignOut: () => void }) {
  const [version, setVersion] = useState(0);
  const [amount, setAmount] = useState("100000");
  const [isFunding, setIsFunding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const balanceState = useAsyncData(
    () => token ? api.getBalance(token).then((data) => data.response) : Promise.resolve(null),
    [token, version],
  );

  async function handleDeposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      navigate("signin");
      return;
    }

    setMessage(null);
    setError(null);
    const parsedAmount = parsePositiveInt(amount);
    if (!parsedAmount) {
      setError("Enter a positive whole-number amount.");
      return;
    }

    try {
      setIsFunding(true);
      const response = await api.addBalance(token, parsedAmount);
      setMessage(`Balance added. Available: $${formatNumber(response.response.available)}.`);
      setVersion((current) => current + 1);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Funding failed");
    } finally {
      setIsFunding(false);
    }
  }

  return (
    <main className="min-h-screen bg-exchange-950 text-exchange-100">
      <header className="flex h-16 items-center justify-between border-b border-exchange-800 px-4">
        <button type="button" onClick={() => navigate("trade")} className="text-left">
          <BrandBar />
        </button>
        <div className="flex items-center gap-2">
          <HeaderActionButton onClick={() => navigate("trade")}>
            Trade
          </HeaderActionButton>
          <HeaderActionButton onClick={() => token ? navigate("admin") : navigate("signin")}>
            Admin
          </HeaderActionButton>
          <HeaderActionButton onClick={token ? onSignOut : () => navigate("signin")} emphasis={!token}>
            {token ? "Sign out" : "Sign in"}
          </HeaderActionButton>
        </div>
      </header>

      <section className="mx-auto grid max-w-4xl gap-px bg-exchange-800 p-px sm:mt-10 sm:grid-cols-[1fr_1.1fr]">
        <div className="bg-exchange-900 p-5">
          <h1 className="text-xl font-semibold text-white">Wallet</h1>
          <p className="mt-2 text-sm text-exchange-400">Manage test collateral for the trading account.</p>
          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-exchange-800 bg-exchange-800">
            <Metric label="Available" value={balanceState.isLoading ? "..." : `$${formatNumber(balanceState.data?.available ?? 0)}`} />
            <Metric label="Locked" value={balanceState.isLoading ? "..." : `$${formatNumber(balanceState.data?.locked ?? 0)}`} />
          </div>
        </div>

        <form onSubmit={handleDeposit} className="bg-exchange-900 p-5">
          <label className="block">
            <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.14em] text-exchange-500">Add balance</span>
            <input
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-11 w-full rounded-md border border-exchange-800 bg-exchange-950 px-3 font-mono text-sm text-white outline-none focus:border-cyan-300"
            />
          </label>
          {error ? <div className="mt-4 rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</div> : null}
          {message ? <div className="mt-4 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">{message}</div> : null}
          <button
            type="submit"
            disabled={isFunding || !token}
            className="mt-4 h-11 w-full rounded-md bg-cyan-300 text-sm font-semibold text-exchange-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {token ? isFunding ? "Adding..." : "Add balance" : "Sign in to fund"}
          </button>
        </form>
      </section>
    </main>
  );
}
