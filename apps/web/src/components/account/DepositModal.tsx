import { useState } from "react";
import { useOrders } from "../../context/OrdersContext";
import { useToast } from "../../context/ToastContext";
import { NebulaLogo } from "../../icons";

function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

const PRESET_AMOUNTS = [100, 1_000, 10_000];

export function DepositModal({ onClose }: { onClose: () => void }) {
  const { deposit } = useOrders();
  const { push } = useToast();
  const [amount, setAmount] = useState("1000");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than 0");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      // input is dollars; the backend holds balances in integer cents
      await deposit(Math.round(value * 100));
      push(`Deposited $${value.toLocaleString()}`, "success");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit failed");
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
            <span className="text-[16px] font-bold text-text">Deposit</span>
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
            <span className="text-[12px] text-text-muted">Amount (USD)</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="1000"
              autoFocus
              className="rounded-lg bg-surface px-3 py-2.5 text-[14px] text-text placeholder:text-text-dim"
            />
          </label>

          <div className="flex gap-2">
            {PRESET_AMOUNTS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(String(preset))}
                className="flex-1 rounded-lg bg-surface py-1.5 text-[13px] font-medium text-text-muted hover:bg-surface-2 hover:text-text"
              >
                ${preset.toLocaleString()}
              </button>
            ))}
          </div>

          {error && <span className="text-[12px] text-red">{error}</span>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 w-full rounded-lg bg-text py-3 text-[14px] font-semibold text-bg hover:bg-text/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Depositing..." : "Deposit"}
          </button>
        </form>
      </div>
    </div>
  );
}
