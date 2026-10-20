"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chessApi } from "@/lib/api";
import { createRealtimeClient } from "@/lib/websocket";
import { useSession } from "@/context/SessionContext";
import { useToast } from "@/components/ToastProvider";
import GameOverModal from "@/components/GameOverModal";

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
  const params = useParams();
  const gameId = params?.gameId;
  const { playerName } = useSession();
  const toast = useToast();

  const [game, setGame] = useState(null);
  const [selectedSquare, setSelectedSquare] = useState("");
  const [targetSquares, setTargetSquares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

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
          if (data) {
            setGame(data);
            const isOver = ["CHECKMATE", "STALEMATE", "DRAW", "RESIGNED"].includes(data.status);
            if (isOver) {
              setModalOpen(true);
            }
          }
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
          ["CHECKMATE", "STALEMATE", "DRAW", "RESIGNED"].includes(game?.status),
      [game]
  );

  // Modal Computed Props
  const modalResult = useMemo(() => {
    if (!game?.winner || game.winner === "DRAW") return "draw";
    return game.winner === playerColor ? "win" : "loss";
  }, [game?.winner, playerColor]);

  const modalTitle = useMemo(() => {
    if (game?.status === "CHECKMATE") return "Checkmate!";
    if (game?.status === "STALEMATE") return "Stalemate!";
    if (game?.status === "DRAW") return "Draw Game!";
    if (game?.status === "RESIGNED") return "Resigned!";
    return "Match Concluded";
  }, [game?.status]);

  const modalSubtitle = useMemo(() => {
    if (game?.winner === "DRAW") return "Stalemate or agreed draw.";
    const winningPlayer = game?.winner === "white" ? game?.playerWhite : game?.playerBlack;
    return `Victory belongs to ${winningPlayer}!`;
  }, [game]);

  // ─── Square helpers ────────────────────────────────────────────────────────
  function displayToSquare(rowIndex, colIndex) {
    if (playerColor === "black") {
      return squareFromIndex(7 - rowIndex, 7 - colIndex);
    }
    return squareFromIndex(rowIndex, colIndex);
  }

  // ─── Move submission ───────────────────────────────────────────────────────
  async function submitMove(from, to) {
    const uci = `${from}${to}`;

    try {
      const updated = await chessApi.move(gameId, playerName, uci);
      setGame(updated);
      setSelectedSquare("");
      setTargetSquares([]);

      if (["CHECKMATE", "STALEMATE", "DRAW", "RESIGNED"].includes(updated.status)) {
        setModalOpen(true);
      } else if (updated.status === "CHECK") {
        toast.warning("Check! ⚠️");
      }
    } catch (err) {
      toast.error(err.message || "Move failed");
      setSelectedSquare("");
      setTargetSquares([]);
    }
  }

  // ─── Click handler ─────────────────────────────────────────────────────────
  function handleSquareClick(rowIndex, colIndex) {
    const square = displayToSquare(rowIndex, colIndex);
    const piece = boardRows[rowIndex]?.[colIndex] || "";

    if (isGameOver) return;

    if (!playerColor) {
      toast.info("You are spectating this game");
      return;
    }

    if (!isMyTurn) {
      toast.warning(`It's ${game?.currentTurn}'s turn`);
      return;
    }

    if (!selectedSquare) {
      if (!piece) return;

      if (getColor(piece) !== playerColor) {
        toast.warning("That's not your piece");
        return;
      }

      setSelectedSquare(square);
      setTargetSquares([]);
      return;
    }

    if (square === selectedSquare) {
      setSelectedSquare("");
      setTargetSquares([]);
      return;
    }

    if (piece && getColor(piece) === playerColor) {
      setSelectedSquare(square);
      setTargetSquares([]);
      return;
    }

    submitMove(selectedSquare, square);
  }

  // ─── Game actions ──────────────────────────────────────────────────────────
  async function resign() {
    if (!playerName) return;
    try {
      const updated = await chessApi.resign(gameId, playerName);
      setGame(updated);
      setModalOpen(true);
      toast.info("You resigned.");
    } catch (err) {
      toast.error(err.message || "Unable to resign");
    }
  }

  async function declareDraw() {
    try {
      const updated = await chessApi.draw(gameId);
      setGame(updated);
      setModalOpen(true);
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
      setModalOpen(false);
      toast.success("Game reset — White goes first!");
    } catch (err) {
      toast.error(err.message || "Unable to reset");
    }
  }

  // ─── Cell styling ──────────────────────────────────────────────────────────
  function getSquareStyle(rowIndex, colIndex) {
    const square = displayToSquare(rowIndex, colIndex);
    const isLight = (rowIndex + colIndex) % 2 === 0;
    const isSelected = selectedSquare === square;

    let bg = isLight ? "bg-amber-100" : "bg-amber-800";
    if (isSelected) bg = "bg-yellow-400";

    return `relative flex h-14 w-14 items-center justify-center text-3xl transition-colors cursor-pointer ${bg}`;
  }

  // ─── Move history pairs ────────────────────────────────────────────────────
  const movePairs = useMemo(() => {
    if (!game?.moveHistory) return [];
    const pairs = [];
    for (let i = 0; i < game.moveHistory.length; i += 2) {
      pairs.push({
        num: Math.floor(i / 2) + 1,
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

  if (loading) {
    return (
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-gray-500">Loading chess game...</p>
        </div>
    );
  }

  return (
      <div className="mx-auto max-w-6xl p-6">

        <GameOverModal
            isOpen={modalOpen}
            title={modalTitle}
            subtitle={modalSubtitle}
            emoji={modalResult === "win" ? "🏆" : modalResult === "loss" ? "🏳️" : "🤝"}
            result={modalResult}
            stats={[
              { label: "Your Color", value: playerColor || "Spectator" },
              { label: "Total Moves", value: `${game?.moveCount || 0}` },
            ]}
            onRematch={reset}
            onClose={() => setModalOpen(false)}
        />

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
                  ? "✅ Your turn — click a piece then click the destination"
                  : `⏳ Waiting for ${game?.currentTurn === "white" ? game?.playerWhite : game?.playerBlack}...`}
            </div>
        )}

        {/* Game over banner (clickable to reopen modal) */}
        {isGameOver && (
            <div
                onClick={() => setModalOpen(true)}
                className="mb-4 rounded-xl border border-gray-200 bg-white px-5 py-4 text-center shadow-sm cursor-pointer hover:bg-gray-50"
            >
              <p className="text-xl font-bold text-gray-900">
                {game?.status === "CHECKMATE" && `♟️ Checkmate! ${game.winner} wins! (Review Stats)`}
                {game?.status === "STALEMATE" && "🤝 Stalemate — Draw! (Review Stats)"}
                {game?.status === "DRAW"      && "🤝 Draw agreed! (Review Stats)"}
                {game?.status === "RESIGNED"  && `🏳️ ${game.winner} wins by resignation (Review Stats)`}
              </p>
            </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">

          {/* Board with coordinates */}
          <div>
            <div className="mb-1 flex pl-6">
              {displayFiles.map((f) => (
                  <div key={f} className="flex w-14 items-center justify-center text-xs font-medium text-gray-400">
                    {f}
                  </div>
              ))}
            </div>

            <div className="flex">
              <div className="flex flex-col pr-2">
                {displayRanks.map((r) => (
                    <div key={r} className="flex h-14 items-center justify-center text-xs font-medium text-gray-400 w-4">
                      {r}
                    </div>
                ))}
              </div>

              <div className="overflow-hidden rounded-xl border-2 border-gray-400 shadow-lg">
                <div className="grid grid-cols-8">
                  {boardRows.map((row, rowIndex) =>
                      row.map((piece, colIndex) => {
                        const square = displayToSquare(rowIndex, colIndex);

                        return (
                            <button
                                key={square}
                                onClick={() => handleSquareClick(rowIndex, colIndex)}
                                className={getSquareStyle(rowIndex, colIndex)}
                            >
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

              <div className="flex flex-col pl-2">
                {displayRanks.map((r) => (
                    <div key={r} className="flex h-14 items-center justify-center text-xs font-medium text-gray-400 w-4">
                      {r}
                    </div>
                ))}
              </div>
            </div>

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
                          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 cursor-pointer"
                      >
                        🏳️ Resign
                      </button>
                      <button
                          onClick={declareDraw}
                          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 cursor-pointer"
                      >
                        🤝 Draw
                      </button>
                    </>
                )}
                <button
                    onClick={reset}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 cursor-pointer"
                >
                  {isGameOver ? "🔄 Play Again" : "🔄 Reset"}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs text-gray-500">
              <p className="font-medium text-gray-600 mb-1">How to play</p>
              <p>Click a piece to select it.</p>
              <p className="mt-1">Click the destination square to move.</p>
              <p className="mt-1">Promotions auto-promote to Queen.</p>
            </div>
          </div>
        </div>
      </div>
  );
}