import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:8080/ws";

function safeParse(message) {
  if (!message?.body) return null;
  try {
    return JSON.parse(message.body);
  } catch {
    return message.body;
  }
}

export function createRealtimeClient({ onConnect, onDisconnect, onError } = {}) {
  // topic → handler mapping (source of truth)
  const subscriptions = new Map();
  // topic → active STOMP subscription
  const activeSubscriptions = new Map();
  // track if onConnect has been called for initial setup
  let initialConnectDone = false;

  const client = new Client({
    webSocketFactory: () => new SockJS(WS_URL),
    reconnectDelay: 2500,
    debug: () => {},

    onConnect: () => {
      // Re-subscribe all known topics (handles reconnect cleanly)
      subscriptions.forEach((handler, topic) => {
        // Unsubscribe stale subscription if it exists
        if (activeSubscriptions.has(topic)) {
          try {
            activeSubscriptions.get(topic).unsubscribe();
          } catch {
            // ignore
          }
          activeSubscriptions.delete(topic);
        }

        // Create fresh subscription
        const sub = client.subscribe(topic, (message) => {
          handler(safeParse(message));
        });
        activeSubscriptions.set(topic, sub);
      });

      // Only call the caller's onConnect once (for initial setup)
      if (!initialConnectDone) {
        initialConnectDone = true;
        onConnect?.();
      }
    },

    onStompError: (frame) => {
      onError?.(frame?.headers?.message || "WebSocket error");
    },

    onWebSocketError: () => {
      onError?.("WebSocket connection error");
    },

    onDisconnect: () => {
      // Clear active subscriptions — they are invalid after disconnect
      activeSubscriptions.clear();
      onDisconnect?.();
    },
  });

  const api = {
    activate() {
      client.activate();
    },

    deactivate() {
      subscriptions.clear();
      activeSubscriptions.clear();
      client.deactivate();
    },

    subscribe(topic, handler) {
      subscriptions.set(topic, handler);

      // If already connected, subscribe immediately
      if (client.connected) {
        // Remove any existing subscription for this topic
        if (activeSubscriptions.has(topic)) {
          try {
            activeSubscriptions.get(topic).unsubscribe();
          } catch {
            // ignore
          }
        }

        const sub = client.subscribe(topic, (message) => {
          handler(safeParse(message));
        });
        activeSubscriptions.set(topic, sub);
      }
    },

    unsubscribe(topic) {
      subscriptions.delete(topic);
      if (activeSubscriptions.has(topic)) {
        try {
          activeSubscriptions.get(topic).unsubscribe();
        } catch {
          // ignore
        }
        activeSubscriptions.delete(topic);
      }
    },

    publish(destination, body) {
      if (!client.connected) {
        console.warn("WebSocket not connected — message dropped:", destination);
        return;
      }
      client.publish({
        destination,
        body: typeof body === "string" ? body : JSON.stringify(body),
      });
    },

    isConnected() {
      return client.connected;
    },
  };

  return api;
}