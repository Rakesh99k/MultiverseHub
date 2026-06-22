"use client";
import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-4xl font-bold">MultiverseHub</h1>
      <p className="mb-6 text-zinc-600">Create a lobby, invite players, and launch TicTacToe, Chess, or Sudoku.</p>

      <div className="flex flex-wrap gap-4">
        <Link
          href="/lobby"
          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Lobbies
        </Link>
        <Link
          href="/chat"
          className="rounded-md border border-zinc-300 px-4 py-2 hover:bg-zinc-100"
        >
          Chat Info
        </Link>
      </div>
    </div>
  );
}
