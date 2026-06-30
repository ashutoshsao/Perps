import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import { fallbackMarkets } from "../app/constants";
import type { ChartInterval, MarketDataTab, OrderSide } from "../app/types";
import { navigate } from "../app/navigation";
import { BrandBar, DepthSyncBadge, HeaderActionButton, IntervalControl, LiveStatusBadge, Panel, PanelState, SegmentedTabs, StatusBanner, TickerStat } from "../components/ui";
import { CandlestickChart } from "../features/chart/CandlestickChart";
import { AccountPanel } from "../features/account/AccountPanel";
import { MarketPicker } from "../features/markets/MarketPicker";
import { OrderBook } from "../features/orderbook/OrderBook";
import { OrderTicket } from "../features/order-ticket/OrderTicket";
import { TradesTable } from "../features/trades/TradesTable";
import { useAsyncData } from "../hooks/useAsyncData";
import { useDepthSync } from "../hooks/useDepthSync";
import { useLiveAccountLists } from "../hooks/useLiveAccount";
import { useLiveCandles } from "../hooks/useLiveCandles";
import { useLiveTrades } from "../hooks/useLiveTrades";
import { useMarkPrice } from "../hooks/useMarkPrice";
import { formatLastPrice, formatMarkPrice, formatPerpSymbol, formatTickerChange, formatTickerVolume, getTickerTone, sortMarkets } from "../lib/markets";

export function ExchangeShell({ token, onSignOut }: { token: string | null; onSignOut: () => void }) {
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
  const ordersState = useAsyncData(
    () => token ? api.getOrders(token).then((data) => data.orders) : Promise.resolve([]),
    [token, accountVersion]
  );
  const fillsState = useAsyncData(
    () => token ? api.getFills(token).then((data) => data.fills) : Promise.resolve([]),
    [token, accountVersion]
  );
  const liveAccount = useLiveAccountLists(token, ordersState.data ?? [], fillsState.data ?? []);
  const currentMarket = useMemo(() => visibleMarkets.find((market) => market.symbol === selectedMarket) ?? null, [visibleMarkets, selectedMarket]);
  const bestAsk = depthSync.depth?.asks[0]?.[0] ?? null;
  const bestBid = depthSync.depth?.bids[0]?.[0] ?? null;
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

          <div className="grid flex-1 grid-cols-2 gap-px bg-exchange-800 lg:grid-cols-[220px_repeat(4,minmax(110px,1fr))_280px]">
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
            <TickerStat label="Last" value={formatLastPrice(tickerState.data)} tone="accent" />
            <TickerStat label="24h Change" value={formatTickerChange(tickerState.data)} tone={getTickerTone(tickerState.data)} />
            <TickerStat label="Volume" value={formatTickerVolume(tickerState.data)} tone="neutral" />
            <div className="flex h-14 items-center justify-end gap-2 bg-exchange-900 px-3 lg:h-16">
              <HeaderActionButton onClick={() => token ? navigate("admin") : navigate("signin")}>
                Admin
              </HeaderActionButton>
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
                    className="h-7 rounded-md border border-exchange-700 px-2.5 text-[11px] font-medium text-exchange-300 hover:border-cyan-300 hover:text-cyan-200"
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
                  isLoading={balanceState.isLoading || ordersState.isLoading || fillsState.isLoading}
                  onOrderSettled={refreshTradingData}
                />
              </Panel>
            </div>
          </div>

          <div className="min-h-0 bg-exchange-800">
            <Panel
              title={marketDataTab === "book" ? "Order book" : "Recent trades"}
              className="h-full"
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
              {marketDataTab === "book" ? (
                <OrderBook depth={depthSync.depth} isLoading={depthSync.status === "idle" || depthSync.status === "connecting" || depthSync.status === "snapshot"} error={depthSync.error} />
              ) : (
                <TradesTable trades={liveTrades.trades} isLoading={tradesState.isLoading} error={tradesState.error} />
              )}
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
                  bestBid={bestBid}
                  bestAsk={bestAsk}
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
