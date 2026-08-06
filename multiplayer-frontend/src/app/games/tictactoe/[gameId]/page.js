"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ticTacToeApi } from "@/lib/api";
import { createRealtimeClient } from "@/lib/websocket";
import { useSession } from "@/context/SessionContext";
import { useToast } from "@/components/ToastProvider";

// ─── Find winning line ────────────────────────────────────────────────────────
function getWinningCells(board, winner) {
  if (!winner || winner === "DRAW") return [];

  const lines = [
    // Rows
    [[0,0],[0,1],[0,2]],
    [[1,0],[1,1],[1,2]],
    [[2,0],[2,1],[2,2]],
    // Columns
    [[0,0],[1,0],[2,0]],
    [[0,1],[1,1],[2,1]],
    [[0,2],[1,2],[2,2]],
    // Diagonals
    [[0,0],[1,1],[2,2]],
    [[0,2],[1,1],[2,0]],
  ];

  for (const line of lines) {
    const [a, b, c] = line;
    if (
        board[a[0]][a[1]] === winner &&
        board[b[0]][b[1]] === winner &&
        board[c[0]][c[1]] === winner
    ) {
      // Return as "row,col" strings for easy lookup
      return line.map(([r, c]) => `${r},${c}`);
    }
  }

  return [];
}

export default function TicTacToeGamePage() {
  const params   = useParams();
  const gameId   = params?.gameId;
  const { playerName } = useSession();
  const toast    = useToast();

  const [game,    setGame]    = useState(null);
  const [loading, setLoading] = useState(true);

  // ─── Load game ─────────────────────────────────────────────────────────────
  const loadGame = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const data = await ticTacToeApi.getGame(gameId);
      setGame(data);
    } catch (err) {
      toast.error(err.message || "Unable to load game");
    } finally {
      setLoading(false);
    }
  }, [gameId, toast]);

  // ─── WebSocket setup ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameId) return;

    loadGame(true);

    const realtime = createRealtimeClient({
      onConnect: () => {
        realtime.subscribe(`/topic/tictactoe/${gameId}`, (data) => {
          if (data) setGame(data);
        });
      },
    });

    realtime.activate();
    return () => realtime.deactivate();
  }, [gameId, loadGame]);

  // ─── Computed ──────────────────────────────────────────────────────────────
  const mySymbol = useMemo(() => {
    if (!game || !playerName) return "";
    if (game.playerX === playerName) return "X";
    if (game.playerO === playerName) return "O";
    return "";
  }, [game, playerName]);

  const isMyTurn = useMemo(() => {
    if (!game || !mySymbol) return false;
    return game.currentPlayer === mySymbol;
  }, [game, mySymbol]);

  const winningCells = useMemo(() => {
    if (!game?.winner || !game?.board) return [];
    return getWinningCells(game.board, game.winner);
  }, [game]);

  const isFinished = !!game?.winner;

  // ─── Actions ───────────────────────────────────────────────────────────────
  async function playMove(row, col) {
    if (!playerName.trim()) {
      toast.warning("Set your player name first");
      return;
    }

    if (!mySymbol) {
      toast.warning("You are not a player in this game");
      return;
    }

    if (!isMyTurn) {
      toast.warning(`It's ${game?.currentPlayer === "X" ? game?.playerX : game?.playerO}'s turn`);
      return;
    }

    if (game?.board?.[row][col] !== "-") {
      toast.warning("That cell is already taken");
      return;
    }

    try {
      const updated = await ticTacToeApi.play(gameId, row, col, playerName.trim());
      setGame(updated);
    } catch (err) {
      toast.error(err.message || "Move failed");
    }
  }

  async function resetGame() {
    try {
      const updated = await ticTacToeApi.reset(gameId);
      setGame(updated);
      toast.success("Game reset! X goes first.");
    } catch (err) {
      toast.error(err.message || "Reset failed");
    }
  }

  // ─── Cell styling ──────────────────────────────────────────────────────────
  function getCellStyle(row, col, cell) {
    const key       = `${row},${col}`;
    const isWinning = winningCells.includes(key);
    const isEmpty   = cell === "-";

    let base = "flex h-24 w-24 items-center justify-center rounded-xl text-4xl font-bold transition-all duration-200 ";

    if (isWinning) {
      // Winning cells glow
      base += "bg-emerald-400 text-white shadow-lg scale-105 ";
    } else if (!isEmpty) {
      // Filled cells
      base += cell === "X"
          ? "bg-blue-100 text-blue-700 "
          : "bg-rose-100 text-rose-700 ";
    } else if (!isFinished && isMyTurn) {
      // Empty + my turn = hoverable
      base += "bg-white hover:bg-gray-100 cursor-pointer text-gray-300 ";
    } else {
      // Empty + not my turn or game over
      base += "bg-white text-gray-200 cursor-default ";
    }

    return base;
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-gray-500">Loading game...</p>
        </div>
    );
  }

  return (
      <div className="mx-auto max-w-4xl p-6">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">❌ TicTacToe</h1>
          <Link
              href="/lobby"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ← Lobbies
          </Link>
        </div>

        {/* Info panel */}
        <div className="mb-6 grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-gray-400">Player X</p>
            <p className="font-semibold text-gray-900">
              {game?.playerX || "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Player O</p>
            <p className="font-semibold text-gray-900">
              {game?.playerO || "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">You are</p>
            <p className="font-semibold text-gray-900">
              {mySymbol || "Spectator"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Turn</p>
            <p className="font-semibold text-gray-900">
              {isFinished ? "—" : game?.currentPlayer}
            </p>
          </div>
        </div>

        {/* Turn / result banner */}
        {isFinished ? (
            <div className={`mb-6 rounded-xl px-5 py-4 text-center font-bold text-lg shadow-sm ${
                game.winner === "DRAW"
                    ? "bg-gray-100 text-gray-700"
                    : "bg-emerald-100 text-emerald-800"
            }`}>
              {game.winner === "DRAW"
                  ? "🤝 It's a Draw!"
                  : `🏆 ${game.winner === mySymbol ? "You win!" : `${game.winner} wins!`}`}
            </div>
        ) : (
            <div className={`mb-6 rounded-xl px-5 py-3 text-center text-sm font-medium shadow-sm ${
                isMyTurn
                    ? "bg-blue-50 text-blue-700"
                    : "bg-gray-50 text-gray-600"
            }`}>
              {isMyTurn
                  ? "✅ Your turn — click a cell to play"
                  : `⏳ Waiting for ${game?.currentPlayer === "X" ? game?.playerX : game?.playerO}...`}
            </div>
        )}

        {/* Board */}
        <div className="flex justify-center">
          <div className="grid grid-cols-3 gap-3 rounded-2xl border border-gray-200 bg-gray-100 p-4 shadow-md">
            {game?.board?.map((row, rowIndex) =>
                row.map((cell, colIndex) => {
                  const disabled = cell !== "-" || isFinished || !isMyTurn;
                  return (
                      <button
                          key={`${rowIndex}-${colIndex}`}
                          onClick={() => playMove(rowIndex, colIndex)}
                          disabled={disabled}
                          className={getCellStyle(rowIndex, colIndex, cell)}
                      >
                        {cell === "-" ? (
                            // Show faint symbol on hover when it's your turn
                            isMyTurn && !isFinished
                                ? <span className="opacity-0 hover:opacity-30">{mySymbol}</span>
                                : null
                        ) : cell}
                      </button>
                  );
                })
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex justify-center gap-3">
          <button
              onClick={resetGame}
              className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            {isFinished ? "🔄 Play Again" : "🔄 Reset"}
          </button>
        </div>
      </div>
  );
}