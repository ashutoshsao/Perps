import WebSocket from "ws";

export const connectedSockets = new Map<string, Set<WebSocket>>();
