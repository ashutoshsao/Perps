import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { Balance, OrderMutationResponse, OrderPayload, UserFill, UserOrder } from "../api/types";
import { derivePositions, type DerivedPosition } from "../features/account/positions";
import { useAsyncData } from "../hooks/useAsyncData";
import { useLiveAccountLists } from "../hooks/useLiveAccount";
import { isTerminalCancelError } from "../lib/format";
import { useAuth } from "./AuthContext";

type OrdersContextValue = {
  balance: Balance | null;
  balanceLoading: boolean;
  openOrders: UserOrder[];
  orderHistory: UserOrder[];
  fills: UserFill[];
  positions: DerivedPosition[];
  isLive: boolean;
  error: string | null;
  placeOrder: (payload: OrderPayload) => Promise<OrderMutationResponse>;
  cancelOrder: (orderId: string) => Promise<void>;
  deposit: (amount: number) => Promise<Balance>;
};

const OrdersContext = createContext<OrdersContextValue | null>(null);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [version, setVersion] = useState(0);

  const balanceState = useAsyncData(
    () => (token ? api.getBalance(token).then((data) => data.response) : Promise.resolve(null)),
    [token, version],
  );
  const ordersState = useAsyncData(
    () => (token ? api.getOrders(token).then((data) => data.orders) : Promise.resolve([])),
    [token, version],
  );
  const fillsState = useAsyncData(
    () => (token ? api.getFills(token).then((data) => data.fills) : Promise.resolve([])),
    [token, version],
  );

  const live = useLiveAccountLists(token, ordersState.data ?? [], fillsState.data ?? []);
  const positions = useMemo(() => derivePositions(live.fills), [live.fills]);

  function refresh() {
    setVersion((v) => v + 1);
    window.setTimeout(() => setVersion((v) => v + 1), 500);
  }

  async function placeOrder(payload: OrderPayload) {
    if (!token) throw new Error("Sign in before placing an order.");
    const response = await api.placeOrder(token, payload);
    refresh();
    return response;
  }

  async function deposit(amount: number) {
    if (!token) throw new Error("Sign in before depositing.");
    const response = await api.addBalance(token, amount);
    refresh();
    return response.response;
  }

  async function cancelOrder(orderId: string) {
    if (!token) return;
    try {
      await api.cancelOrder(token, orderId);
      refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cancel failed";
      if (isTerminalCancelError(message)) {
        refresh();
        return;
      }
      throw error;
    }
  }

  return (
    <OrdersContext.Provider
      value={{
        balance: balanceState.data,
        balanceLoading: balanceState.isLoading,
        openOrders: live.openOrders,
        orderHistory: live.orderHistory,
        fills: live.fills,
        positions,
        isLive: live.isLive,
        error: live.error,
        placeOrder,
        cancelOrder,
        deposit,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within OrdersProvider");
  return ctx;
}
