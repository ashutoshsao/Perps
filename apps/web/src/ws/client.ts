type SubscriptionHandler<T> = (data: T) => void;

type SocketMessage<T> = {
  channel?: string;
  data?: T;
  type?: string;
  message?: string;
};

const WS_URL = import.meta.env?.VITE_WS_URL
  ?? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:3030`;

type SubscribeOptions = {
  token?: string;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (message: string) => void;
};

export type WsSubscription = {
  unsubscribe: () => void;
};

export function subscribeChannel<T>(channel: string, handler: SubscriptionHandler<T>, options: SubscribeOptions = {}): WsSubscription {
  let socket: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let isClosed = false;

  function connect() {
    socket = new WebSocket(WS_URL);

    socket.addEventListener("open", () => {
      if (isClosed) {
        socket?.close();
        return;
      }
      socket?.send(JSON.stringify({ type: "SUBSCRIBE", channel, token: options.token }));
      options.onOpen?.();
    });

    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data.toString()) as SocketMessage<T>;
        if (message.channel === channel && message.data) {
          handler(message.data);
        }
        if (message.type === "error" && message.message) {
          options.onError?.(message.message);
        }
      } catch (error) {
        options.onError?.(error instanceof Error ? error.message : "Invalid WebSocket message");
      }
    });

    socket.addEventListener("close", () => {
      options.onClose?.();
      if (!isClosed) {
        reconnectTimer = window.setTimeout(connect, 1_000);
      }
    });
  }

  connect();

  return {
    unsubscribe() {
      isClosed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "UNSUBSCRIBE", channel, token: options.token }));
        socket.close();
      } else if (socket?.readyState === WebSocket.CONNECTING) {
        return;
      } else {
        socket?.close();
      }
    },
  };
}
