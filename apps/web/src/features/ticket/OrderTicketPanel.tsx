import { useEffect, useState } from "react";
import { ChevronDownIcon } from "../../icons";
import { TextTabs } from "../../components/ui/Tabs";
import { useAuth } from "../../context/AuthContext";
import { useMarket } from "../../context/MarketContext";
import { useOrders } from "../../context/OrdersContext";
import { useTicket } from "../../context/TicketContext";
import { useTrading } from "../../context/TradingContext";
import { useToast } from "../../context/ToastContext";
import {
  formatNumber,
  formatOrderError,
  formatPercent,
  formatUsd,
  parsePositiveInt,
  parseUsdToCents,
  percentToBps,
  usd,
} from "../../lib/format";
import { getReferencePrice } from "../../lib/markets";
import { slippagePresetPercents } from "../../lib/constants";

function CurrencyField({
  label,
  value,
  onChange,
  badge,
  badgeBg,
  extra,
  readOnly,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  badge: string;
  badgeBg: string;
  extra?: React.ReactNode;
  readOnly?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-text-muted">{label}</span>
        {extra}
      </div>
      <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2.5">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
          placeholder={placeholder}
          inputMode="decimal"
          className="w-full bg-transparent text-[15px] font-medium text-text outline-none placeholder:text-text-dim"
        />
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-black"
          style={{ background: badgeBg }}
        >
          {badge}
        </span>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-text-muted">{label}</span>
      <span className="text-text-dim">{value}</span>
    </div>
  );
}

function DisabledCheckbox({ label }: { label: string }) {
  return (
    <label
      title="Not supported yet"
      className="flex cursor-not-allowed items-center gap-1.5 text-[12px] text-text-dim opacity-50"
    >
      <input type="checkbox" className="bp-checkbox" checked={false} disabled readOnly />
      {label}
    </label>
  );
}

export function OrderTicketPanel({ variant = "desktop" }: { variant?: "desktop" | "mobile" } = {}) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"Limit" | "Market">("Limit");
  const [leverage, setLeverage] = useState(1);
  const [slippagePercent, setSlippagePercent] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { token, openAuthModal } = useAuth();
  const { market, ticker, markPrice } = useMarket();
  const { bestBid, bestAsk } = useTrading();
  const { placeOrder, balance } = useOrders();
  const { push } = useToast();
  const { price, qty, setPrice, setQty } = useTicket();

  useEffect(() => {
    if (!market) return;
    setQty(String(market.minQty));
    setPrice("");
    setLeverage(1);
    setSlippagePercent(1);
    setError(null);
    setSuccess(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market?.symbol]);

  const isMobile = variant === "mobile";

  if (!market) {
    const loadingClass = isMobile
      ? "flex w-full items-center justify-center bg-panel p-4 text-[13px] text-text-dim"
      : "flex w-[336px] shrink-0 items-center justify-center border-l border-border-soft bg-panel p-4 text-[13px] text-text-dim";
    return <div className={loadingClass}>Loading markets...</div>;
  }
  const activeMarket = market;

  const parsedQty = Number(qty);
  const parsedLimitPrice = Number(price);
  const pricePlaceholderValue = getReferencePrice(markPrice, ticker);
  const pricePlaceholder = pricePlaceholderValue ? formatNumber(pricePlaceholderValue) : "Price";
  const lastPrice = ticker ? usd(ticker.close) : NaN;
  const markPriceValue = typeof markPrice === "number" ? usd(markPrice) : null;
  const referencePrice = orderType === "Limit" && Number.isFinite(parsedLimitPrice) && parsedLimitPrice > 0
    ? parsedLimitPrice
    : pricePlaceholderValue;
  const estimatedNotional = Number.isFinite(parsedQty) && parsedQty > 0 && referencePrice ? parsedQty * referencePrice : null;
  const estimatedMargin = estimatedNotional ? estimatedNotional / leverage : null;
  const hasEnoughBalance = estimatedMargin === null || !balance || usd(balance.available) >= estimatedMargin;
  const baseSymbol = market.symbol.split("-")[0] ?? market.symbol;
  const badge = baseSymbol.slice(0, 1);

  async function handleSubmit() {
    setError(null);
    setSuccess(null);

    if (!token) {
      openAuthModal("login");
      return;
    }

    const parsedQtyInt = parsePositiveInt(qty);
    const parsedPriceCents = parseUsdToCents(price);
    const parsedSlippage = percentToBps(slippagePercent);

    if (!parsedQtyInt || parsedQtyInt < activeMarket.minQty) {
      setError(`Quantity must be at least ${activeMarket.minQty}.`);
      return;
    }
    if (leverage < 1 || leverage > activeMarket.maxLeverage) {
      setError(`Leverage must be between 1 and ${activeMarket.maxLeverage}.`);
      return;
    }
    if (orderType === "Limit" && !parsedPriceCents) {
      setError("Limit orders need a positive price.");
      return;
    }
    if (orderType === "Market" && parsedSlippage === null) {
      setError("Choose a slippage between 0% and 100%.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await placeOrder(
        orderType === "Limit"
          ? { orderType: "limit", side, symbol: activeMarket.symbol, price: parsedPriceCents!, qty: parsedQtyInt, leverage }
          : { orderType: "market", side, symbol: activeMarket.symbol, qty: parsedQtyInt, leverage, slippageBps: parsedSlippage! },
      );
      setSuccess(`Order ${response.order.status.replace("_", " ")}.`);
      push(`${side === "buy" ? "Buy" : "Sell"} order ${response.order.status.replace("_", " ")} for ${parsedQtyInt} ${baseSymbol}`, "success");
      setQty(String(activeMarket.minQty));
    } catch (err) {
      const message = formatOrderError(err);
      setError(message);
      push(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const rootClass = isMobile
    ? "flex w-full flex-col gap-4 bg-panel p-4"
    : "flex w-[336px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-border-soft bg-panel p-4";

  return (
    <div className={rootClass}>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSide("buy")}
          className={`rounded-lg py-2.5 text-[14px] font-semibold transition-colors ${
            side === "buy" ? "bg-green text-black" : "bg-surface text-text-muted"
          }`}
        >
          Buy / Long
        </button>
        <button
          type="button"
          onClick={() => setSide("sell")}
          className={`rounded-lg py-2.5 text-[14px] font-semibold transition-colors ${
            side === "sell" ? "bg-red text-white" : "bg-surface text-text-muted"
          }`}
        >
          Sell / Short
        </button>
      </div>

      <div className="flex items-center justify-between border-b border-border-soft pb-3">
        <TextTabs items={["Limit", "Market"]} active={orderType} onChange={(v) => setOrderType(v as "Limit" | "Market")} />
        <button
          type="button"
          disabled
          title="Not supported yet"
          className="flex cursor-not-allowed items-center gap-1 text-[13px] font-medium text-text-dim opacity-50"
        >
          Conditional
          <ChevronDownIcon size={13} />
        </button>
      </div>

      <div className="flex items-center justify-between text-[12px]">
        <span className="text-text-muted">Available Equity</span>
        <span className="text-text">{balance ? `$${formatUsd(balance.available)}` : token ? "..." : "$0.00"}</span>
      </div>

      {orderType === "Limit" ? (
        <CurrencyField
          label="Price"
          value={price}
          onChange={setPrice}
          placeholder={pricePlaceholder}
          badge="$"
          badgeBg="#00c896"
          extra={
            <div className="flex items-center gap-2 text-[12px] font-medium">
              <button type="button" onClick={() => bestBid && setPrice(String(usd(bestBid)))} disabled={!bestBid} className="text-blue hover:opacity-80 disabled:opacity-40">
                Bid
              </button>
              <button type="button" onClick={() => bestAsk && setPrice(String(usd(bestAsk)))} disabled={!bestAsk} className="text-blue hover:opacity-80 disabled:opacity-40">
                Ask
              </button>
              <button type="button" onClick={() => Number.isFinite(lastPrice) && setPrice(String(lastPrice))} className="text-blue hover:opacity-80">
                Last
              </button>
              <button type="button" onClick={() => markPriceValue && setPrice(String(markPriceValue))} disabled={!markPriceValue} className="text-blue hover:opacity-80 disabled:opacity-40">
                Mark
              </button>
            </div>
          }
        />
      ) : (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] text-text-muted">Max slippage</span>
            <span className="text-[13px] font-semibold text-text">{formatPercent(slippagePercent)}</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {slippagePresetPercents.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setSlippagePercent(preset)}
                className={`h-8 rounded-full text-[11px] font-medium transition-colors ${
                  slippagePercent === preset ? "bg-text text-bg" : "bg-surface text-text-muted hover:text-text"
                }`}
              >
                {formatPercent(preset)}
              </button>
            ))}
          </div>
        </div>
      )}

      <CurrencyField label="Quantity" value={qty} onChange={setQty} badge={badge} badgeBg="#f0b90b" />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] text-text-muted">Leverage</span>
          <span className="text-[13px] font-semibold text-text">{leverage}x</span>
        </div>
        <input
          type="range"
          min={1}
          max={market.maxLeverage}
          step={1}
          value={leverage}
          onChange={(e) => setLeverage(Number(e.target.value))}
          className="bp-slider"
          style={{ ["--slider-fill" as string]: `${((leverage - 1) / (market.maxLeverage - 1 || 1)) * 100}%` }}
        />
        <div className="mt-1 flex justify-between text-[11px] text-text-dim">
          <span>1x</span>
          <span>{market.maxLeverage}x</span>
        </div>
      </div>

      <CurrencyField
        label="Order Value"
        value={estimatedNotional === null ? "0" : formatNumber(estimatedNotional)}
        onChange={() => {}}
        badge="$"
        badgeBg="#00c896"
        readOnly
      />

      <div className="flex flex-col gap-2">
        <InfoRow label="Margin Required" value={estimatedMargin === null ? "—" : `$${formatNumber(estimatedMargin)}`} />
        <InfoRow label="Est. Liquidation Price" value="Unavailable" />
      </div>

      {!hasEnoughBalance ? (
        <div className="rounded-lg bg-amber/10 px-3 py-2 text-[12px] text-amber">Available balance is below estimated margin.</div>
      ) : null}
      {error ? <div className="rounded-lg bg-red/10 px-3 py-2 text-[12px] text-red">{error}</div> : null}
      {success ? <div className="rounded-lg bg-green/10 px-3 py-2 text-[12px] text-green">{success}</div> : null}

      <div className="flex flex-col gap-2">
        {token ? (
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || !hasEnoughBalance}
            className={`w-full rounded-lg py-3 text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              side === "buy" ? "bg-green text-black hover:bg-green/90" : "bg-red text-white hover:bg-red/90"
            }`}
          >
            {isSubmitting ? "Submitting..." : `${side === "buy" ? "Buy / Long" : "Sell / Short"} ${baseSymbol}`}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => openAuthModal("signup")}
              className="w-full rounded-lg bg-text py-3 text-[14px] font-semibold text-bg hover:bg-text/90"
            >
              Sign up to trade
            </button>
            <button
              type="button"
              onClick={() => openAuthModal("login")}
              className="w-full rounded-lg border border-border py-3 text-[14px] font-semibold text-text hover:bg-surface"
            >
              Log in to trade
            </button>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-4">
          <DisabledCheckbox label="Post Only" />
          <DisabledCheckbox label="IOC" />
          <DisabledCheckbox label="Reduce Only" />
        </div>
        <DisabledCheckbox label="TP/SL" />
      </div>
    </div>
  );
}
