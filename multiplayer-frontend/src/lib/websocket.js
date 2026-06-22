import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

const WS_URL = "http://localhost:8080/ws";

function safeParse(message) {
  if (!message?.body) {
    return null;
  }

  try {
    return JSON.parse(message.body);
  } catch {
    return message.body;
  }
}

export function createRealtimeClient({ onConnect, onDisconnect, onError } = {}) {
  const subscriptions = new Map();
  const activeSubscriptions = new Map();
  const client = new Client({
    webSocketFactory: () => new SockJS(WS_URL),
    reconnectDelay: 2500,
    debug: () => {},
    onConnect: () => {
      subscriptions.forEach((handler, topic) => {
        const sub = client.subscribe(topic, (message) => {
          handler(safeParse(message));
        });
        activeSubscriptions.set(topic, sub);
      });
      onConnect?.();
    },
    onStompError: (frame) => {
      onError?.(frame?.headers?.message || "WebSocket error");
    },
    onWebSocketError: () => {
      onError?.("WebSocket connection error");
    },
    onDisconnect: () => {
      onDisconnect?.();
    },
  });

  const api = {
    activate() {
      client.activate();
    },
    deactivate() {
      client.deactivate();
    },
    subscribe(topic, handler) {
      subscriptions.set(topic, handler);

      if (client.connected) {
        const sub = client.subscribe(topic, (message) => {
          handler(safeParse(message));
        });
        activeSubscriptions.set(topic, sub);
      }
    },
    unsubscribe(topic) {
      subscriptions.delete(topic);
      activeSubscriptions.get(topic)?.unsubscribe();
      activeSubscriptions.delete(topic);
    },
    publish(destination, body) {
      if (!client.connected) {
        return;
      }

      client.publish({ destination, body: typeof body === "string" ? body : JSON.stringify(body) });
    },
    isConnected() {
      return client.connected;
    },
  };

  return api;
}
