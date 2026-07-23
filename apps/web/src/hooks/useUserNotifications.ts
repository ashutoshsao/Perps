import { useEffect } from "react";
import type { UserNotification } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { formatPerpSymbol } from "../lib/markets";
import { subscribeChannel } from "../ws/client";

export function useUserNotifications() {
  const { token, userId } = useAuth();
  const { push } = useToast();

  useEffect(() => {
    if (!token || !userId) return;

    const subscription = subscribeChannel<UserNotification>(`user:${userId}:notifications`, (notification) => {
      const label = formatPerpSymbol(notification.symbol);
      const message = notification.type === "liquidation"
        ? `Position liquidated: ${notification.qty} ${label}`
        : `Position auto-deleveraged (ADL): ${notification.qty} ${label}`;
      push(message, "error");
    }, { token });

    return () => subscription.unsubscribe();
  }, [token, userId, push]);
}
