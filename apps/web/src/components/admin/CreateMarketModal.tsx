import { useState } from "react";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useMarket } from "../../context/MarketContext";
import { useToast } from "../../context/ToastContext";
import { NebulaLogo } from "../../icons";

function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function CreateMarketModal({ onClose }: { onClose: () => void }) {
  const { token } = useAuth();
  const { refreshMarkets } = useMarket();
  const { push } = useToast();

  const [symbol, setSymbol] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [maxLeverage, setMaxLeverage] = useState("20");
  const [minQty, setMinQty] = useState("1");
  const [adminToken, setAdminToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Log in first.");
      return;
    }
    if (!symbol.trim() || !imageUrl.trim() || !adminToken.trim()) {
      setError("All fields are required.");
      return;
    }
    const parsedMaxLeverage = Number(maxLeverage);
    const parsedMinQty = Number(minQty);
    if (!Number.isFinite(parsedMaxLeverage) || parsedMaxLeverage < 1) {
      setError("Max leverage must be at least 1.");
      return;
    }
    if (!Number.isFinite(parsedMinQty) || parsedMinQty < 1) {
      setError("Min qty must be at least 1.");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createMarket(token, adminToken, {
        symbol: symbol.trim().toUpperCase(),
        imageUrl: imageUrl.trim(),
        maxLeverage: parsedMaxLeverage,
        minQty: parsedMinQty,
      });
      push(`Market ${symbol.trim().toUpperCase()} created`, "success");
      refreshMarkets();
      onClose();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to create market";
      setError(message);
      push(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[380px] rounded-2xl border border-border bg-panel p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NebulaLogo size={24} />
            <span className="text-[16px] font-bold text-text">Create Market</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-surface hover:text-text"
          >
            <CloseIcon />
          </button>
        </div>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-text-muted">Symbol</span>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="ETH-PERP"
              autoFocus
              className="rounded-lg bg-surface px-3 py-2.5 text-[14px] text-text placeholder:text-text-dim"
            />
            <span className="text-[11px] leading-relaxed text-text-dim">
              Format <code className="rounded bg-surface px-1 py-0.5 text-text-muted">BASE-QUOTE</code>, not
              case-sensitive. <span className="text-text-muted">BASE</span> must be a real Binance ticker (BTC,
              ETH, SOL) — it drives the live price feed.{" "}
              <span className="text-text-muted">QUOTE</span> (PERP, USD) is label-only.
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-text-muted">Image URL</span>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="rounded-lg bg-surface px-3 py-2.5 text-[14px] text-text placeholder:text-text-dim"
            />
          </label>

          <div className="flex gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-[12px] text-text-muted">Max Leverage</span>
              <input
                value={maxLeverage}
                onChange={(e) => setMaxLeverage(e.target.value)}
                inputMode="numeric"
                className="w-full min-w-0 rounded-lg bg-surface px-3 py-2.5 text-[14px] text-text placeholder:text-text-dim"
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-[12px] text-text-muted">Min Qty</span>
              <input
                value={minQty}
                onChange={(e) => setMinQty(e.target.value)}
                inputMode="numeric"
                className="w-full min-w-0 rounded-lg bg-surface px-3 py-2.5 text-[14px] text-text placeholder:text-text-dim"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-text-muted">Admin Token</span>
            <input
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              type="password"
              placeholder="Admin secret"
              className="rounded-lg bg-surface px-3 py-2.5 text-[14px] text-text placeholder:text-text-dim"
            />
          </label>

          {error && <span className="text-[12px] text-red">{error}</span>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 w-full rounded-lg bg-text py-3 text-[14px] font-semibold text-bg hover:bg-text/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Creating..." : "Create Market"}
          </button>
        </form>
      </div>
    </div>
  );
}
