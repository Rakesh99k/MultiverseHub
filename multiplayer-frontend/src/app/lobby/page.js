"use client";
import { useEffect, useState } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

let stompClient = null;

export default function Lobby() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [username, setUsername] = useState("");
  const [tempName, setTempName] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isJoined, setIsJoined] = useState(false);

  useEffect(() => {
    const socket = new SockJS("http://localhost:8080/ws");

    stompClient = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      debug: (str) => console.log(str),
      onConnect: () => {
        console.log("✅ Connected to WebSocket");
        setIsConnected(true);

        stompClient.subscribe("/topic/greetings", (message) => {
          setMessages((prev) => [...prev, message.body]);
        });
      },
    });

    stompClient.activate();

    return () => {
      if (stompClient) stompClient.deactivate();
    };
  }, []);

  const joinLobby = () => {
    if (tempName.trim().length >= 3) {
      setUsername(tempName.trim());
      setIsJoined(true);
      stompClient.publish({
        destination: "/app/hello",
        body: `🔔 ${tempName} joined the lobby`,
      });
    } else {
      alert("Name must be at least 3 characters long!");
    }
  };

  const sendMessage = () => {
    if (stompClient && input.trim() !== "" && username) {
      stompClient.publish({
        destination: "/app/hello",
        body: `${username}: ${input}`,
      });
      setInput("");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>🕹️ Lobby Chat</h1>

      {/* Join lobby */}
      {!isJoined && (
        <div style={{ marginBottom: "15px" }}>
          <input
            type="text"
            placeholder="Enter your name"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            style={{ padding: "5px", marginRight: "10px" }}
          />
          <button onClick={joinLobby}>Join Lobby</button>
        </div>
      )}

      {/* Messages */}
      <div
        style={{
          border: "1px solid #ccc",
          height: "300px",
          padding: "10px",
          marginBottom: "10px",
          overflowY: "auto",
        }}
      >
        {messages.map((msg, idx) => (
          <p key={idx}>{msg}</p>
        ))}
      </div>

      {/* Input + Send */}
      {isJoined && (
        <div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type message..."
            style={{ padding: "5px", marginRight: "10px" }}
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      )}

      {/* Connection status */}
      <p style={{ marginTop: "10px", color: isConnected ? "green" : "red" }}>
        {isConnected ? "🟢 Connected" : "🔴 Connecting..."}
      </p>
    </div>
  );
}
