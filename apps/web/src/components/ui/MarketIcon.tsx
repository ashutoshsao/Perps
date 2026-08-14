import { useState } from "react";

export function MarketIcon({
  symbol,
  imageUrl,
  size = 20,
}: {
  symbol: string;
  imageUrl?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (!imageUrl || failed) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-surface-2 text-[10px] font-bold text-text-muted"
        style={{ width: size, height: size }}
      >
        {symbol.slice(0, 1)}
      </span>
    );
  }

  return (
    <img
      src={imageUrl}
      alt=""
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}
