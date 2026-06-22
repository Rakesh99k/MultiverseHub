"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ticTacToeApi } from "../../../../lib/api";
import { createRealtimeClient } from "../../../../lib/websocket";
import { useSession } from "../../../../context/SessionContext";

export default function TicTacToeGamePage() {
  const params = useParams();
  const gameId = params?.gameId;
  const { playerName } = useSession();

  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadGame = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const data = await ticTacToeApi.getGame(gameId);
      setGame(data);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load game");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    if (!gameId) {
      return;
    }

    loadGame(true);
    const realtime = createRealtimeClient({
      onConnect: () => {
        realtime.subscribe(`/topic/tictactoe/${gameId}`, (data) => {
          if (data) {
            setGame(data);
          }
        });
      },
    });

    realtime.activate();
    return () => realtime.deactivate();
  }, [gameId, loadGame]);

  const mySymbol = useMemo(() => {
    if (!game || !playerName) {
      return "";
    }

    if (game.playerX === playerName) {
      return "X";
    }
    if (game.playerO === playerName) {
      return "O";
    }
    return "";
  }, [game, playerName]);

  async function playMove(row, col) {
    if (!playerName.trim()) {
      setError("Set player name in lobby first");
      return;
    }

    try {
      const updated = await ticTacToeApi.play(gameId, row, col, playerName.trim());
      setGame(updated);
      setError("");
    } catch (err) {
      setError(err.message || "Move failed");
    }
  }

  async function resetGame() {
    try {
      const updated = await ticTacToeApi.reset(gameId);
      setGame(updated);
      setError("");
    } catch (err) {
      setError(err.message || "Reset failed");
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl p-6">Loading game...</div>;
  }

  const isFinished = !!game?.winner;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold">TicTacToe</h1>
        <Link href="/lobby" className="rounded-md border border-zinc-300 px-3 py-1.5">
          Back to Lobby
        </Link>
      </div>

      <div className="mb-4 rounded-lg bg-zinc-50 p-4 text-sm">
        <p>Game ID: {gameId}</p>
        <p>Player X: {game?.playerX || "-"}</p>
        <p>Player O: {game?.playerO || "-"}</p>
        <p>Current Turn: {game?.currentPlayer || "-"}</p>
        <p>Your Symbol: {mySymbol || "Spectator"}</p>
      </div>

      {game?.winner ? (
        <p className="mb-3 rounded-md bg-emerald-100 px-3 py-2 text-emerald-700">
          Winner: {game.winner}
        </p>
      ) : null}

      {error ? <p className="mb-3 rounded-md bg-rose-100 px-3 py-2 text-rose-700">{error}</p> : null}

      <div className="mx-auto grid w-fit grid-cols-3 gap-2 rounded-xl border border-zinc-300 bg-zinc-100 p-3">
        {game?.board?.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const disabled = cell !== "-" || isFinished;
            return (
              <button
                key={`${rowIndex}-${colIndex}`}
                onClick={() => playMove(rowIndex, colIndex)}
                disabled={disabled}
                className="h-20 w-20 rounded-md bg-white text-3xl font-bold disabled:opacity-60"
              >
                {cell === "-" ? "" : cell}
              </button>
            );
          })
        )}
      </div>

      <button
        onClick={resetGame}
        className="mt-5 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
      >
        Reset
      </button>
    </div>
  );
}
