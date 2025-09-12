import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";

let stompClient = null;

export function connect(onMessageReceived) {
  const socket = new SockJS("http://localhost:8080/ws");
  stompClient = Stomp.over(socket);

  stompClient.connect({}, () => {
    console.log("Connected to WebSocket ✅");

    // Subscribe to server topic
    stompClient.subscribe("/topic/greetings", (message) => {
      if (onMessageReceived) {
        onMessageReceived(JSON.parse(message.body));
      }
    });
  });
}

export function sendMessage(message) {
  if (stompClient && stompClient.connected) {
    stompClient.send("/app/hello", {}, message);
  }
}
