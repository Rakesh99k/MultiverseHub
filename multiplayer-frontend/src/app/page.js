"use client";
import Link from "next/link";

export default function Home() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">🎮 Multiplayer Platform</h1>
      <p className="mb-6">Welcome! Choose where you want to go:</p>

      <div className="flex gap-4">
        <Link
          href="/lobby"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Go to Lobbies
        </Link>
      </div>
    </div>
  );
}
