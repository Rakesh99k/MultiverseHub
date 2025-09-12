"use client";
import Link from "next/link";

export default function Home() {
  return (
    <div style={{ padding: 20 }}>
      <h1>🎮 Multiplayer Platform</h1>
      <ul>
        <li>
          <Link href="/chat">💬 Go to Chat</Link>
        </li>
        <li>
          <Link href="/lobby">🕹️ Enter Lobby</Link>
        </li>
      </ul>
    </div>
  );
}
