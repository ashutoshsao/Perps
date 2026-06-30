import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api/client";
import type { Balance, Depth, Market, Ticker, Trade, UserFill, UserOrder } from "./api/types";
import { CandlestickChart } from "./features/chart/CandlestickChart";
import { useAsyncData } from "./hooks/useAsyncData";
import { useDepthSync } from "./hooks/useDepthSync";
import { useLiveCandles } from "./hooks/useLiveCandles";
import { useLiveAccountLists } from "./hooks/useLiveAccount";
import { useLiveTrades } from "./hooks/useLiveTrades";
import { useMarkPrice } from "./hooks/useMarkPrice";

type Route = "trade" | "wallet" | "signin" | "signup";
type OrderSide = "buy" | "sell";
type OrderType = "limit" | "market";
type ChartInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
type AccountTab = "positions" | "open" | "history" | "fills";
type MarketDataTab = "book" | "trades";
type DerivedPosition = {
  symbol: string;
  side: "long" | "short";
  qty: number;
  averagePrice: number;
};

const AUTH_TOKEN_KEY = "perps.auth.token";
const slippagePresetPercents = [0.1, 0.5, 1, 2, 5];
const primaryMarketOrder = ["BTC-USD", "ETH-USD", "SOL-USD"];
const fallbackMarkets: Market[] = [
  { id: "btc-usd", symbol: "BTC-USD", imageUrl: "", maxLeverage: 10, minQty: 1 },
  { id: "eth-usd", symbol: "ETH-USD", imageUrl: "", maxLeverage: 10, minQty: 1 },
  { id: "sol-usd", symbol: "SOL-USD", imageUrl: "", maxLeverage: 10, minQty: 1 },
];
const chartIntervals: ChartInterval[] = ["1m", "5m", "15m", "1h", "4h", "1d"];

function getRouteFromLocation(): Route {
  const hashRoute = window.location.hash.replace("#/", "");
  const route = hashRoute || window.location.pathname.replace(/^\//, "");
  if (route === "wallet") return route;
  if (route === "signin" || route === "signup") return route;
  return "trade";
}

function navigate(route: Route) {
  const path = route === "trade" ? "/" : `/${route}`;
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function getStoredToken() {
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function App() {
  const [route, setRoute] = useState<Route>(getRouteFromLocation);
  const [token, setToken] = useState<string | null>(getStoredToken);

  useEffect(() => {
    if (window.location.hash.startsWith("#/")) {
      const initialRoute = getRouteFromLocation();
      window.history.replaceState(null, "", initialRoute === "trade" ? "/" : `/${initialRoute}`);
    }

    const onLocationChange = () => setRoute(getRouteFromLocation());
    window.addEventListener("popstate", onLocationChange);
    return () => window.removeEventListener("popstate", onLocationChange);
  }, []);

  function handleAuth(tokenValue: string) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, tokenValue);
    setToken(tokenValue);
    navigate("trade");
  }

  function handleSignOut() {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    setToken(null);
    navigate("signin");
  }

  if (route === "signin") return <AuthScreen mode="signin" onAuth={handleAuth} />;
  if (route === "signup") return <AuthScreen mode="signup" onAuth={handleAuth} />;
  if (route === "wallet") return <WalletScreen token={token} onSignOut={handleSignOut} />;
  return <ExchangeShell token={token} onSignOut={handleSignOut} />;
}

function AuthScreen({ mode, onAuth }: { mode: "signin" | "signup"; onAuth: (token: string) => void }) {
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
              <Metric label="Mark" value="104,284.5" />
              <Metric label="Funding" value="0.0100%" />
              <Metric label="Spread" value="8.5" />
            </div>
          </div>
          <MarketPulse />
        </section>

        <section className="flex items-center justify-center px-6 py-10">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md border border-exchange-800 bg-exchange-900/80 p-5 shadow-2xl shadow-black/30"
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
              <div className="border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-4 h-11 w-full bg-cyan-300 text-sm font-semibold text-exchange-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-exchange-950"
            >
              {isSubmitting ? "Working..." : isSignup ? "Create account" : "Sign in"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function WalletScreen({ token, onSignOut }: { token: string | null; onSignOut: () => void }) {
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
          <HeaderActionButton onClick={token ? onSignOut : () => navigate("signin")} emphasis={!token}>
            {token ? "Sign out" : "Sign in"}
          </HeaderActionButton>
        </div>
      </header>

      <section className="mx-auto grid max-w-4xl gap-px bg-exchange-800 p-px sm:mt-10 sm:grid-cols-[1fr_1.1fr]">
        <div className="bg-exchange-900 p-5">
          <h1 className="text-xl font-semibold text-white">Wallet</h1>
          <p className="mt-2 text-sm text-exchange-400">Manage test collateral for the trading account.</p>
          <div className="mt-6 grid grid-cols-2 gap-px border border-exchange-800 bg-exchange-800">
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
              className="h-11 w-full border border-exchange-800 bg-exchange-950 px-3 font-mono text-sm text-white outline-none focus:border-cyan-300"
            />
          </label>
          {error ? <div className="mt-4 border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</div> : null}
          {message ? <div className="mt-4 border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">{message}</div> : null}
          <button
            type="submit"
            disabled={isFunding || !token}
            className="mt-4 h-11 w-full bg-cyan-300 text-sm font-semibold text-exchange-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {token ? isFunding ? "Adding..." : "Add balance" : "Sign in to fund"}
          </button>
        </form>
      </section>
    </main>
  );
}

function ExchangeShell({ token, onSignOut }: { token: string | null; onSignOut: () => void }) {
  const marketsState = useAsyncData(() => api.getMarkets(), []);
  const markets = marketsState.data?.markets ?? [];
  const visibleMarkets = useMemo(() => sortMarkets(markets.length ? markets : fallbackMarkets), [markets]);
  const [selectedMarket, setSelectedMarket] = useState("");
  const [isMarketPickerOpen, setIsMarketPickerOpen] = useState(false);
  const [marketDataTab, setMarketDataTab] = useState<MarketDataTab>("book");
  const [orderSide, setOrderSide] = useState<OrderSide>("buy");
  const [chartInterval, setChartInterval] = useState<ChartInterval>("1m");
  const [isChartFullscreen, setIsChartFullscreen] = useState(false);
  const [accountVersion, setAccountVersion] = useState(0);
  const [marketVersion, setMarketVersion] = useState(0);
  const tickerState = useAsyncData(() => selectedMarket ? api.getTicker(selectedMarket) : Promise.resolve(null), [selectedMarket]);
  const depthSync = useDepthSync(selectedMarket || null);
  const markPriceState = useMarkPrice(selectedMarket || null);
  const tradesState = useAsyncData(() => selectedMarket ? api.getTrades(selectedMarket) : Promise.resolve({ trades: [] }), [selectedMarket, marketVersion]);
  const liveTrades = useLiveTrades(selectedMarket || null, tradesState.data?.trades ?? []);
  const klinesState = useAsyncData(() => selectedMarket ? api.getKlines(selectedMarket, chartInterval) : Promise.resolve({ candles: [] }), [selectedMarket, chartInterval, marketVersion]);
  const liveCandles = useLiveCandles(klinesState.data?.candles ?? [], liveTrades.liveTrades, chartInterval);
  const balanceState = useAsyncData(
    () => token ? api.getBalance(token).then((data) => data.response) : Promise.resolve(null),
    [token, accountVersion]
  );
  const openOrdersState = useAsyncData(
    () => token ? api.getOpenOrders(token).then((data) => data.orders) : Promise.resolve([]),
    [token, accountVersion]
  );
  const orderHistoryState = useAsyncData(
    () => token ? api.getOrderHistory(token).then((data) => data.orders) : Promise.resolve([]),
    [token, accountVersion]
  );
  const fillsState = useAsyncData(
    () => token ? api.getFills(token).then((data) => data.fills) : Promise.resolve([]),
    [token, accountVersion]
  );
  const liveAccount = useLiveAccountLists(token, openOrdersState.data ?? [], orderHistoryState.data ?? [], fillsState.data ?? []);
  const currentMarket = useMemo(() => visibleMarkets.find((market) => market.symbol === selectedMarket) ?? null, [visibleMarkets, selectedMarket]);
  const lastAccountActivityRef = useRef("");
  const accountActivityKey = useMemo(() => {
    const latestFill = liveAccount.fills[0];
    const latestOrders = liveAccount.orders
      .slice(0, 8)
      .map((order) => `${order.id}:${order.status}:${order.filledQty}`)
      .join("|");

    return `${latestFill?.id ?? ""}:${latestOrders}`;
  }, [liveAccount.fills, liveAccount.orders]);

  function refreshTradingData() {
    setAccountVersion((version) => version + 1);
    setMarketVersion((version) => version + 1);
    window.setTimeout(() => {
      setAccountVersion((version) => version + 1);
      setMarketVersion((version) => version + 1);
    }, 500);
  }

  useEffect(() => {
    if (visibleMarkets.length > 0 && !visibleMarkets.some((market) => market.symbol === selectedMarket)) {
      setSelectedMarket(visibleMarkets[0].symbol);
    }
  }, [visibleMarkets, selectedMarket]);

  useEffect(() => {
    if (!isChartFullscreen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsChartFullscreen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isChartFullscreen]);

  useEffect(() => {
    if (!token || !accountActivityKey) {
      lastAccountActivityRef.current = accountActivityKey;
      return;
    }

    if (!lastAccountActivityRef.current) {
      lastAccountActivityRef.current = accountActivityKey;
      return;
    }

    if (lastAccountActivityRef.current === accountActivityKey) return;
    lastAccountActivityRef.current = accountActivityKey;

    const timer = window.setTimeout(() => {
      setAccountVersion((version) => version + 1);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [token, accountActivityKey]);

  return (
    <main className="min-h-screen bg-exchange-950 text-exchange-100">
      <div className="flex min-h-screen flex-col">
        <header className="flex flex-col border-b border-exchange-800 bg-exchange-950/95 lg:h-16 lg:flex-row lg:items-center">
          <div className="flex h-16 items-center border-b border-exchange-800 px-4 lg:w-48 lg:border-b-0 lg:border-r">
            <BrandBar />
          </div>

          <div className="grid flex-1 grid-cols-2 gap-px bg-exchange-800 lg:grid-cols-[220px_repeat(4,1fr)_220px]">
            <MarketPicker
              markets={visibleMarkets}
              selectedSymbol={selectedMarket}
              isOpen={isMarketPickerOpen}
              onOpenChange={setIsMarketPickerOpen}
              onSelect={(symbol) => {
                setSelectedMarket(symbol);
                setIsMarketPickerOpen(false);
              }}
            />
            <TickerStat label="Mark" value={formatMarkPrice(markPriceState.data?.price, tickerState.data, currentMarket?.symbol ?? "Loading")} tone="neutral" />
            <TickerStat label="24h" value={formatTickerChange(tickerState.data)} tone={getTickerTone(tickerState.data)} />
            <TickerStat label="Volume" value={formatTickerVolume(tickerState.data)} tone="neutral" />
            <TickerStat label="Mark WS" value={markPriceState.error ? "Error" : markPriceState.isLive ? "Live" : "Waiting"} tone={markPriceState.error ? "negative" : markPriceState.isLive ? "positive" : "accent"} />
            <div className="flex h-14 items-center justify-end gap-2 bg-exchange-900 px-3 lg:h-16">
              <HeaderActionButton onClick={() => token ? navigate("wallet") : navigate("signin")}>
                Wallet
              </HeaderActionButton>
              <HeaderActionButton onClick={token ? onSignOut : () => navigate("signin")} emphasis={!token}>
                {token ? "Sign out" : "Sign in"}
              </HeaderActionButton>
            </div>
          </div>
        </header>

        {marketsState.error ? <StatusBanner message={`Markets unavailable: ${marketsState.error}`} /> : null}

        <section className="grid flex-1 gap-px overflow-hidden bg-exchange-800 lg:h-[calc(100vh-4rem)] lg:grid-cols-[minmax(620px,1fr)_320px_360px]">
          <div className="grid min-h-0 gap-px bg-exchange-800 lg:grid-rows-[minmax(320px,1fr)_360px]">
            <Panel
              title="Chart"
              action={
                <div className="flex items-center gap-3">
                  <LiveStatusBadge isLive={liveTrades.isLive} error={liveTrades.error} />
                  <IntervalControl value={chartInterval} onChange={setChartInterval} />
                  <button
                    type="button"
                    onClick={() => setIsChartFullscreen((current) => !current)}
                    className="h-6 border border-exchange-700 px-2 text-[11px] font-medium text-exchange-300 hover:border-cyan-300 hover:text-cyan-200"
                    aria-label={isChartFullscreen ? "Exit fullscreen chart" : "Open fullscreen chart"}
                  >
                    {isChartFullscreen ? "Exit" : "Full"}
                  </button>
                </div>
              }
              className={isChartFullscreen ? "fixed inset-0 z-50" : undefined}
              bodyClassName={isChartFullscreen ? "min-h-0 flex-1" : undefined}
            >
              <CandlestickChart
                candles={liveCandles}
                ticker={tickerState.data}
                markPrice={markPriceState.data?.price}
                symbol={selectedMarket ? formatPerpSymbol(selectedMarket) : "Loading markets"}
                isLoading={klinesState.isLoading}
                error={klinesState.error}
                className={isChartFullscreen ? "h-full min-h-0" : ""}
              />
            </Panel>
            <div className="min-h-0 bg-exchange-800">
              <Panel title="Account" action={token ? <LiveStatusBadge isLive={liveAccount.isLive} error={liveAccount.error} /> : undefined}>
                <AccountPanel
                  token={token}
                  userId={liveAccount.userId}
                  balance={balanceState.data}
                  openOrders={liveAccount.openOrders}
                  orderHistory={liveAccount.orderHistory}
                  fills={liveAccount.fills}
                  markets={visibleMarkets}
                  selectedMarket={selectedMarket}
                  markPrice={markPriceState.data?.price}
                  isLoading={balanceState.isLoading || openOrdersState.isLoading || orderHistoryState.isLoading || fillsState.isLoading}
                  onOrderSettled={refreshTradingData}
                />
              </Panel>
            </div>
          </div>

          <div className="grid min-h-0 gap-px bg-exchange-800 lg:grid-rows-[1fr_180px]">
            <Panel
              title={marketDataTab === "book" ? "Order book" : "Recent trades"}
              action={
                <div className="flex items-center gap-2">
                  {marketDataTab === "book" ? <DepthSyncBadge status={depthSync.status} lastUpdateId={depthSync.depth?.lastUpdateId} /> : <LiveStatusBadge isLive={liveTrades.isLive} error={liveTrades.error} />}
                  <SegmentedTabs
                    value={marketDataTab}
                    onChange={setMarketDataTab}
                    options={[
                      { id: "book", label: "Book" },
                      { id: "trades", label: "Trades" },
                    ]}
                  />
                </div>
              }
            >
              <div className="relative h-full min-h-0">
                <div className={marketDataTab === "book" ? "absolute inset-0" : "hidden"}>
                  <OrderBook depth={depthSync.depth} isLoading={depthSync.status === "idle" || depthSync.status === "connecting" || depthSync.status === "snapshot"} error={depthSync.error} />
                </div>
                <div className={marketDataTab === "trades" ? "absolute inset-0" : "hidden"}>
                  <TradesTable trades={liveTrades.trades} isLoading={tradesState.isLoading} error={tradesState.error} />
                </div>
              </div>
            </Panel>
            <Panel title="Market pulse">
              <MarketPulse compact ticker={tickerState.data} symbol={selectedMarket || undefined} markPrice={markPriceState.data?.price} />
            </Panel>
          </div>

          <div className="min-h-0 overflow-y-auto bg-exchange-800">
            <Panel title="Order ticket">
              {currentMarket ? (
                <OrderTicket
                  token={token}
                  market={currentMarket}
                  side={orderSide}
                  balance={balanceState.data}
                  ticker={tickerState.data}
                  markPrice={markPriceState.data?.price}
                  onSideChange={setOrderSide}
                  onOrderSettled={refreshTradingData}
                />
              ) : <PanelState message="Loading markets" />}
            </Panel>
          </div>
        </section>
      </div>
    </main>
  );
}

function BrandBar() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-8 place-items-center border border-cyan-300/40 bg-cyan-300/10 text-xs font-bold text-cyan-200">
        PX
      </div>
      <div>
        <p className="text-sm font-semibold leading-none text-white">Perps</p>
        <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-exchange-500">Exchange</p>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete: string;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-exchange-400">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        className="h-11 w-full border border-exchange-700 bg-exchange-950 px-3 text-sm text-white outline-none transition focus:border-cyan-300"
      />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-exchange-900 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-exchange-500">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function TickerStat({ label, value, tone }: { label: string; value: string; tone: "neutral" | "positive" | "negative" | "accent" }) {
  const toneClass = {
    neutral: "text-white",
    positive: "text-emerald-300",
    negative: "text-rose-300",
    accent: "text-cyan-300",
  }[tone];

  return (
    <div className="bg-exchange-900 px-4 py-3 lg:py-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-exchange-500">{label}</p>
      <p className={`mt-1 font-mono text-sm font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function HeaderActionButton({
  children,
  onClick,
  emphasis = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  emphasis?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 min-w-[72px] items-center justify-center whitespace-nowrap border px-3 text-xs font-semibold leading-none transition focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-exchange-950 ${
        emphasis
          ? "border-cyan-300 bg-cyan-300 text-exchange-950 hover:bg-cyan-200"
          : "border-exchange-700 bg-exchange-950/40 text-exchange-200 hover:border-cyan-300 hover:text-cyan-200"
      }`}
    >
      {children}
    </button>
  );
}

function MarketPicker({
  markets,
  selectedSymbol,
  isOpen,
  onOpenChange,
  onSelect,
}: {
  markets: Market[];
  selectedSymbol: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSelect: (symbol: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const selectedMarket = markets.find((market) => market.symbol === selectedSymbol);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredMarkets = normalizedQuery
    ? markets.filter((market) => {
        const perpSymbol = formatPerpSymbol(market.symbol).toLowerCase();
        const pairSymbol = formatPairSymbol(market.symbol).toLowerCase();
        return market.symbol.toLowerCase().includes(normalizedQuery)
          || perpSymbol.includes(normalizedQuery)
          || pairSymbol.includes(normalizedQuery);
      })
    : markets;

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      return;
    }

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onOpenChange]);

  return (
    <div ref={containerRef} className="relative bg-exchange-900">
      <button
        type="button"
        disabled={markets.length === 0}
        onClick={() => onOpenChange(!isOpen)}
        className="flex h-14 w-full items-center justify-between gap-3 px-4 text-left outline-none hover:bg-exchange-800 disabled:cursor-not-allowed disabled:opacity-60 lg:h-16"
      >
        <div>
          <p className="text-sm font-semibold text-white">{selectedMarket ? formatPerpSymbol(selectedMarket.symbol) : "Loading"}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-exchange-500">
            {selectedMarket ? formatPairSymbol(selectedMarket.symbol) : "Markets"}
          </p>
        </div>
        <span className="text-exchange-500">▾</span>
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-full z-30 mt-px w-[320px] border border-exchange-700 bg-exchange-950 shadow-2xl shadow-black/50">
          <div className="border-b border-exchange-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-exchange-500">
            Perpetual markets
          </div>
          <div className="border-b border-exchange-800 p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search BTC-PERP or BTC/USD"
              className="h-9 w-full border border-exchange-800 bg-exchange-900 px-3 font-mono text-xs text-white outline-none placeholder:text-exchange-600 focus:border-cyan-300"
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-1">
            {filteredMarkets.length > 0 ? filteredMarkets.map((market) => (
              <button
                key={market.id}
                type="button"
                onClick={() => {
                  onSelect(market.symbol);
                  setQuery("");
                }}
                className={`grid w-full grid-cols-[1fr_auto] gap-3 px-3 py-2 text-left hover:bg-exchange-800 ${
                  market.symbol === selectedSymbol ? "bg-cyan-300/10" : ""
                }`}
              >
                <span>
                  <span className="block text-sm font-semibold text-white">{formatPerpSymbol(market.symbol)}</span>
                  <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-exchange-500">{formatPairSymbol(market.symbol)}</span>
                </span>
                <span className="self-center font-mono text-[10px] text-exchange-500">{market.maxLeverage}x</span>
              </button>
            )) : (
              <div className="px-3 py-6 text-center text-xs text-exchange-500">No markets found</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SegmentedTabs({
  value,
  onChange,
  options,
}: {
  value: MarketDataTab;
  onChange: (value: MarketDataTab) => void;
  options: Array<{ id: MarketDataTab; label: string }>;
}) {
  return (
    <div className="flex gap-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`h-6 px-2 text-[11px] font-medium ${
            value === option.id
              ? "bg-cyan-300 text-exchange-950"
              : "bg-exchange-800 text-exchange-400 hover:text-exchange-100"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function StatusBanner({ message }: { message: string }) {
  return (
    <div className="border-b border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
      {message}
    </div>
  );
}

function Panel({
  title,
  action,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`flex min-h-0 flex-col bg-exchange-900 ${className}`}>
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-exchange-800 px-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-exchange-300">{title}</h2>
        {action}
      </div>
      <div className={`min-h-0 flex-1 overflow-hidden ${bodyClassName}`}>{children}</div>
    </section>
  );
}

function IntervalControl({ value, onChange }: { value: ChartInterval; onChange: (interval: ChartInterval) => void }) {
  return (
    <div className="flex gap-1">
      {chartIntervals.map((interval) => (
        <button
          key={interval}
          type="button"
          onClick={() => onChange(interval)}
          className={`h-6 px-2 font-mono text-[11px] ${
            value === interval
              ? "bg-cyan-300 text-exchange-950"
              : "bg-exchange-800 text-exchange-400 hover:text-exchange-100"
          }`}
        >
          {interval}
        </button>
      ))}
    </div>
  );
}

function DepthSyncBadge({ status, lastUpdateId }: { status: "idle" | "connecting" | "snapshot" | "live" | "error"; lastUpdateId?: number }) {
  const isLive = status === "live";
  return (
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-exchange-500">
      <span className={`h-1.5 w-1.5 ${isLive ? "bg-emerald-300" : status === "error" ? "bg-rose-300" : "bg-amber-300"}`} />
      <span>{isLive ? `Live ${lastUpdateId ?? 0}` : status === "idle" ? "waiting" : status}</span>
    </div>
  );
}

function LiveStatusBadge({ isLive, error }: { isLive: boolean; error: string | null }) {
  return (
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-exchange-500">
      <span className={`h-1.5 w-1.5 ${error ? "bg-rose-300" : isLive ? "bg-emerald-300" : "bg-amber-300"}`} />
      <span>{error ? "error" : isLive ? "live" : "waiting"}</span>
    </div>
  );
}

function OrderBook({ depth, isLoading, error }: { depth: Depth | null; isLoading: boolean; error: string | null }) {
  const asks = depth?.asks ?? [];
  const bids = depth?.bids ?? [];
  const bestAsk = asks[0]?.[0] ?? null;
  const bestBid = bids[0]?.[0] ?? null;
  const mid = bestAsk && bestBid ? (bestAsk + bestBid) / 2 : bestAsk ?? bestBid;
  const askRows = buildBookRows(asks.slice(0, 10), "ask").reverse();
  const bidRows = buildBookRows(bids.slice(0, 10), "bid");
  const maxCumulative = Math.max(...askRows.map((row) => row.cumulativeSize), ...bidRows.map((row) => row.cumulativeSize), 1);
  const maxLevelSize = Math.max(...askRows.map((row) => row.size), ...bidRows.map((row) => row.size), 1);

  if (isLoading) return <PanelState message="Loading depth" />;
  if (error) return <PanelState message={`Depth unavailable: ${error}`} />;
  if (asks.length === 0 && bids.length === 0) return <PanelState message="No depth available" />;

  return (
    <div className="flex h-full min-h-0 flex-col p-3 font-mono text-xs">
      <BookHeader />
      <div className="mt-2 min-h-0 flex-1 space-y-0.5 overflow-hidden">
        {askRows.map((row) => (
          <BookRow key={`ask-${row.price}`} row={row} maxCumulative={maxCumulative} maxLevelSize={maxLevelSize} />
        ))}
      </div>
      <SpreadRow bestBid={bestBid} bestAsk={bestAsk} mid={mid} />
      <div className="min-h-0 flex-1 space-y-0.5 overflow-hidden">
        {bidRows.map((row) => (
          <BookRow key={`bid-${row.price}`} row={row} maxCumulative={maxCumulative} maxLevelSize={maxLevelSize} />
        ))}
      </div>
    </div>
  );
}

function BookHeader() {
  return (
    <div className="grid shrink-0 grid-cols-3 text-[10px] uppercase tracking-[0.12em] text-exchange-500">
      <span>Price</span>
      <span className="text-right">Size</span>
      <span className="text-right">Total</span>
    </div>
  );
}

type BookSide = "bid" | "ask";
type BookRowData = {
  side: BookSide;
  price: number;
  size: number;
  cumulativeSize: number;
  cumulativeNotional: number;
};

function buildBookRows(levels: [number, number][], side: BookSide): BookRowData[] {
  let cumulativeSize = 0;

  return levels.map(([price, size]) => {
    cumulativeSize += size;
    return {
      side,
      price,
      size,
      cumulativeSize,
      cumulativeNotional: cumulativeSize * price,
    };
  });
}

function SpreadRow({ bestBid, bestAsk, mid }: { bestBid: number | null; bestAsk: number | null; mid: number | null }) {
  const spread = bestBid && bestAsk ? bestAsk - bestBid : null;
  const spreadBps = spread && mid ? (spread / mid) * 10_000 : null;

  return (
    <div className="my-2 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center border-y border-exchange-800 py-2">
      <span className="text-[10px] uppercase tracking-[0.12em] text-exchange-500">Spread</span>
      <div className="text-center">
        <p className="font-mono text-base font-semibold text-white">{mid ? formatNumber(mid) : "-"}</p>
        <p className="mt-0.5 text-[10px] text-exchange-500">
          {spread === null ? "-" : `${formatNumber(spread)} / ${spreadBps?.toFixed(2)} bps`}
        </p>
      </div>
      <span className="text-right text-[10px] uppercase tracking-[0.12em] text-exchange-500">Mid</span>
    </div>
  );
}

function BookRow({ row, maxCumulative, maxLevelSize }: { row: BookRowData; maxCumulative: number; maxLevelSize: number }) {
  const color = row.side === "bid" ? "text-emerald-300" : "text-rose-300";
  const cumulativeBar = row.side === "bid" ? "bg-emerald-400/10" : "bg-rose-400/10";
  const levelBar = row.side === "bid" ? "bg-emerald-300/22" : "bg-rose-300/22";
  const cumulativeWidth = `${Math.max(4, (row.cumulativeSize / maxCumulative) * 100)}%`;
  const levelWidth = `${Math.max(3, (row.size / maxLevelSize) * 100)}%`;

  return (
    <div className="relative grid h-6 grid-cols-3 items-center overflow-hidden px-1">
      <div className={`absolute inset-y-0 right-0 ${cumulativeBar}`} style={{ width: cumulativeWidth }} />
      <div className={`absolute inset-y-1 right-0 ${levelBar}`} style={{ width: levelWidth }} />
      <span className={`relative ${color}`}>{formatNumber(row.price)}</span>
      <span className="relative text-right text-exchange-200">{formatNumber(row.size)}</span>
      <span className="relative text-right text-exchange-400">{formatNumber(row.cumulativeNotional)}</span>
    </div>
  );
}

function TradesTable({ trades, isLoading, error }: { trades: Trade[]; isLoading: boolean; error: string | null }) {
  if (isLoading) return <PanelState message="Loading trades" />;
  if (error) return <PanelState message={`Trades unavailable: ${error}`} />;
  if (trades.length === 0) return <PanelState message="No recent trades" />;

  return (
    <div className="flex h-full min-h-0 flex-col p-3 font-mono text-xs">
      <div className="grid shrink-0 grid-cols-3 text-[10px] uppercase tracking-[0.12em] text-exchange-500">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Time</span>
      </div>
      <div className="mt-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
        {trades.map((trade) => (
          <div key={`${trade.time}-${trade.price}-${trade.qty}`} className="grid h-7 grid-cols-3 items-center px-1 hover:bg-exchange-800/70">
            <span className={trade.side === "buy" ? "text-emerald-300" : "text-rose-300"}>
              <span className="mr-1 text-[9px]">{trade.side === "buy" ? "B" : "S"}</span>
              {formatNumber(trade.price)}
            </span>
            <span className="text-right text-exchange-200">{formatNumber(trade.qty)}</span>
            <span className="text-right text-exchange-500">{formatTime(trade.time)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderTicket({
  token,
  market,
  side,
  balance,
  ticker,
  markPrice,
  onSideChange,
  onOrderSettled,
}: {
  token: string | null;
  market: Market;
  side: OrderSide;
  balance: Balance | null;
  ticker: Ticker | null;
  markPrice?: number;
  onSideChange: (side: OrderSide) => void;
  onOrderSettled: () => void;
}) {
  const [orderType, setOrderType] = useState<OrderType>("limit");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState(String(market.minQty));
  const [leverage, setLeverage] = useState(1);
  const [slippagePercent, setSlippagePercent] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sideClasses = side === "buy" ? "bg-emerald-400 text-exchange-950" : "bg-rose-400 text-white";
  const parsedQty = Number(qty);
  const parsedLimitPrice = Number(price);
  const referencePrice = orderType === "limit" && Number.isFinite(parsedLimitPrice) && parsedLimitPrice > 0
    ? parsedLimitPrice
    : getReferencePrice(markPrice, ticker);
  const estimatedNotional = Number.isFinite(parsedQty) && parsedQty > 0 && referencePrice
    ? parsedQty * referencePrice
    : null;
  const estimatedMargin = estimatedNotional
    ? estimatedNotional / leverage
    : null;
  const hasEnoughBalance = estimatedMargin === null || !balance || balance.available >= estimatedMargin;

  useEffect(() => {
    setQty(String(market.minQty));
    setPrice("");
    setLeverage(1);
    setSlippagePercent(1);
    setError(null);
    setSuccess(null);
  }, [market.symbol, market.minQty]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError("Sign in before placing an order.");
      return;
    }

    const parsedQty = parsePositiveInt(qty);
    const parsedPrice = parsePositiveInt(price);
    const parsedSlippage = percentToBps(slippagePercent);

    if (!parsedQty || parsedQty < market.minQty) {
      setError(`Quantity must be at least ${market.minQty}.`);
      return;
    }
    if (leverage < 1 || leverage > market.maxLeverage) {
      setError(`Leverage must be between 1 and ${market.maxLeverage}.`);
      return;
    }
    if (orderType === "limit" && !parsedPrice) {
      setError("Limit orders need a positive price.");
      return;
    }
    if (orderType === "market" && parsedSlippage === null) {
      setError("Choose a slippage between 0% and 100%.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await api.placeOrder(token, orderType === "limit"
        ? {
            orderType,
            side,
            symbol: market.symbol,
            price: parsedPrice!,
            qty: parsedQty,
            leverage,
          }
        : {
            orderType,
            side,
            symbol: market.symbol,
            qty: parsedQty,
            leverage,
            slippageBps: parsedSlippage!,
          });
      setSuccess(`Order ${response.order.status.replace("_", " ")}.`);
      onOrderSettled();
    } catch (error) {
      setError(formatOrderError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onSideChange("buy")}
          className={`h-10 text-sm font-semibold ${side === "buy" ? "bg-emerald-400 text-exchange-950" : "bg-exchange-800 text-exchange-300"}`}
        >
          Buy
        </button>
        <button
          type="button"
          onClick={() => onSideChange("sell")}
          className={`h-10 text-sm font-semibold ${side === "sell" ? "bg-rose-400 text-white" : "bg-exchange-800 text-exchange-300"}`}
        >
          Sell
        </button>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-exchange-500">Type</span>
        <select
          value={orderType}
          onChange={(event) => setOrderType(event.target.value as OrderType)}
          className="h-10 w-full border border-exchange-800 bg-exchange-950 px-3 text-sm text-white outline-none focus:border-cyan-300"
        >
          <option value="limit">Limit</option>
          <option value="market">Market</option>
        </select>
      </label>
      {orderType === "limit" ? (
        <TicketInput label="Price" value={price} onChange={setPrice} placeholder="100" />
      ) : (
        <SlippageControl value={slippagePercent} onChange={setSlippagePercent} />
      )}
      <TicketInput label="Quantity" value={qty} onChange={setQty} placeholder={String(market.minQty)} />
      <LeverageControl value={leverage} max={market.maxLeverage} onChange={setLeverage} />
      <div className="grid grid-cols-2 gap-px border border-exchange-800 bg-exchange-800">
        <Metric label="Min qty" value={formatNumber(market.minQty)} />
        <Metric label="Max lev" value={`${market.maxLeverage}x`} />
      </div>
      <div className="grid grid-cols-2 gap-px border border-exchange-800 bg-exchange-800">
        <Metric label="Notional" value={estimatedNotional === null ? "-" : `$${formatNumber(estimatedNotional)}`} />
        <Metric label="Margin" value={estimatedMargin === null ? "-" : `$${formatNumber(estimatedMargin)}`} />
      </div>
      <div className="grid grid-cols-2 gap-px border border-exchange-800 bg-exchange-800">
        <Metric label="Available" value={balance ? `$${formatNumber(balance.available)}` : token ? "..." : "-"} />
        <Metric label="Est. price" value={referencePrice ? formatNumber(referencePrice) : "-"} />
      </div>
      {!hasEnoughBalance ? <div className="border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">Available balance is below estimated margin.</div> : null}
      {error ? <div className="border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</div> : null}
      {success ? <div className="border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">{success}</div> : null}
      <button type="submit" disabled={isSubmitting || !hasEnoughBalance} className={`h-11 w-full text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${sideClasses}`}>
        {isSubmitting ? "Submitting..." : side === "buy" ? "Place buy order" : "Place sell order"}
      </button>
    </form>
  );
}

function TicketInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.14em] text-exchange-500">{label}</span>
      <input
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full border border-exchange-800 bg-exchange-950 px-3 font-mono text-sm text-white outline-none focus:border-cyan-300"
      />
    </label>
  );
}

function LeverageControl({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="border border-exchange-800 p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-exchange-500">Leverage</span>
        <span className="font-mono text-sm font-semibold text-white">{value}x</span>
      </div>
      <input
        type="range"
        min={1}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="exchange-slider w-full"
      />
      <div className="mt-2 flex justify-between font-mono text-[10px] text-exchange-500">
        <span>1x</span>
        <span>{max}x</span>
      </div>
    </div>
  );
}

function SlippageControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const customValue = String(value);

  return (
    <div className="border border-exchange-800 p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-exchange-500">Max slippage</span>
        <span className="font-mono text-sm font-semibold text-white">{formatPercent(value)}</span>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {slippagePresetPercents.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            className={`h-8 font-mono text-[11px] ${
              value === preset
                ? "bg-cyan-300 text-exchange-950"
                : "bg-exchange-800 text-exchange-300 hover:text-white"
            }`}
          >
            {formatPercent(preset)}
          </button>
        ))}
      </div>
      <label className="mt-2 block">
        <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-exchange-500">Custom %</span>
        <input
          inputMode="decimal"
          value={customValue}
          onChange={(event) => onChange(clampPercentInput(event.target.value))}
          className="h-9 w-full border border-exchange-800 bg-exchange-950 px-3 font-mono text-sm text-white outline-none focus:border-cyan-300"
        />
      </label>
    </div>
  );
}

function AccountPanel({
  token,
  userId,
  balance,
  openOrders,
  orderHistory,
  fills,
  markets,
  selectedMarket,
  markPrice,
  isLoading,
  onOrderSettled,
}: {
  token: string | null;
  userId: string | null;
  balance: Balance | null;
  openOrders: UserOrder[];
  orderHistory: UserOrder[];
  fills: UserFill[];
  markets: Market[];
  selectedMarket: string;
  markPrice?: number;
  isLoading: boolean;
  onOrderSettled: () => void;
}) {
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hiddenOrderIds, setHiddenOrderIds] = useState<Set<string>>(() => new Set());
  const [activeTab, setActiveTab] = useState<AccountTab>("positions");
  const cancellableOrders = openOrders.filter((order) => isCancellableOrder(order) && !hiddenOrderIds.has(order.id));
  const positions = useMemo(() => derivePositions(fills), [fills]);
  const accountTabs: Array<{ id: AccountTab; label: string; count: number }> = [
    { id: "positions", label: "Positions", count: positions.length },
    { id: "open", label: "Open orders", count: cancellableOrders.length },
    { id: "history", label: "History", count: orderHistory.length },
    { id: "fills", label: "Fills", count: fills.length },
  ];

  useEffect(() => {
    setHiddenOrderIds(new Set());
  }, [token]);

  async function handleCancel(orderId: string) {
    if (!token) return;
    setError(null);
    setCancelingOrderId(orderId);
    setHiddenOrderIds((current) => new Set(current).add(orderId));
    try {
      await api.cancelOrder(token, orderId);
      onOrderSettled();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cancel failed";
      if (isTerminalCancelError(message)) {
        onOrderSettled();
      } else {
        setHiddenOrderIds((current) => {
          const next = new Set(current);
          next.delete(orderId);
          return next;
        });
      }
      setError(isTerminalCancelError(message) ? null : message);
    } finally {
      setCancelingOrderId(null);
    }
  }

  if (!token) {
    return (
      <div className="p-4">
        <div className="border border-exchange-800 px-3 py-8 text-center text-sm text-exchange-400">
          Sign in to view balances, orders, and fills.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <div className="flex shrink-0 items-center justify-between gap-3 border border-exchange-800 px-3 py-2">
        <div>
          <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-exchange-500">Signed in as</p>
          <p className="mt-1 font-mono text-xs text-exchange-200">{formatAccountId(userId)}</p>
        </div>
        <div className="text-right font-mono text-[10px] text-exchange-500">
          <p>{fills.length} fills</p>
          <p>{positions.length} positions</p>
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-px border border-exchange-800 bg-exchange-800">
        <MiniMetric label="Available" value={isLoading ? "..." : `$${formatNumber(balance?.available ?? 0)}`} />
        <MiniMetric label="Locked" value={isLoading ? "..." : `$${formatNumber(balance?.locked ?? 0)}`} />
      </div>
      {error ? <div className="shrink-0 border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</div> : null}
      <div className="flex shrink-0 gap-1 overflow-x-auto">
        {accountTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`h-8 shrink-0 px-3 text-xs font-medium ${
              activeTab === tab.id
                ? "bg-cyan-300 text-exchange-950"
                : "bg-exchange-800 text-exchange-300 hover:text-white"
            }`}
          >
            {tab.label} <span className="font-mono opacity-70">{tab.count}</span>
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto border border-exchange-800">
      <div className={activeTab === "positions" ? "" : "hidden"}>
        {positions.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-exchange-500">
            <p>No positions</p>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-exchange-600">
              Positions are derived from this account's fills. Open orders will not appear here until they trade.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-exchange-800">
            {positions.slice(0, 4).map((position) => {
              const mark = position.symbol === selectedMarket && typeof markPrice === "number" ? markPrice / 1_000_000 : null;
              const notional = position.averagePrice * position.qty;
              const pnl = mark === null
                ? null
                : position.side === "long"
                  ? (mark - position.averagePrice) * position.qty
                  : (position.averagePrice - mark) * position.qty;
              const roe = pnl === null || notional === 0 ? null : (pnl / notional) * 100;

              return (
                <div key={position.symbol} className="space-y-2 px-3 py-3 font-mono text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="text-exchange-200">{position.symbol}</span>
                      <span className={`ml-2 ${position.side === "long" ? "text-emerald-300" : "text-rose-300"}`}>{position.side}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] uppercase tracking-[0.12em] text-exchange-500">Unrealized PnL</p>
                      <p className={pnl === null ? "text-exchange-500" : pnl >= 0 ? "text-emerald-300" : "text-rose-300"}>
                        {pnl === null ? "-" : `${pnl >= 0 ? "+" : ""}$${formatNumber(pnl)}`}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <PositionMetric label="Qty" value={formatNumber(position.qty)} />
                    <PositionMetric label="Entry" value={formatNumber(position.averagePrice)} />
                    <PositionMetric label="ROE" value={roe === null ? "-" : `${roe >= 0 ? "+" : ""}${roe.toFixed(2)}%`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className={activeTab === "open" ? "" : "hidden"}>
        {cancellableOrders.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-exchange-500">No open orders</div>
        ) : (
          <div className="divide-y divide-exchange-800">
            {cancellableOrders.slice(0, 4).map((order) => (
              <div key={order.id} className="grid grid-cols-[1fr_0.6fr_0.9fr_0.8fr_auto] items-center gap-2 px-3 py-2 font-mono text-xs">
                <span className="truncate text-exchange-300">{getMarketSymbol(order.marketId, markets)}</span>
                <span className={order.side === "buy" ? "text-emerald-300" : "text-rose-300"}>{order.side}</span>
                <span className="text-right text-exchange-200">{formatNumber(order.price)}</span>
                <span className="text-right text-exchange-400">{formatNumber(order.qty - order.filledQty)}</span>
                <button
                  type="button"
                  disabled={cancelingOrderId === order.id}
                  onClick={() => void handleCancel(order.id)}
                  className="border border-exchange-700 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-exchange-300 hover:border-rose-300 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {cancelingOrderId === order.id ? "..." : "Cancel"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={activeTab === "history" ? "" : "hidden"}>
        {orderHistory.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-exchange-500">No order history</div>
        ) : (
          <div className="divide-y divide-exchange-800">
            {orderHistory.slice(0, 4).map((order) => (
              <div key={order.id} className="grid grid-cols-[1fr_0.6fr_0.9fr_0.9fr_1fr] gap-2 px-3 py-2 font-mono text-xs">
                <span className="truncate text-exchange-300">{getMarketSymbol(order.marketId, markets)}</span>
                <span className={order.side === "buy" ? "text-emerald-300" : "text-rose-300"}>{order.side}</span>
                <span className="text-right text-exchange-200">{formatNumber(order.price)}</span>
                <span className="text-right text-exchange-400">{formatNumber(order.filledQty)}/{formatNumber(order.qty)}</span>
                <span className="text-right text-exchange-400">{order.status.replace("_", " ")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={activeTab === "fills" ? "" : "hidden"}>
        {fills.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-exchange-500">No fills</div>
        ) : (
          <div className="divide-y divide-exchange-800">
            {fills.slice(0, 4).map((fill) => (
              <div key={fill.id} className="grid grid-cols-[1fr_0.6fr_0.9fr_0.8fr_0.8fr] gap-2 px-3 py-2 font-mono text-xs">
                <span className="truncate text-exchange-300">{fill.symbol}</span>
                <span className={fill.side === "buy" ? "text-emerald-300" : "text-rose-300"}>{fill.side}</span>
                <span className="text-right text-exchange-200">{formatNumber(fill.price)}</span>
                <span className="text-right text-exchange-400">{formatNumber(fill.qty)}</span>
                <span className="text-right text-exchange-500">{formatTime(fill.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function PositionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.12em] text-exchange-500">{label}</p>
      <p className="mt-1 truncate text-exchange-300">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-exchange-900 p-2">
      <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-exchange-500">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function formatAccountId(userId: string | null) {
  if (!userId) return "Unknown account";
  if (userId.length <= 14) return userId;
  return `${userId.slice(0, 6)}...${userId.slice(-6)}`;
}

function derivePositions(fills: UserFill[]) {
  const bySymbol = new Map<string, { signedQty: number; averagePrice: number }>();

  for (const fill of [...fills].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())) {
    if (fill.makerUserId === fill.takerUserId) continue;

    const qty = fill.side === "buy" ? fill.qty : -fill.qty;
    const existing = bySymbol.get(fill.symbol);

    if (!existing || existing.signedQty === 0 || Math.sign(existing.signedQty) === Math.sign(qty)) {
      const currentQty = existing?.signedQty ?? 0;
      const nextQty = currentQty + qty;
      const weightedNotional = Math.abs(currentQty) * (existing?.averagePrice ?? 0) + Math.abs(qty) * fill.price;
      bySymbol.set(fill.symbol, {
        signedQty: nextQty,
        averagePrice: weightedNotional / Math.abs(nextQty),
      });
      continue;
    }

    const nextQty = existing.signedQty + qty;
    if (nextQty === 0) {
      bySymbol.delete(fill.symbol);
    } else if (Math.sign(nextQty) === Math.sign(existing.signedQty)) {
      bySymbol.set(fill.symbol, { ...existing, signedQty: nextQty });
    } else {
      bySymbol.set(fill.symbol, { signedQty: nextQty, averagePrice: fill.price });
    }
  }

  return Array.from(bySymbol.entries()).map(([symbol, position]): DerivedPosition => ({
    symbol,
    side: position.signedQty > 0 ? "long" : "short",
    qty: Math.abs(position.signedQty),
    averagePrice: position.averagePrice,
  }));
}

function MarketPulse({
  compact = false,
  ticker,
  symbol,
  markPrice,
}: {
  compact?: boolean;
  ticker?: Ticker | null;
  symbol?: string;
  markPrice?: number;
}) {
  const items = [
    ["Spread", "-"],
    ["Mark", formatMarkPrice(markPrice, ticker ?? null, symbol ?? "BTC-USD")],
    ["24h", formatTickerChange(ticker ?? null)],
    ["Status", "Live"],
  ];

  return (
    <div className={compact ? "grid grid-cols-2 gap-px bg-exchange-800" : "grid max-w-xl grid-cols-4 gap-px bg-exchange-800"}>
      {items.map(([label, value]) => (
        <div key={label} className="bg-exchange-900 p-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-exchange-500">{label}</p>
          <p className="mt-2 font-mono text-xs font-semibold text-white">{value}</p>
        </div>
      ))}
    </div>
  );
}

function PanelState({ message }: { message: string }) {
  return <div className="grid min-h-36 place-items-center px-4 text-center text-sm text-exchange-500">{message}</div>;
}

function formatNumber(value: number | string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(numeric);
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function parsePositiveInt(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function clampPercentInput(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(parsed, 0), 100);
}

function percentToBps(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  return Math.round(value * 100);
}

function formatPercent(value: number) {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
}

function formatOrderError(error: unknown) {
  const message = error instanceof Error ? error.message : "Order failed";
  if (message.includes("no liquidity on asks")) return "No sell liquidity available. Place a sell limit order first, or wait for asks.";
  if (message.includes("no liquidity on bids")) return "No buy liquidity available. Place a buy limit order first, or wait for bids.";
  return message;
}

function isCancellableOrder(order: UserOrder) {
  return (
    order.orderType === "limit" &&
    (order.status === "open" || order.status === "partially_filled") &&
    order.qty - order.filledQty > 0
  );
}

function isTerminalCancelError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("doesn't exist") ||
    normalized.includes("not found") ||
    (normalized.includes("can't be cancelled") && (normalized.includes("filled") || normalized.includes("cancelled")))
  );
}

function sortMarkets(markets: Market[]) {
  return [...markets].sort((a, b) => {
    const aIndex = primaryMarketOrder.indexOf(a.symbol);
    const bIndex = primaryMarketOrder.indexOf(b.symbol);
    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
    }
    const aIsTest = a.symbol.startsWith("TEST-");
    const bIsTest = b.symbol.startsWith("TEST-");
    if (aIsTest !== bIsTest) return aIsTest ? 1 : -1;
    return a.symbol.localeCompare(b.symbol);
  });
}

function getMarketSymbol(marketId: string, markets: Market[]) {
  return markets.find((market) => market.id === marketId)?.symbol ?? marketId;
}

function splitMarketSymbol(symbol: string) {
  const [base = symbol, quote = "USD"] = symbol.split("-");
  return { base, quote };
}

function formatPerpSymbol(symbol: string) {
  const { base } = splitMarketSymbol(symbol);
  return `${base}-PERP`;
}

function formatPairSymbol(symbol: string) {
  const { base, quote } = splitMarketSymbol(symbol);
  return `${base}/${quote}`;
}

function formatMarkPrice(markPrice: number | undefined, _ticker: Ticker | null, _fallback: string) {
  if (typeof markPrice === "number") return formatNumber(markPrice / 1_000_000);
  return "-";
}

function getReferencePrice(markPrice: number | undefined, ticker: Ticker | null) {
  if (typeof markPrice === "number" && Number.isFinite(markPrice)) return markPrice / 1_000_000;
  const close = Number(ticker?.close);
  return Number.isFinite(close) && close > 0 ? close : null;
}

function formatTickerChange(ticker: Ticker | null) {
  if (!ticker) return "-";
  const pct = Number(ticker.changePct);
  if (!Number.isFinite(pct)) return `${ticker.changePct}%`;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function getTickerTone(ticker: Ticker | null): "positive" | "negative" | "neutral" {
  const pct = Number(ticker?.changePct);
  if (!Number.isFinite(pct)) return "neutral";
  return pct >= 0 ? "positive" : "negative";
}

function formatTickerVolume(ticker: Ticker | null) {
  if (!ticker) return "-";
  return formatNumber(ticker.volume);
}
