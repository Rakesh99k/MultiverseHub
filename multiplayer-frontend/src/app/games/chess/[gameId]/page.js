"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { chessApi } from "@/lib/api";
import { createRealtimeClient } from "@/lib/websocket";
import { useSession } from "@/context/SessionContext";
import { useToast } from "@/components/ToastProvider";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

const PIECES = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

function parseFenBoard(fen) {
  return fen.split(" ")[0].split("/").map((rank) => {
    const row = [];
    for (const char of rank) {
      if (/\d/.test(char)) {
        for (let i = 0; i < Number(char); i++) row.push("");
      } else {
        row.push(char);
      }
    }
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
  const params   = useParams();
  const gameId   = params?.gameId;
  const { playerName } = useSession();
  const toast    = useToast();

  const [game,           setGame]           = useState(null);
  const [selectedSquare, setSelectedSquare] = useState("");
  const [targetSquares,  setTargetSquares]  = useState([]);
  const [loading,        setLoading]        = useState(true);

  const moveHistoryRef = useRef(null);

  // ─── Load game ─────────────────────────────────────────────────────────────
  const loadGame = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const data = await chessApi.getGame(gameId);
      setGame(data);
    } catch (err) {
      toast.error(err.message || "Unable to load game");
    } finally {
      setLoading(false);
    }
  }, [gameId, toast]);

  // ─── WebSocket ─────────────────────────────────────────────────────────────
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

  // Auto-scroll move history
  useEffect(() => {
    if (moveHistoryRef.current) {
      moveHistoryRef.current.scrollTop = moveHistoryRef.current.scrollHeight;
    }
  }, [game?.moveHistory]);

  // ─── Computed ──────────────────────────────────────────────────────────────
  const fen = game?.fen || "";

  const rawBoardRows = useMemo(() => {
    if (!fen) return [];
    return parseFenBoard(fen);
  }, [fen]);

  const legalMoves = useMemo(() => {
    if (!fen) return [];
    try { return new Chess(fen).moves({ verbose: true }); }
    catch { return []; }
  }, [fen]);

  const playerColor = useMemo(() => {
    if (!game || !playerName) return "";
    if (game.playerWhite === playerName) return "white";
    if (game.playerBlack === playerName) return "black";
    return "";
  }, [game, playerName]);

  const isMyTurn = useMemo(() => {
    if (!game || !playerColor) return false;
    return game.currentTurn === playerColor;
  }, [game, playerColor]);

  // Flip board for black
  const boardRows = useMemo(() => {
    if (playerColor === "black") {
      return [...rawBoardRows].reverse().map((row) => [...row].reverse());
    }
    return rawBoardRows;
  }, [rawBoardRows, playerColor]);

  const displayFiles = playerColor === "black" ? [...FILES].reverse() : FILES;
  const displayRanks = playerColor === "black"
      ? [1, 2, 3, 4, 5, 6, 7, 8]
      : [8, 7, 6, 5, 4, 3, 2, 1];

  const isGameOver = useMemo(() =>
          !!game?.winner ||
          ["CHECKMATE","STALEMATE","DRAW","RESIGNED"].includes(game?.status),
      [game]
  );

  // ─── Square helpers ────────────────────────────────────────────────────────
  function displayToSquare(rowIndex, colIndex) {
    if (playerColor === "black") {
      return squareFromIndex(7 - rowIndex, 7 - colIndex);
    }
    return squareFromIndex(rowIndex, colIndex);
  }

  // ─── Move submission ───────────────────────────────────────────────────────
  async function submitMove(from, to) {
    const matching = legalMoves.filter(
        (m) => m.from === from && m.to === to
    );
    if (matching.length === 0) {
      toast.warning("Illegal move");
      setSelectedSquare("");
      setTargetSquares([]);
      return;
    }

    const preferred = matching.find((m) => m.promotion === "q") || matching[0];
    const uci = `${preferred.from}${preferred.to}${preferred.promotion || ""}`;

    try {
      const updated = await chessApi.move(gameId, playerName, uci);
      setGame(updated);
      setSelectedSquare("");
      setTargetSquares([]);

      // Notify on special states
      if (updated.status === "CHECKMATE") {
        toast.success(`Checkmate! ${updated.winner} wins! 🏆`);
      } else if (updated.status === "CHECK") {
        toast.warning("Check! ⚠️");
      } else if (updated.status === "STALEMATE") {
        toast.info("Stalemate — it's a draw!");
      }
    } catch (err) {
      toast.error(err.message || "Move failed");
    }
  }

  // ─── Click handler ─────────────────────────────────────────────────────────
  function handleSquareClick(rowIndex, colIndex) {
    const square = displayToSquare(rowIndex, colIndex);
    const piece  = boardRows[rowIndex]?.[colIndex] || "";

    if (isGameOver) return;

    if (!playerColor) {
      toast.info("You are spectating this game");
      return;
    }

    if (!isMyTurn) {
      toast.warning(`It's ${game?.currentTurn}'s turn`);
      return;
    }

    // No selection yet
    if (!selectedSquare) {
      if (!piece) return;

      if (getColor(piece) !== playerColor) {
        toast.warning("That's not your piece");
        return;
      }

      const targets = legalMoves
          .filter((m) => m.from === square)
          .map((m) => m.to);

      if (targets.length === 0) {
        toast.warning("No legal moves from that square");
        return;
      }

      setSelectedSquare(square);
      setTargetSquares(targets);
      return;
    }

    // Deselect
    if (square === selectedSquare) {
      setSelectedSquare("");
      setTargetSquares([]);
      return;
    }

    // Re-select own piece
    if (piece && getColor(piece) === playerColor) {
      const targets = legalMoves
          .filter((m) => m.from === square)
          .map((m) => m.to);
      setSelectedSquare(square);
      setTargetSquares(targets);
      return;
    }

    // Attempt move
    submitMove(selectedSquare, square);
  }

  // ─── Game actions ──────────────────────────────────────────────────────────
  async function resign() {
    if (!playerName) return;
    try {
      const updated = await chessApi.resign(gameId, playerName);
      setGame(updated);
      toast.info("You resigned. Better luck next time!");
    } catch (err) {
      toast.error(err.message || "Unable to resign");
    }
  }

  async function declareDraw() {
    try {
      const updated = await chessApi.draw(gameId);
      setGame(updated);
      toast.info("Draw agreed 🤝");
    } catch (err) {
      toast.error(err.message || "Unable to declare draw");
    }
  }

  async function reset() {
    try {
      const updated = await chessApi.reset(gameId);
      setGame(updated);
      setSelectedSquare("");
      setTargetSquares([]);
      toast.success("Game reset — White goes first!");
    } catch (err) {
      toast.error(err.message || "Unable to reset");
    }
  }

  // ─── Cell styling ──────────────────────────────────────────────────────────
  function getSquareStyle(rowIndex, colIndex) {
    const square     = displayToSquare(rowIndex, colIndex);
    const isLight    = (rowIndex + colIndex) % 2 === 0;
    const isSelected = selectedSquare === square;
    const isTarget   = targetSquares.includes(square);
    const piece      = boardRows[rowIndex]?.[colIndex] || "";
    const isOccupied = !!piece;

    let bg = isLight ? "bg-amber-100" : "bg-amber-800";
    if (isSelected)                   bg = "bg-yellow-400";
    else if (isTarget && isOccupied)  bg = "bg-rose-400";
    else if (isTarget)                bg = isLight ? "bg-emerald-200" : "bg-emerald-700";

    return `relative flex h-14 w-14 items-center justify-center text-3xl transition-colors ${bg}`;
  }

  // ─── Move history pairs ────────────────────────────────────────────────────
  const movePairs = useMemo(() => {
    if (!game?.moveHistory) return [];
    const pairs = [];
    for (let i = 0; i < game.moveHistory.length; i += 2) {
      pairs.push({
        num:   Math.floor(i / 2) + 1,
        white: game.moveHistory[i],
        black: game.moveHistory[i + 1] || "",
      });
    }
    return pairs;
  }, [game?.moveHistory]);

  // ─── Status display ────────────────────────────────────────────────────────
  const statusConfig = {
    PLAYING:   { color: "bg-emerald-100 text-emerald-800", label: "Playing" },
    CHECK:     { color: "bg-amber-100 text-amber-800",     label: "⚠️ Check!" },
    CHECKMATE: { color: "bg-rose-100 text-rose-800",       label: "Checkmate" },
    STALEMATE: { color: "bg-gray-100 text-gray-700",       label: "Stalemate" },
    DRAW:      { color: "bg-gray-100 text-gray-700",       label: "Draw" },
    RESIGNED:  { color: "bg-rose-100 text-rose-800",       label: "Resigned" },
  }[game?.status] || { color: "bg-gray-100 text-gray-600", label: game?.status };

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-gray-500">Loading chess game...</p>
        </div>
    );
  }

  return (
      <div className="mx-auto max-w-6xl p-6">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">♟️ Chess</h1>
          <Link
              href="/lobby"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ← Lobbies
          </Link>
        </div>

        {/* Player info bar */}
        <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-gray-400">White ♔</p>
            <p className={`font-semibold ${game?.currentTurn === "white" && !isGameOver ? "text-blue-700" : "text-gray-900"}`}>
              {game?.playerWhite || "-"}
              {game?.currentTurn === "white" && !isGameOver && " •"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Black ♚</p>
            <p className={`font-semibold ${game?.currentTurn === "black" && !isGameOver ? "text-blue-700" : "text-gray-900"}`}>
              {game?.playerBlack || "-"}
              {game?.currentTurn === "black" && !isGameOver && " •"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">You are</p>
            <p className="font-semibold text-gray-900">
              {playerColor
                  ? `${playerColor.charAt(0).toUpperCase() + playerColor.slice(1)}`
                  : "Spectator"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Status</p>
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
          </div>
        </div>

        {/* Turn indicator */}
        {!isGameOver && (
            <div className={`mb-4 rounded-lg px-4 py-2.5 text-sm font-medium ${
                isMyTurn
                    ? "bg-blue-50 text-blue-700"
                    : "bg-gray-50 text-gray-600"
            }`}>
              {isMyTurn
                  ? "✅ Your turn — click a piece to move"
                  : `⏳ Waiting for ${game?.currentTurn === "white" ? game?.playerWhite : game?.playerBlack}...`}
            </div>
        )}

        {/* Game over banner */}
        {isGameOver && (
            <div className="mb-4 rounded-xl border border-gray-200 bg-white px-5 py-4 text-center shadow-sm">
              <p className="text-xl font-bold text-gray-900">
                {game?.status === "CHECKMATE" && `♟️ Checkmate! ${game.winner} wins!`}
                {game?.status === "STALEMATE" && "🤝 Stalemate — Draw!"}
                {game?.status === "DRAW"      && "🤝 Draw agreed!"}
                {game?.status === "RESIGNED"  && `🏳️ ${game.winner} wins by resignation`}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {game?.moveCount} moves played
              </p>
            </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">

          {/* Board with coordinates */}
          <div>
            {/* File labels — top */}
            <div className="mb-1 flex pl-6">
              {displayFiles.map((f) => (
                  <div key={f} className="flex w-14 items-center justify-center text-xs font-medium text-gray-400">
                    {f}
                  </div>
              ))}
            </div>

            <div className="flex">
              {/* Rank labels — left */}
              <div className="flex flex-col pr-2">
                {displayRanks.map((r) => (
                    <div key={r} className="flex h-14 items-center justify-center text-xs font-medium text-gray-400 w-4">
                      {r}
                    </div>
                ))}
              </div>

              {/* Board */}
              <div className="overflow-hidden rounded-xl border-2 border-gray-400 shadow-lg">
                <div className="grid grid-cols-8">
                  {boardRows.map((row, rowIndex) =>
                      row.map((piece, colIndex) => {
                        const square     = displayToSquare(rowIndex, colIndex);
                        const isTarget   = targetSquares.includes(square);
                        const isOccupied = !!piece;

                        return (
                            <button
                                key={square}
                                onClick={() => handleSquareClick(rowIndex, colIndex)}
                                className={getSquareStyle(rowIndex, colIndex)}
                            >
                              {/* Move dot for empty target squares */}
                              {isTarget && !isOccupied && (
                                  <span className="absolute h-4 w-4 rounded-full bg-emerald-700 opacity-50" />
                              )}

                              {/* Capture ring for occupied target squares */}
                              {isTarget && isOccupied && (
                                  <span className="absolute inset-0 rounded-sm ring-4 ring-inset ring-rose-500 opacity-70" />
                              )}

                              {/* Piece */}
                              <span className={`relative z-10 select-none leading-none ${
                                  getColor(piece) === "white"
                                      ? "drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                                      : "drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)]"
                              }`}>
                          {PIECES[piece] || ""}
                        </span>
                            </button>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Rank labels — right */}
              <div className="flex flex-col pl-2">
                {displayRanks.map((r) => (
                    <div key={r} className="flex h-14 items-center justify-center text-xs font-medium text-gray-400 w-4">
                      {r}
                    </div>
                ))}
              </div>
            </div>

            {/* File labels — bottom */}
            <div className="mt-1 flex pl-6">
              {displayFiles.map((f) => (
                  <div key={f} className="flex w-14 items-center justify-center text-xs font-medium text-gray-400">
                    {f}
                  </div>
              ))}
            </div>
          </div>

          {/* Side panel */}
          <div className="flex flex-col gap-4">

            {/* Move history */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-700">
                Move History
                <span className="ml-2 text-xs font-normal text-gray-400">
                ({game?.moveCount || 0} moves)
              </span>
              </h2>
              <div
                  ref={moveHistoryRef}
                  className="h-48 overflow-y-auto rounded-lg bg-gray-50 p-2 font-mono text-sm"
              >
                {movePairs.length === 0 ? (
                    <p className="text-center text-gray-400">No moves yet</p>
                ) : (
                    <table className="w-full">
                      <tbody>
                      {movePairs.map((pair) => (
                          <tr key={pair.num} className="hover:bg-gray-100">
                            <td className="w-8 py-0.5 pr-2 text-right text-xs text-gray-400">
                              {pair.num}.
                            </td>
                            <td className="py-0.5 pr-4 font-medium text-gray-800">
                              {pair.white}
                            </td>
                            <td className="py-0.5 text-gray-600">
                              {pair.black}
                            </td>
                          </tr>
                      ))}
                      </tbody>
                    </table>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-700">
                Actions
              </h2>
              <div className="flex flex-wrap gap-2">
                {!isGameOver && playerColor && (
                    <>
                      <button
                          onClick={resign}
                          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
                      >
                        🏳️ Resign
                      </button>
                      <button
                          onClick={declareDraw}
                          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
                      >
                        🤝 Draw
                      </button>
                    </>
                )}
                <button
                    onClick={reset}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  {isGameOver ? "🔄 Play Again" : "🔄 Reset"}
                </button>
              </div>
            </div>

            {/* Keyboard tip for chess */}
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs text-gray-500">
              <p className="font-medium text-gray-600 mb-1">How to play</p>
              <p>Click a piece to see legal moves highlighted in green.</p>
              <p className="mt-1">Click a highlighted square to move there.</p>
              <p className="mt-1">Captures are highlighted in red.</p>
            </div>
          </div>
        </div>
      </div>
  );
}