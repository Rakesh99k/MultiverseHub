// filename: src/lib/websocket.js

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
  const subscriptions    = new Map();
  const activeSubscriptions = new Map();

  const client = new Client({
    webSocketFactory: () => new SockJS(WS_URL),
    reconnectDelay: 3000,
    debug: () => {},

    onConnect: () => {
      // Clear stale active subscriptions
      activeSubscriptions.clear();

      // Re-subscribe everything
      subscriptions.forEach((handler, topic) => {
        const sub = client.subscribe(topic, (msg) => {
          handler(safeParse(msg));
        });
        activeSubscriptions.set(topic, sub);
      });

      // Always call onConnect — let caller decide what to do
      onConnect?.();
    },

    onStompError: (frame) => {
      onError?.(frame?.headers?.message || "WebSocket error");
    },

    onWebSocketError: () => {
      onError?.("WebSocket connection error");
    },

    onDisconnect: () => {
      activeSubscriptions.clear();
      onDisconnect?.();
    },
  });

  return {
    activate()  { client.activate(); },
    deactivate() {
      subscriptions.clear();
      activeSubscriptions.clear();
      client.deactivate();
    },

    subscribe(topic, handler) {
      // Always update handler (in case it changed)
      subscriptions.set(topic, handler);

      if (client.connected) {
        // Unsubscribe old if exists
        if (activeSubscriptions.has(topic)) {
          try { activeSubscriptions.get(topic).unsubscribe(); } catch (_) {}
          activeSubscriptions.delete(topic);
        }
        const sub = client.subscribe(topic, (msg) => handler(safeParse(msg)));
        activeSubscriptions.set(topic, sub);
      }
    },

    unsubscribe(topic) {
      subscriptions.delete(topic);
      if (activeSubscriptions.has(topic)) {
        try { activeSubscriptions.get(topic).unsubscribe(); } catch (_) {}
        activeSubscriptions.delete(topic);
      }
    },

    publish(destination, body) {
      if (!client.connected) return;
      client.publish({
        destination,
        body: typeof body === "string" ? body : JSON.stringify(body),
      });
    },

    isConnected() { return client.connected; },
  };
}