import { useEffect, useRef, useState } from "react";
import type { Market } from "../../api/types";
import { formatPairSymbol, formatPerpSymbol, getMarketSearchAliases } from "../../lib/markets";

export function MarketPicker({
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
        const aliases = getMarketSearchAliases(market.symbol);
        return market.symbol.toLowerCase().includes(normalizedQuery)
          || aliases.some((alias) => alias.includes(normalizedQuery));
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
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-white">{selectedMarket ? formatPerpSymbol(selectedMarket.symbol) : "Loading"}</span>
            {selectedMarket ? (
              <span className="rounded border border-cyan-300/30 bg-cyan-300/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-cyan-200">
                {selectedMarket.maxLeverage}x
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-exchange-500">
            {selectedMarket ? formatPairSymbol(selectedMarket.symbol) : "Markets"}
          </p>
        </div>
        <span className="shrink-0 text-exchange-500">▾</span>
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-full z-30 mt-px w-[320px] rounded-md border border-exchange-700 bg-exchange-950 shadow-2xl shadow-black/50">
          <div className="border-b border-exchange-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-exchange-500">
            Perpetual markets
          </div>
          <div className="border-b border-exchange-800 p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search BTC"
              className="h-9 w-full rounded-md border border-exchange-800 bg-exchange-900 px-3 font-mono text-xs text-white outline-none placeholder:text-exchange-600 focus:border-cyan-300"
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
                className={`grid w-full grid-cols-[1fr_auto] gap-3 rounded border-l-2 px-3 py-2 text-left hover:bg-exchange-800 ${
                  market.symbol === selectedSymbol ? "bg-cyan-300/10" : ""
                } ${market.symbol === selectedSymbol ? "border-cyan-300" : "border-transparent"}`}
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
