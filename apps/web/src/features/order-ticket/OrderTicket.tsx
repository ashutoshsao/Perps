import { FormEvent, useEffect, useState } from "react";
import { api } from "../../api/client";
import type { Balance, Market, Ticker } from "../../api/types";
import type { OrderSide, OrderType } from "../../app/types";
import { slippagePresetPercents } from "../../app/constants";
import { Metric } from "../../components/ui";
import { clampPercentInput, formatNumber, formatOrderError, formatPercent, parsePositiveInt, percentToBps } from "../../lib/format";
import { getReferencePrice } from "../../lib/markets";

export function OrderTicket({
  token,
  market,
  side,
  balance,
  ticker,
  markPrice,
  bestBid,
  bestAsk,
  onSideChange,
  onOrderSettled,
}: {
  token: string | null;
  market: Market;
  side: OrderSide;
  balance: Balance | null;
  ticker: Ticker | null;
  markPrice?: number;
  bestBid: number | null;
  bestAsk: number | null;
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
  const pricePlaceholderValue = getReferencePrice(markPrice, ticker);
  const pricePlaceholder = pricePlaceholderValue ? formatNumber(pricePlaceholderValue) : "Price";
  const lastPrice = Number(ticker?.close);
  const markPriceValue = typeof markPrice === "number" ? markPrice / 1_000_000 : null;
  const referencePrice = orderType === "limit" && Number.isFinite(parsedLimitPrice) && parsedLimitPrice > 0
    ? parsedLimitPrice
    : pricePlaceholderValue;
  const estimatedNotional = Number.isFinite(parsedQty) && parsedQty > 0 && referencePrice
    ? parsedQty * referencePrice
    : null;
  const estimatedMargin = estimatedNotional
    ? estimatedNotional / leverage
    : null;
  const hasEnoughBalance = estimatedMargin === null || !balance || balance.available >= estimatedMargin;
  const sideLabel = side === "buy" ? "Buy / Long" : "Sell / Short";
  const baseSymbol = market.symbol.split("-")[0];

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
      <div className="grid grid-cols-2 gap-1 rounded-md border border-exchange-800 bg-exchange-950 p-1">
        <SideButton isActive={side === "buy"} side="buy" onClick={() => onSideChange("buy")} />
        <SideButton isActive={side === "sell"} side="sell" onClick={() => onSideChange("sell")} />
      </div>
      <OrderTypeControl value={orderType} onChange={setOrderType} />
      <div className="flex items-center justify-between rounded-md border border-exchange-800 bg-exchange-950 px-3 py-2">
        <span className="text-xs text-exchange-400">Available equity</span>
        <span className="font-mono text-sm font-semibold text-white">
          {balance ? `$${formatNumber(balance.available)}` : token ? "..." : "-"}
        </span>
      </div>
      {orderType === "limit" ? (
        <PriceInput
          value={price}
          onChange={setPrice}
          placeholder={pricePlaceholder}
          quickPrices={[
            { label: "Bid", value: bestBid },
            { label: "Ask", value: bestAsk },
            { label: "Last", value: Number.isFinite(lastPrice) ? lastPrice : null },
            { label: "Mark", value: markPriceValue },
          ]}
        />
      ) : (
        <SlippageControl value={slippagePercent} onChange={setSlippagePercent} />
      )}
      <TicketInput label="Quantity" value={qty} onChange={setQty} placeholder={String(market.minQty)} />
      <LeverageControl value={leverage} max={market.maxLeverage} onChange={setLeverage} />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-exchange-800 bg-exchange-800">
        <Metric label="Order value" value={estimatedNotional === null ? "-" : `$${formatNumber(estimatedNotional)}`} />
        <Metric label="Margin req." value={estimatedMargin === null ? "-" : `$${formatNumber(estimatedMargin)}`} />
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-exchange-800 bg-exchange-800">
        <Metric label="Est. price" value={referencePrice ? formatNumber(referencePrice) : "-"} />
        <Metric label="Leverage" value={`${leverage}x`} />
      </div>
      {!hasEnoughBalance ? <div className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">Available balance is below estimated margin.</div> : null}
      {error ? <div className="rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</div> : null}
      {success ? <div className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">{success}</div> : null}
      <button type="submit" disabled={isSubmitting || !hasEnoughBalance} className={`h-11 w-full rounded-md text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${sideClasses}`}>
        {isSubmitting ? "Submitting..." : `${sideLabel} ${baseSymbol}`}
      </button>
    </form>
  );
}

function SideButton({
  isActive,
  side,
  onClick,
}: {
  isActive: boolean;
  side: OrderSide;
  onClick: () => void;
}) {
  const isBuy = side === "buy";
  const activeClass = isBuy ? "bg-emerald-400 text-exchange-950" : "bg-rose-400 text-white";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 rounded text-sm font-semibold transition-colors ${
        isActive ? activeClass : "bg-exchange-800 text-exchange-400 hover:bg-exchange-700 hover:text-white"
      }`}
    >
      {isBuy ? "Buy / Long" : "Sell / Short"}
    </button>
  );
}

function PriceInput({
  value,
  onChange,
  placeholder,
  quickPrices,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  quickPrices: Array<{ label: string; value: number | null }>;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-exchange-500">Price</span>
        <div className="flex items-center gap-2">
          {quickPrices.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.value === null}
              onClick={() => item.value !== null && onChange(String(Math.round(item.value)))}
              className="rounded px-1 font-mono text-[10px] text-cyan-300 hover:bg-exchange-800 hover:text-white disabled:cursor-not-allowed disabled:bg-transparent disabled:text-exchange-700"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <input
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md border border-exchange-800 bg-exchange-950 px-3 font-mono text-sm text-white outline-none placeholder:text-exchange-600 focus:border-cyan-300"
      />
    </label>
  );
}

function OrderTypeControl({
  value,
  onChange,
}: {
  value: OrderType;
  onChange: (value: OrderType) => void;
}) {
  const options: Array<{ id: OrderType; label: string }> = [
    { id: "limit", label: "Limit" },
    { id: "market", label: "Market" },
  ];

  return (
    <div>
      <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-exchange-500">Type</span>
      <div className="grid grid-cols-2 gap-1 rounded-md border border-exchange-800 bg-exchange-950 p-1">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`h-8 rounded text-xs font-semibold ${
              value === option.id
                ? "bg-cyan-300 text-exchange-950"
                : "text-exchange-400 hover:bg-exchange-800 hover:text-exchange-100"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
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
        className="h-11 w-full rounded-md border border-exchange-800 bg-exchange-950 px-3 font-mono text-sm text-white outline-none focus:border-cyan-300"
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
    <div className="rounded-md border border-exchange-800 p-2.5">
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
    <div className="rounded-md border border-exchange-800 p-2.5">
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
            className={`h-8 rounded font-mono text-[11px] ${
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
          className="h-11 w-full rounded-md border border-exchange-800 bg-exchange-950 px-3 font-mono text-sm text-white outline-none focus:border-cyan-300"
        />
      </label>
    </div>
  );
}
