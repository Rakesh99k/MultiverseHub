// filename: src/app/games/chess/[gameId]/page.js

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
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

function parseFenBoard(fen) {
  const boardFen = fen.split(" ")[0];
  return boardFen.split("/").map((rank) => {
    const row = [];
    rank.split("").forEach((char) => {
      if (/\d/.test(char)) {
        for (let i = 0; i < Number(char); i++) row.push("");
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
  if (!piece) return "";
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

  const loadGame = useCallback(
      async (showLoader = false) => {
        if (showLoader) setLoading(true);
        try {
          const data = await chessApi.getGame(gameId);
          setGame(data);
          setError("");
        } catch (err) {
          // Only show error if game isn't already finished in local state
          setError(err.message || "Unable to load game");
        } finally {
          setLoading(false);
        }
      },
      [gameId]
  );

  useEffect(() => {
    if (!gameId) return;

    loadGame(true);

    const realtime = createRealtimeClient({
      onConnect: () => {
        realtime.subscribe(`/topic/chess/${gameId}`, (data) => {
          if (data) setGame(data);
        });
      },
    });

    realtime.activate();
    return () => realtime.deactivate();
  }, [gameId, loadGame]);

  const fen = game?.fen || "";

  // Raw board from FEN (always white's perspective, rank 8 at top)
  const rawBoardRows = useMemo(() => {
    if (!fen) return [];
    return parseFenBoard(fen);
  }, [fen]);

  // Legal moves computed client-side from FEN using chess.js
  const legalMoves = useMemo(() => {
    if (!fen) return [];
    try {
      return new Chess(fen).moves({ verbose: true });
    } catch {
      return [];
    }
  }, [fen]);

  // Which color is the current player
  const playerColor = useMemo(() => {
    if (!game || !playerName) return "";
    if (game.playerWhite === playerName) return "white";
    if (game.playerBlack === playerName) return "black";
    return ""; // spectator
  }, [game, playerName]);

  // Is it this player's turn
  const isMyTurn = useMemo(() => {
    if (!game || !playerColor) return false;
    return game.currentTurn === playerColor;
  }, [game, playerColor]);

  // Flip board for black player
  const boardRows = useMemo(() => {
    if (playerColor === "black") {
      return [...rawBoardRows]
          .reverse()
          .map((row) => [...row].reverse());
    }
    return rawBoardRows;
  }, [rawBoardRows, playerColor]);

  // Convert display (row, col) to chess square (accounts for board flip)
  function displayToSquare(rowIndex, colIndex) {
    if (playerColor === "black") {
      return squareFromIndex(7 - rowIndex, 7 - colIndex);
    }
    return squareFromIndex(rowIndex, colIndex);
  }

  // ─── Move submission ────────────────────────────────────────────────────────
  async function submitMove(from, to) {
    const matching = legalMoves.filter(
        (move) => move.from === from && move.to === to
    );

    if (matching.length === 0) {
      setError("Illegal move");
      setSelectedSquare("");
      setTargetSquares([]);
      return;
    }

    // Default promotion to queen
    const preferred =
        matching.find((m) => m.promotion === "q") || matching[0];
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

  // ─── Square click handler ────────────────────────────────────────────────────
  function handleSquareClick(rowIndex, colIndex) {
    const square = displayToSquare(rowIndex, colIndex);
    const piece = boardRows[rowIndex]?.[colIndex] || "";
    const isGameOver = game?.winner ||
        ["CHECKMATE","STALEMATE","DRAW","RESIGNED"].includes(game?.status);

    // Block interaction if game over
    if (isGameOver) return;

    // Block if not a player (spectator)
    if (!playerColor) {
      setError("You are spectating this game");
      return;
    }

    // Block if not your turn
    if (!isMyTurn) {
      setError(`It's ${game?.currentTurn}'s turn`);
      return;
    }

    // ── No square selected yet ──────────────────────────────────────────────
    if (!selectedSquare) {
      if (!piece) return; // clicked empty square

      const pieceColor = getColor(piece);

      if (pieceColor !== playerColor) {
        setError("You can only move your own pieces");
        return;
      }

      const targets = legalMoves
          .filter((m) => m.from === square)
          .map((m) => m.to);

      if (targets.length === 0) {
        setError("No legal moves from this square");
        return;
      }

      setSelectedSquare(square);
      setTargetSquares(targets);
      setError("");
      return;
    }

    // ── Square already selected ─────────────────────────────────────────────

    // Click same square = deselect
    if (square === selectedSquare) {
      setSelectedSquare("");
      setTargetSquares([]);
      return;
    }

    // Click own piece = re-select it
    if (piece && getColor(piece) === playerColor) {
      const targets = legalMoves
          .filter((m) => m.from === square)
          .map((m) => m.to);
      setSelectedSquare(square);
      setTargetSquares(targets);
      setError("");
      return;
    }

    // Otherwise attempt the move (capture or move to empty)
    submitMove(selectedSquare, square);
  }

  // ─── Action handlers ────────────────────────────────────────────────────────
  async function resign() {
    if (!playerName) return;
    try {
      const updated = await chessApi.resign(gameId, playerName);
      setGame(updated);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to resign");
    }
  }

  async function declareDraw() {
    try {
      const updated = await chessApi.draw(gameId);
      setGame(updated);
      setError("");
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
      setError("");
    } catch (err) {
      setError(err.message || "Unable to reset game");
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
        <div className="mx-auto max-w-6xl p-6">
          <p>Loading chess game...</p>
        </div>
    );
  }

  const isGameOver =
      game?.winner ||
      ["CHECKMATE", "STALEMATE", "DRAW", "RESIGNED"].includes(game?.status);

  const statusColor = {
    CHECK: "bg-amber-100 text-amber-800",
    CHECKMATE: "bg-rose-100 text-rose-800",
    STALEMATE: "bg-zinc-100 text-zinc-800",
    DRAW: "bg-zinc-100 text-zinc-800",
    RESIGNED: "bg-rose-100 text-rose-800",
    PLAYING: "bg-emerald-100 text-emerald-800",
  }[game?.status] || "bg-zinc-100 text-zinc-800";

  return (
      <div className="mx-auto max-w-6xl p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Chess</h1>
          <Link
              href="/lobby"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            Back to Lobby
          </Link>
        </div>

        {/* Game info panel */}
        <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-zinc-50 p-4 text-sm md:grid-cols-4">
          <div>
            <p className="text-zinc-500">White</p>
            <p className="font-semibold">{game?.playerWhite || "-"}</p>
          </div>
          <div>
            <p className="text-zinc-500">Black</p>
            <p className="font-semibold">{game?.playerBlack || "-"}</p>
          </div>
          <div>
            <p className="text-zinc-500">You are</p>
            <p className="font-semibold">{playerColor || "Spectator"}</p>
          </div>
          <div>
            <p className="text-zinc-500">Turn</p>
            <p className="font-semibold capitalize">{game?.currentTurn || "-"}</p>
          </div>
        </div>

        {/* Status badge */}
        <div className={`mb-4 inline-block rounded-full px-3 py-1 text-sm font-medium ${statusColor}`}>
          {game?.status || "LOADING"}
          {game?.winner ? ` — ${game.winner} wins` : ""}
        </div>

        {/* Your turn indicator */}
        {isMyTurn && !isGameOver && (
            <p className="mb-3 rounded-md bg-emerald-100 px-3 py-2 text-emerald-800 text-sm font-medium">
              ✅ Your turn to move
            </p>
        )}

        {/* Error */}
        {error ? (
            <p className="mb-3 rounded-md bg-rose-100 px-3 py-2 text-rose-700 text-sm">
              {error}
            </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[520px_1fr]">
          {/* Chess Board */}
          <div>
            {/* File labels (a-h) */}
            <div className="mb-1 grid grid-cols-8 px-0">
              {(playerColor === "black"
                      ? [...FILES].reverse()
                      : FILES
              ).map((f) => (
                  <div key={f} className="text-center text-xs text-zinc-500">
                    {f}
                  </div>
              ))}
            </div>

            <div className="flex">
              {/* Rank labels (1-8) */}
              <div className="mr-1 flex flex-col">
                {(playerColor === "black"
                        ? [1, 2, 3, 4, 5, 6, 7, 8]
                        : [8, 7, 6, 5, 4, 3, 2, 1]
                ).map((r) => (
                    <div
                        key={r}
                        className="flex h-16 items-center justify-center text-xs text-zinc-500 w-4"
                    >
                      {r}
                    </div>
                ))}
              </div>

              {/* Board grid */}
              <div className="grid grid-cols-8 overflow-hidden rounded-xl border border-zinc-400 flex-1">
                {boardRows.map((row, rowIndex) =>
                    row.map((piece, colIndex) => {
                      const square = displayToSquare(rowIndex, colIndex);
                      const isLight = (rowIndex + colIndex) % 2 === 0;
                      const isSelected = selectedSquare === square;
                      const isTarget = targetSquares.includes(square);
                      const isOccupied = !!piece;

                      let bg = isLight ? "bg-amber-100" : "bg-amber-800";
                      if (isSelected) bg = "bg-yellow-400";
                      if (isTarget) bg = isOccupied
                          ? "bg-rose-400"   // capture square
                          : isLight
                              ? "bg-emerald-200"
                              : "bg-emerald-600"; // move square

                      return (
                          <button
                              key={square}
                              onClick={() => handleSquareClick(rowIndex, colIndex)}
                              className={`flex h-16 items-center justify-center text-3xl ${bg} transition-colors`}
                          >
                            {/* Target dot for empty squares */}
                            {isTarget && !isOccupied ? (
                                <span className="h-3 w-3 rounded-full bg-emerald-700 opacity-60" />
                            ) : (
                                <span
                                    className={
                                      getColor(piece) === "white"
                                          ? "drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
                                          : ""
                                    }
                                >
                          {PIECES[piece] || ""}
                        </span>
                            )}
                          </button>
                      );
                    })
                )}
              </div>
            </div>
          </div>

          {/* Side panel */}
          <div>
            <h2 className="mb-2 text-xl font-semibold">Move History</h2>
            <div className="mb-4 max-h-72 overflow-y-auto rounded-md border border-zinc-300 p-3 text-sm font-mono">
              {game?.moveHistory?.length ? (
                  <div className="grid grid-cols-2 gap-x-4">
                    {game.moveHistory.reduce((pairs, move, index) => {
                      if (index % 2 === 0) {
                        pairs.push([move]);
                      } else {
                        pairs[pairs.length - 1].push(move);
                      }
                      return pairs;
                    }, []).map((pair, index) => (
                        <div key={index} className="contents">
                          <span className="text-zinc-500">{index + 1}.</span>
                          <span>{pair[0]}</span>
                          {pair[1] ? <span className="col-start-2">{pair[1]}</span> : <span />}
                        </div>
                    ))}
                  </div>
              ) : (
                  <p className="text-zinc-500">No moves yet</p>
              )}
            </div>

            {/* Game Over display */}
            {isGameOver && (
                <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-lg font-bold">
                    {game?.status === "RESIGNED" && `${game.winner} wins by resignation`}
                    {game?.status === "CHECKMATE" && `Checkmate! ${game.winner} wins`}
                    {game?.status === "STALEMATE" && "Stalemate — Draw"}
                    {game?.status === "DRAW" && "Draw agreed"}
                  </p>
                </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {!isGameOver && (
                  <>
                    <button
                        onClick={resign}
                        className="rounded-md bg-rose-600 px-3 py-2 text-white text-sm hover:bg-rose-700"
                    >
                      Resign
                    </button>
                    <button
                        onClick={declareDraw}
                        className="rounded-md bg-amber-600 px-3 py-2 text-white text-sm hover:bg-amber-700"
                    >
                      Offer Draw
                    </button>
                  </>
              )}
              <button
                  onClick={reset}
                  className="rounded-md bg-indigo-600 px-3 py-2 text-white text-sm hover:bg-indigo-700"
              >
                {isGameOver ? "Play Again" : "Reset"}
              </button>
            </div>
          </div>
        </div>
      </div>
  );
}