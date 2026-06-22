"use client";
import Link from "next/link";

export default function ChatPage() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-3 text-3xl font-bold">Chat</h1>
      <p className="mb-4 text-zinc-600">
        Global chat was replaced with lobby-scoped chat. Open any lobby to chat with connected players.
      </p>
      <div className="flex gap-3">
        <Link href="/lobby" className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
          Go to Lobbies
        </Link>
      </div>
    </div>
  );
}
