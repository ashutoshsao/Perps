import { FormEvent, useState } from "react";
import { api } from "../api/client";
import { normalizeMarketSymbol } from "../api/symbols";
import { navigate } from "../app/navigation";
import { useAsyncData } from "../hooks/useAsyncData";
import { BrandBar, HeaderActionButton, PanelState } from "../components/ui";
import { parsePositiveInt } from "../lib/format";
import { sortMarkets } from "../lib/markets";

export function AdminScreen({ token, onSignOut }: { token: string | null; onSignOut: () => void }) {
  const [adminToken, setAdminToken] = useState("");
  const [symbol, setSymbol] = useState("BTC");
  const [imageUrl, setImageUrl] = useState("");
  const [maxLeverage, setMaxLeverage] = useState("10");
  const [minQty, setMinQty] = useState("1");
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const marketsState = useAsyncData(() => api.getMarkets(), [message]);
  const markets = sortMarkets(marketsState.data?.markets ?? []);

  async function handleCreateMarket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      navigate("signin");
      return;
    }

    setMessage(null);
    setError(null);

    const normalizedSymbol = normalizeMarketSymbol(symbol);
    const parsedMaxLeverage = parsePositiveInt(maxLeverage);
    const parsedMinQty = parsePositiveInt(minQty);

    if (!adminToken.trim()) {
      setError("Enter the admin token.");
      return;
    }
    if (!normalizedSymbol) {
      setError("Enter a market symbol like BTC.");
      return;
    }
    if (!parsedMaxLeverage) {
      setError("Max leverage must be a positive whole number.");
      return;
    }
    if (!parsedMinQty) {
      setError("Minimum quantity must be a positive whole number.");
      return;
    }

    try {
      setIsCreating(true);
      const response = await api.createMarket(token, adminToken.trim(), {
        symbol: normalizedSymbol,
        imageUrl: imageUrl.trim(),
        maxLeverage: parsedMaxLeverage,
        minQty: parsedMinQty,
      });
      setSymbol(normalizedSymbol);
      setMessage(`Market ${normalizedSymbol} created. ID: ${response.marketId}.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Market creation failed");
    } finally {
      setIsCreating(false);
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
          <HeaderActionButton onClick={() => token ? navigate("wallet") : navigate("signin")}>
            Wallet
          </HeaderActionButton>
          <HeaderActionButton onClick={token ? onSignOut : () => navigate("signin")} emphasis={!token}>
            {token ? "Sign out" : "Sign in"}
          </HeaderActionButton>
        </div>
      </header>

      <section className="mx-auto grid max-w-5xl gap-px bg-exchange-800 p-px sm:mt-10 lg:grid-cols-[1fr_1.15fr]">
        <div className="bg-exchange-900 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Admin</p>
          <h1 className="mt-3 text-xl font-semibold text-white">Create market</h1>
          <p className="mt-2 text-sm text-exchange-400">Add a base-asset market to the engine and DB projection.</p>

          <div className="mt-6 border border-exchange-800">
            <div className="border-b border-exchange-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-exchange-500">
              Existing markets
            </div>
            <div className="max-h-72 overflow-y-auto">
              {markets.length === 0 ? (
                <PanelState message={marketsState.isLoading ? "Loading markets" : "No markets created"} />
              ) : markets.map((market) => (
                <div key={market.id} className="grid grid-cols-[1fr_auto] gap-3 border-b border-exchange-800 px-3 py-3 last:border-b-0">
                  <div>
                    <p className="font-mono text-sm font-semibold text-white">{market.symbol}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-exchange-500">PERPETUAL</p>
                  </div>
                  <div className="text-right font-mono text-xs text-exchange-400">
                    <p>{market.maxLeverage}x</p>
                    <p className="mt-1">min {market.minQty}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleCreateMarket} className="bg-exchange-900 p-5">
          <div className="grid gap-4">
            <AdminTextInput
              label="Admin token"
              value={adminToken}
              onChange={setAdminToken}
              placeholder="ADMIN_SECRET"
              type="password"
            />
            <AdminTextInput
              label="Symbol"
              value={symbol}
              onChange={(value) => setSymbol(normalizeMarketSymbol(value))}
              placeholder="BTC"
            />
            <AdminTextInput
              label="Image URL"
              value={imageUrl}
              onChange={setImageUrl}
              placeholder="https://..."
            />
            <div className="grid grid-cols-2 gap-3">
              <AdminTextInput
                label="Max leverage"
                value={maxLeverage}
                onChange={setMaxLeverage}
                placeholder="10"
                inputMode="numeric"
              />
              <AdminTextInput
                label="Min quantity"
                value={minQty}
                onChange={setMinQty}
                placeholder="1"
                inputMode="numeric"
              />
            </div>
          </div>

          {error ? <div className="mt-4 rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</div> : null}
          {message ? <div className="mt-4 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">{message}</div> : null}

          <button
            type="submit"
            disabled={isCreating || !token}
            className="mt-4 h-11 w-full rounded-md bg-cyan-300 text-sm font-semibold text-exchange-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {token ? isCreating ? "Creating..." : "Create market" : "Sign in as admin"}
          </button>
        </form>
      </section>
    </main>
  );
}

function AdminTextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "decimal" | "email" | "none" | "numeric" | "search" | "tel" | "text" | "url";
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.14em] text-exchange-500">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md border border-exchange-800 bg-exchange-950 px-3 font-mono text-sm text-white outline-none placeholder:text-exchange-600 focus:border-cyan-300"
      />
    </label>
  );
}
