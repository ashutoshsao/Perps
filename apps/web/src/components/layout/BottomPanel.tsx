import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "../../icons";
import { bottomTabs } from "../../data/mockMarket";
import { useOrders } from "../../context/OrdersContext";
import { useMarket } from "../../context/MarketContext";
import { useAuth } from "../../context/AuthContext";
import { formatNumber, formatTime } from "../../lib/format";
import { getMarketSymbol } from "../../lib/markets";

const UNSUPPORTED_TABS = new Set(["Borrows", "TWAP", "Position His"]);

export function BottomPanel() {
  const [tab, setTab] = useState("Positions");
  const [currentMarket, setCurrentMarket] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const { token } = useAuth();
  const { markets, symbol, markPrice } = useMarket();
  const { balance, balanceLoading, openOrders, orderHistory, fills, positions, cancelOrder } = useOrders();

  const filterBySymbol = <T extends { marketId?: string; symbol?: string }>(rows: T[]) =>
    rows.filter((row) => {
      if (!currentMarket) return true;
      const rowSymbol = row.symbol ?? (row.marketId ? getMarketSymbol(row.marketId, markets) : undefined);
      return rowSymbol === symbol;
    });

  const filteredOpenOrders = filterBySymbol(openOrders);
  const filteredHistory = filterBySymbol(orderHistory);
  const filteredFills = filterBySymbol(fills);
  const filteredPositions = filterBySymbol(positions);

  async function handleCancel(orderId: string) {
    setCancelError(null);
    setCancelingId(orderId);
    try {
      await cancelOrder(orderId);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setCancelingId(null);
    }
  }

  return (
    <div className="flex h-[236px] shrink-0 flex-col border-t border-border-soft bg-panel">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border-soft px-4">
        <div className="flex items-center gap-1">
          {bottomTabs.map((t) => {
            const isActive = t === tab;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                  isActive ? "bg-surface text-text" : "text-text-muted hover:text-text"
                }`}
              >
                {t}
                {t === "Open Orders" && filteredOpenOrders.length > 0 && (
                  <span className="ml-1.5 text-text-dim">{filteredOpenOrders.length}</span>
                )}
                {t === "Positions" && filteredPositions.length > 0 && (
                  <span className="ml-1.5 text-text-dim">{filteredPositions.length}</span>
                )}
              </button>
            );
          })}
          <ChevronRightIcon size={14} className="ml-1 text-text-muted" />
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-md bg-surface px-2.5 py-1.5 text-[12px] font-medium text-text"
            >
              All
              <ChevronDownIcon size={12} className="text-text-muted" />
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-8 z-20 w-28 rounded-lg border border-border bg-panel-2 p-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => setFilterOpen(false)}
                  className="block w-full rounded-md px-2.5 py-1.5 text-left text-[12px] text-text-muted hover:bg-surface hover:text-text"
                >
                  All markets
                </button>
              </div>
            )}
          </div>
          <label className="flex items-center gap-1.5 text-[12px] text-text-muted">
            <input
              type="checkbox"
              className="bp-checkbox"
              checked={currentMarket}
              onChange={(e) => setCurrentMarket(e.target.checked)}
            />
            Current Market
          </label>
        </div>
      </div>

      {!token ? (
        <div className="flex flex-1 items-center justify-center text-[13px] text-text-dim">
          Log in to view balances, orders, and fills.
        </div>
      ) : UNSUPPORTED_TABS.has(tab) ? (
        <div className="flex flex-1 items-center justify-center text-[13px] text-text-dim">No records</div>
      ) : (
        <div className="flex flex-1 flex-col overflow-y-auto">
          {cancelError && <div className="px-4 py-1.5 text-[12px] text-red">{cancelError}</div>}

          {tab === "Balances" ? (
            <div className="grid grid-cols-2 gap-3 p-4">
              <div className="rounded-lg bg-surface p-3">
                <p className="text-[11px] text-text-dim">Available</p>
                <p className="mt-1 text-[16px] font-semibold text-text">
                  {balanceLoading ? "..." : `$${formatNumber(balance?.available ?? 0)}`}
                </p>
              </div>
              <div className="rounded-lg bg-surface p-3">
                <p className="text-[11px] text-text-dim">Locked</p>
                <p className="mt-1 text-[16px] font-semibold text-text">
                  {balanceLoading ? "..." : `$${formatNumber(balance?.locked ?? 0)}`}
                </p>
              </div>
            </div>
          ) : tab === "Positions" ? (
            filteredPositions.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-[13px] text-text-dim">No positions</div>
            ) : (
              <>
                <div className="grid grid-cols-6 gap-2 border-b border-border-soft px-4 py-1.5 text-[11px] font-medium text-text-dim">
                  <span>Market</span>
                  <span>Side</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Entry</span>
                  <span className="text-right">PnL</span>
                  <span className="text-right">ROE</span>
                </div>
                {filteredPositions.map((position) => {
                  const mark = position.symbol === symbol && typeof markPrice === "number" ? markPrice / 1_000_000 : null;
                  const notional = position.averagePrice * position.qty;
                  const pnl =
                    mark === null
                      ? null
                      : position.side === "long"
                        ? (mark - position.averagePrice) * position.qty
                        : (position.averagePrice - mark) * position.qty;
                  const roe = pnl === null || notional === 0 ? null : (pnl / notional) * 100;

                  return (
                    <div key={position.symbol} className="grid grid-cols-6 items-center gap-2 px-4 py-1.5 text-[12px]">
                      <span className="text-text">{position.symbol}</span>
                      <span className={position.side === "long" ? "text-green" : "text-red"}>{position.side}</span>
                      <span className="text-right text-text">{formatNumber(position.qty)}</span>
                      <span className="text-right text-text">{formatNumber(position.averagePrice)}</span>
                      <span className={`text-right ${pnl === null ? "text-text-dim" : pnl >= 0 ? "text-green" : "text-red"}`}>
                        {pnl === null ? "-" : `${pnl >= 0 ? "+" : ""}$${formatNumber(pnl)}`}
                      </span>
                      <span className={`text-right ${roe === null ? "text-text-dim" : roe >= 0 ? "text-green" : "text-red"}`}>
                        {roe === null ? "-" : `${roe >= 0 ? "+" : ""}${roe.toFixed(2)}%`}
                      </span>
                    </div>
                  );
                })}
              </>
            )
          ) : tab === "Open Orders" ? (
            filteredOpenOrders.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-[13px] text-text-dim">No open orders</div>
            ) : (
              <>
                <div className="grid grid-cols-6 gap-2 border-b border-border-soft px-4 py-1.5 text-[11px] font-medium text-text-dim">
                  <span>Market</span>
                  <span>Side</span>
                  <span className="text-right">Price</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Filled</span>
                  <span className="text-right"></span>
                </div>
                {filteredOpenOrders.map((order) => (
                  <div key={order.id} className="grid grid-cols-6 items-center gap-2 px-4 py-1.5 text-[12px]">
                    <span className="text-text">{getMarketSymbol(order.marketId, markets)}</span>
                    <span className={order.side === "buy" ? "text-green" : "text-red"}>{order.side === "buy" ? "Buy" : "Sell"}</span>
                    <span className="text-right text-text">{formatNumber(order.price)}</span>
                    <span className="text-right text-text">{formatNumber(order.qty)}</span>
                    <span className="text-right text-text-muted">{formatNumber(order.filledQty)}</span>
                    <span className="text-right">
                      <button
                        type="button"
                        disabled={cancelingId === order.id}
                        onClick={() => void handleCancel(order.id)}
                        className="text-red hover:opacity-80 disabled:opacity-50"
                      >
                        {cancelingId === order.id ? "..." : "Cancel"}
                      </button>
                    </span>
                  </div>
                ))}
              </>
            )
          ) : tab === "Order History" ? (
            filteredHistory.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-[13px] text-text-dim">No order history</div>
            ) : (
              <>
                <div className="grid grid-cols-5 gap-2 border-b border-border-soft px-4 py-1.5 text-[11px] font-medium text-text-dim">
                  <span>Market</span>
                  <span>Side</span>
                  <span className="text-right">Price</span>
                  <span className="text-right">Filled/Qty</span>
                  <span className="text-right">Status</span>
                </div>
                {filteredHistory.map((order) => (
                  <div key={order.id} className="grid grid-cols-5 gap-2 px-4 py-1.5 text-[12px]">
                    <span className="text-text">{getMarketSymbol(order.marketId, markets)}</span>
                    <span className={order.side === "buy" ? "text-green" : "text-red"}>{order.side === "buy" ? "Buy" : "Sell"}</span>
                    <span className="text-right text-text">{formatNumber(order.price)}</span>
                    <span className="text-right text-text-muted">
                      {formatNumber(order.filledQty)}/{formatNumber(order.qty)}
                    </span>
                    <span className="text-right text-text-muted">{order.status.replace("_", " ")}</span>
                  </div>
                ))}
              </>
            )
          ) : tab === "Fill History" ? (
            filteredFills.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-[13px] text-text-dim">No fills</div>
            ) : (
              <>
                <div className="grid grid-cols-5 gap-2 border-b border-border-soft px-4 py-1.5 text-[11px] font-medium text-text-dim">
                  <span>Market</span>
                  <span>Side</span>
                  <span className="text-right">Price</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Time</span>
                </div>
                {filteredFills.map((fill) => (
                  <div key={fill.id} className="grid grid-cols-5 gap-2 px-4 py-1.5 text-[12px]">
                    <span className="text-text">{fill.symbol}</span>
                    <span className={fill.side === "buy" ? "text-green" : "text-red"}>{fill.side === "buy" ? "Buy" : "Sell"}</span>
                    <span className="text-right text-text">{formatNumber(fill.price)}</span>
                    <span className="text-right text-text">{formatNumber(fill.qty)}</span>
                    <span className="text-right text-text-muted">{formatTime(fill.createdAt)}</span>
                  </div>
                ))}
              </>
            )
          ) : (
            <div className="flex flex-1 items-center justify-center text-[13px] text-text-dim">No records</div>
          )}
        </div>
      )}
    </div>
  );
}
