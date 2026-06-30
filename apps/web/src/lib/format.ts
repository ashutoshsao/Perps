import type { UserOrder } from "../api/types";

export function formatNumber(value: number | string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(numeric);
}

export function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function parsePositiveInt(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export function clampPercentInput(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(parsed, 0), 100);
}

export function percentToBps(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  return Math.round(value * 100);
}

export function formatPercent(value: number) {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
}

export function formatOrderError(error: unknown) {
  const message = error instanceof Error ? error.message : "Order failed";
  if (message.includes("no liquidity on asks")) return "No sell liquidity available. Place a sell limit order first, or wait for asks.";
  if (message.includes("no liquidity on bids")) return "No buy liquidity available. Place a buy limit order first, or wait for bids.";
  return message;
}

export function formatAccountId(userId: string | null) {
  if (!userId) return "Unknown account";
  if (userId.length <= 14) return userId;
  return `${userId.slice(0, 6)}...${userId.slice(-6)}`;
}

export function isCancellableOrder(order: UserOrder) {
  return (
    order.orderType === "limit" &&
    (order.status === "open" || order.status === "partially_filled") &&
    order.qty - order.filledQty > 0
  );
}

export function isTerminalCancelError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("doesn't exist") ||
    normalized.includes("not found") ||
    (normalized.includes("can't be cancelled") && (normalized.includes("filled") || normalized.includes("cancelled")))
  );
}
