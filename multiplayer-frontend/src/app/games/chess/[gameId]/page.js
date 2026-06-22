"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { chessApi } from "../../../../lib/api";
import { createRealtimeClient } from "../../../../lib/websocket";
import { useSession } from "../../../../context/SessionContext";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

const PIECES = {
  p: "p",
  r: "r",
  n: "n",
  b: "b",
  q: "q",
  k: "k",
  P: "P",
  R: "R",
  N: "N",
  B: "B",
  Q: "Q",
  K: "K",
};

function parseFenBoard(fen) {
  const boardFen = fen.split(" ")[0];
  return boardFen.split("/").map((rank) => {
    const row = [];
    rank.split("").forEach((char) => {
      if (/\d/.test(char)) {
        const count = Number(char);
        for (let i = 0; i < count; i += 1) {
          row.push("");
        }
      } else {
        row.push(char);
      }
    });
    return row;
  });
}

function squareFromIndex(row, col) {
  return `${FILES[col]}${8 - row}`;
}

function getColor(piece) {
  if (!piece) {
    return "";
  }
  return piece === piece.toUpperCase() ? "white" : "black";
}

export default function ChessGamePage() {
  const params = useParams();
  const gameId = params?.gameId;
  const { playerName } = useSession();

  const [game, setGame] = useState(null);
  const [selectedSquare, setSelectedSquare] = useState("");
  const [targetSquares, setTargetSquares] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadGame = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const data = await chessApi.getGame(gameId);
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
        realtime.subscribe(`/topic/chess/${gameId}`, (data) => {
          if (data) {
            setGame(data);
          }
        });
      },
    });

    realtime.activate();
    return () => realtime.deactivate();
  }, [gameId, loadGame]);

  const fen = game?.fen || "";

  const boardRows = useMemo(() => {
    if (!fen) {
      return [];
    }
    return parseFenBoard(fen);
  }, [fen]);

  const legalMoves = useMemo(() => {
    if (!fen) {
      return [];
    }

    try {
      const chess = new Chess(fen);
      return chess.moves({ verbose: true });
    } catch {
      return [];
    }
  }, [fen]);

  const playerColor = useMemo(() => {
    if (!game || !playerName) {
      return "";
    }
    if (game.playerWhite === playerName) {
      return "white";
    }
    if (game.playerBlack === playerName) {
      return "black";
    }
    return "";
  }, [game, playerName]);

  async function submitMove(from, to) {
    const matching = legalMoves.filter((move) => move.from === from && move.to === to);
    if (matching.length === 0) {
      setError("Illegal move");
      return;
    }

    const preferred = matching.find((move) => move.promotion === "q") || matching[0];
    const uci = `${preferred.from}${preferred.to}${preferred.promotion || ""}`;

    try {
      const updated = await chessApi.move(gameId, playerName, uci);
      setGame(updated);
      setSelectedSquare("");
      setTargetSquares([]);
      setError("");
    } catch (err) {
      setError(err.message || "Move failed");
    }
  }

  function handleSquareClick(rowIndex, colIndex) {
    const square = squareFromIndex(rowIndex, colIndex);
    const piece = boardRows[rowIndex]?.[colIndex] || "";

    if (!selectedSquare) {
      if (!piece) {
        return;
      }

      const pieceColor = getColor(piece);
      if (playerColor && pieceColor !== playerColor) {
        setError("You can only move your own pieces");
        return;
      }

      const targets = legalMoves.filter((move) => move.from === square).map((move) => move.to);
      if (targets.length === 0) {
        setError("No legal moves from this square");
        return;
      }

      setSelectedSquare(square);
      setTargetSquares(targets);
      setError("");
      return;
    }

    if (square === selectedSquare) {
      setSelectedSquare("");
      setTargetSquares([]);
      return;
    }

    submitMove(selectedSquare, square);
  }

  async function resign() {
    try {
      const updated = await chessApi.resign(gameId, playerName);
      setGame(updated);
    } catch (err) {
      setError(err.message || "Unable to resign");
    }
  }

  async function declareDraw() {
    try {
      const updated = await chessApi.draw(gameId);
      setGame(updated);
    } catch (err) {
      setError(err.message || "Unable to declare draw");
    }
  }

  async function reset() {
    try {
      const updated = await chessApi.reset(gameId);
      setGame(updated);
      setSelectedSquare("");
      setTargetSquares([]);
    } catch (err) {
      setError(err.message || "Unable to reset game");
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-6xl p-6">Loading chess game...</div>;
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Chess</h1>
        <Link href="/lobby" className="rounded-md border border-zinc-300 px-3 py-1.5">
          Back to Lobby
        </Link>
      </div>

      <div className="mb-4 rounded-lg bg-zinc-50 p-4 text-sm">
        <p>Game ID: {gameId}</p>
        <p>White: {game?.playerWhite || "-"}</p>
        <p>Black: {game?.playerBlack || "-"}</p>
        <p>Current turn: {game?.currentTurn || "-"}</p>
        <p>Status: {game?.status || "-"}</p>
        <p>Winner: {game?.winner || "-"}</p>
        <p>Your side: {playerColor || "Spectator"}</p>
      </div>

      {error ? <p className="mb-3 rounded-md bg-rose-100 px-3 py-2 text-rose-700">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[520px_1fr]">
        <div className="grid grid-cols-8 overflow-hidden rounded-xl border border-zinc-400">
          {boardRows.map((row, rowIndex) =>
            row.map((piece, colIndex) => {
              const square = squareFromIndex(rowIndex, colIndex);
              const isLight = (rowIndex + colIndex) % 2 === 0;
              const isSelected = selectedSquare === square;
              const isTarget = targetSquares.includes(square);

              return (
                <button
                  key={square}
                  onClick={() => handleSquareClick(rowIndex, colIndex)}
                  className={`flex h-16 items-center justify-center text-2xl font-semibold ${
                    isLight ? "bg-zinc-100" : "bg-zinc-400"
                  } ${isSelected ? "ring-4 ring-amber-400" : ""} ${isTarget ? "ring-4 ring-emerald-400" : ""}`}
                >
                  {PIECES[piece] || ""}
                </button>
              );
            })
          )}
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold">Move History</h2>
          <div className="mb-4 max-h-72 overflow-y-auto rounded-md border border-zinc-300 p-3 text-sm">
            {game?.moveHistory?.length ? (
              game.moveHistory.map((move, index) => (
                <p key={`${move}-${index}`}>
                  {index + 1}. {move}
                </p>
              ))
            ) : (
              <p className="text-zinc-500">No moves yet</p>
            )}
          </div>

          <h2 className="mb-2 text-xl font-semibold">Legal Moves (SAN)</h2>
          <p className="mb-4 max-h-40 overflow-y-auto rounded-md border border-zinc-300 p-3 text-sm">
            {game?.legalMoves?.length ? game.legalMoves.join(", ") : "No legal moves"}
          </p>

          <div className="flex flex-wrap gap-2">
            <button onClick={resign} className="rounded-md bg-rose-600 px-3 py-2 text-white hover:bg-rose-700">
              Resign
            </button>
            <button
              onClick={declareDraw}
              className="rounded-md bg-amber-600 px-3 py-2 text-white hover:bg-amber-700"
            >
              Offer Draw
            </button>
            <button onClick={reset} className="rounded-md bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700">
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
