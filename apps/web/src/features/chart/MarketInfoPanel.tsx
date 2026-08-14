import { api } from "../../api/client";
import { useMarket } from "../../context/MarketContext";
import { useAsyncData } from "../../hooks/useAsyncData";
import { formatFundingRate, formatMarkPrice, getFundingTone } from "../../lib/markets";
import { formatNumber } from "../../lib/format";

function InfoItem({ label, value, valueClass = "text-text" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-surface p-3">
      <span className="text-[11px] text-text-dim">{label}</span>
      <span className={`text-[14px] font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}

export function MarketInfoPanel() {
  const { market, symbol, markPrice, indexPrice, fundingRate } = useMarket();
  const fundingInfo = useAsyncData(() => (symbol ? api.getFundingInfo(symbol) : Promise.resolve(null)), [symbol]);

  if (!market) {
    return <div className="flex h-full items-center justify-center text-[13px] text-text-dim">Loading market info...</div>;
  }

  const fundingTone = getFundingTone(fundingRate);
  const fundingClass = fundingTone === "negative" ? "text-red" : fundingTone === "positive" ? "text-green" : "text-text";

  return (
    <div className="grid grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3">
      <InfoItem label="Symbol" value={market.symbol} />
      <InfoItem label="Max Leverage" value={`${market.maxLeverage}x`} />
      <InfoItem label="Min Order Size" value={formatNumber(market.minQty)} />
      <InfoItem label="Mark Price" value={typeof markPrice === "number" ? `$${formatMarkPrice(markPrice)}` : "-"} />
      <InfoItem label="Index Price" value={typeof indexPrice === "number" ? `$${formatMarkPrice(indexPrice)}` : "-"} />
      <InfoItem label="Funding Rate" value={formatFundingRate(fundingRate)} valueClass={fundingClass} />
      <InfoItem label="Funding Interval" value={fundingInfo.data ? `${fundingInfo.data.intervalHours}h` : "-"} />
    </div>
  );
}
