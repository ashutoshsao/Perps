import { useEffect, useMemo, useState } from "react";
import type { EngineFill, EngineOrderRecord, UserFill, UserOrder } from "../api/types";
import { subscribeChannel } from "../ws/client";

const MAX_ROWS = 80;

function decodeUserId(token: string | null) {
  if (!token) return null;

  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const decoded = JSON.parse(window.atob(padded)) as { userId?: string };
    return decoded.userId ?? null;
  } catch {
    return null;
  }
}

function mapEngineOrder(order: EngineOrderRecord): UserOrder {
  return {
    id: order.orderId,
    userId: order.userId,
    marketId: order.marketId,
    orderType: order.orderType,
    side: order.side,
    qty: order.qty,
    filledQty: order.filledQty,
    price: order.price,
    leverage: order.leverage,
    initialMargin: order.margin,
    status: order.status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function mapEngineFill(fill: EngineFill, userId: string): UserFill {
  const side = fill.makerUserId === userId ? fill.makerSide : fill.makerSide === "buy" ? "sell" : "buy";

  return {
    id: fill.fillId,
    qty: fill.qty,
    price: fill.price,
    side,
    makerSide: fill.makerSide,
    symbol: fill.symbol,
    makerUserId: fill.makerUserId,
    takerUserId: fill.takerUserId,
    makerOrderId: fill.makerOrderId,
    takerOrderId: fill.takerOrderId,
    marketId: fill.symbol,
    createdAt: new Date(fill.createdAt).toISOString(),
  };
}

function mergeOrders(liveOrders: UserOrder[], snapshotOrders: UserOrder[]) {
  const byId = new Map<string, UserOrder>();

  for (const order of snapshotOrders) {
    byId.set(order.id, order);
  }
  for (const order of liveOrders) {
    const existing = byId.get(order.id);
    if (!existing || new Date(order.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
      byId.set(order.id, { ...existing, ...order });
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, MAX_ROWS);
}

function mergeFills(liveFills: UserFill[], snapshotFills: UserFill[]) {
  const byId = new Map<string, UserFill>();

  for (const fill of snapshotFills) {
    byId.set(fill.id, fill);
  }
  for (const fill of liveFills) {
    byId.set(fill.id, fill);
  }

  return Array.from(byId.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX_ROWS);
}

export function useLiveAccount(token: string | null, snapshotOrders: UserOrder[], snapshotFills: UserFill[]) {
  const userId = useMemo(() => decodeUserId(token), [token]);
  const [liveOrders, setLiveOrders] = useState<UserOrder[]>([]);
  const [liveFills, setLiveFills] = useState<UserFill[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLiveOrders([]);
    setLiveFills([]);
    setIsLive(false);
    setError(null);

    if (!token || !userId) return;

    let openSubscriptions = 0;
    function markOpen() {
      openSubscriptions += 1;
      setIsLive(openSubscriptions === 2);
      setError(null);
    }
    function markClosed() {
      openSubscriptions = Math.max(0, openSubscriptions - 1);
      setIsLive(false);
    }

    const ordersSubscription = subscribeChannel<EngineOrderRecord>(`user:${userId}:orders`, (order) => {
      setLiveOrders((current) => mergeOrders([mapEngineOrder(order), ...current], []));
    }, {
      token,
      onOpen: markOpen,
      onClose: markClosed,
      onError(message) {
        setError(message);
        setIsLive(false);
      },
    });

    const fillsSubscription = subscribeChannel<EngineFill>(`user:${userId}:fills`, (fill) => {
      setLiveFills((current) => mergeFills([mapEngineFill(fill, userId), ...current], []));
    }, {
      token,
      onOpen: markOpen,
      onClose: markClosed,
      onError(message) {
        setError(message);
        setIsLive(false);
      },
    });

    return () => {
      ordersSubscription.unsubscribe();
      fillsSubscription.unsubscribe();
    };
  }, [token, userId]);

  const orders = useMemo(() => mergeOrders(liveOrders, snapshotOrders), [liveOrders, snapshotOrders]);
  const fills = useMemo(() => mergeFills(liveFills, snapshotFills), [liveFills, snapshotFills]);

  return { userId, orders, fills, isLive, error };
}

export function useLiveAccountLists(
  token: string | null,
  snapshotOrders: UserOrder[],
  snapshotFills: UserFill[],
) {
  const account = useLiveAccount(token, snapshotOrders, snapshotFills);

  const openOrders = useMemo(
    () => account.orders.filter((order) => isOpenLimitOrder(order)),
    [account.orders],
  );
  const orderHistory = useMemo(
    () => account.orders.filter((order) => !isOpenLimitOrder(order) && order.status !== "open"),
    [account.orders],
  );

  return { ...account, openOrders, orderHistory };
}

function isOpenLimitOrder(order: UserOrder) {
  return (
    order.orderType === "limit" &&
    (order.status === "open" || order.status === "partially_filled") &&
    order.qty - order.filledQty > 0
  );
}
