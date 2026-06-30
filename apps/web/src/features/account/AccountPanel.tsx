import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import type { Balance, Market, UserFill, UserOrder } from "../../api/types";
import type { AccountTab } from "../../app/types";
import { formatAccountId, formatNumber, formatTime, isCancellableOrder, isTerminalCancelError } from "../../lib/format";
import { getMarketSymbol } from "../../lib/markets";
import { derivePositions } from "./positions";

export function AccountPanel({
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
        <div className="rounded-md border border-exchange-800 px-3 py-8 text-center text-sm text-exchange-400">
          Sign in to view balances, orders, and fills.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <div className="flex shrink-0 items-center justify-between gap-3 rounded-md border border-exchange-800 px-3 py-2">
        <div>
          <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-exchange-500">Signed in as</p>
          <p className="mt-1 font-mono text-xs text-exchange-200">{formatAccountId(userId)}</p>
        </div>
        <div className="text-right font-mono text-[10px] text-exchange-500">
          <p>{fills.length} fills</p>
          <p>{positions.length} positions</p>
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-md border border-exchange-800 bg-exchange-800">
        <MiniMetric label="Available" value={isLoading ? "..." : `$${formatNumber(balance?.available ?? 0)}`} />
        <MiniMetric label="Locked" value={isLoading ? "..." : `$${formatNumber(balance?.locked ?? 0)}`} />
      </div>
      {error ? <div className="shrink-0 rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</div> : null}
      <div className="flex shrink-0 gap-1 overflow-x-auto rounded-md bg-exchange-950/40 p-0.5">
        {accountTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`h-8 shrink-0 rounded px-3 text-xs font-medium ${
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
                  className="rounded border border-exchange-700 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-exchange-300 hover:border-rose-300 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
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
