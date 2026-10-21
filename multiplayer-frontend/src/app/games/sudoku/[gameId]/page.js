"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sudokuApi } from "@/lib/api";
import { createRealtimeClient } from "@/lib/websocket";
import { useSession } from "@/context/SessionContext";
import { useToast } from "@/components/ToastProvider";
import GameOverModal from "@/components/GameOverModal";

export default function SudokuGamePage() {
  const params = useParams();
  const gameId = params?.gameId;
  const { playerName } = useSession();
  const toast = useToast();

  const [game, setGame] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [wrongCells, setWrongCells] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const boardRef = useRef(null);

  const selectedCellRef = useRef(selectedCell);
  const gameRef = useRef(game);

  useEffect(() => { selectedCellRef.current = selectedCell; }, [selectedCell]);
  useEffect(() => { gameRef.current = game; }, [game]);

  // ─── Load game ─────────────────────────────────────────────────────────────
  const loadGame = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const data = await sudokuApi.getGame(gameId);
      setGame(data);
    } catch (err) {
      toast.error(err.message || "Unable to load game");
    } finally {
      setLoading(false);
    }
  }, [gameId, toast]);

  // ─── WebSocket + join ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameId) return;

    loadGame(true);

    const realtime = createRealtimeClient({
      onConnect: () => {
        realtime.subscribe(`/topic/sudoku/${gameId}`, (data) => {
          if (data) {
            setGame(data);
            if (data.status === "COMPLETED") {
              setModalOpen(true);
            }
          }
        });
      },
    });

    realtime.activate();
    return () => realtime.deactivate();
  }, [gameId, loadGame]);

  // Auto-join
  useEffect(() => {
    if (!gameId || !playerName.trim()) return;
    sudokuApi.join(gameId, playerName.trim()).then(setGame).catch(() => {});
  }, [gameId, playerName]);

  // ─── Move action ───────────────────
  const makeMove = useCallback(async (value) => {
    const cell = selectedCellRef.current;
    const currentGame = gameRef.current;

    if (!cell) {
      toast.info("Select a cell first");
      return;
    }

    if (!playerName.trim()) {
      toast.warning("Set your player name first");
      return;
    }

    const { row, col } = cell;

    if (currentGame?.fixed?.[row][col]) {
      toast.warning("That cell is a fixed clue — it cannot be changed");
      return;
    }

    if (currentGame?.status === "COMPLETED") {
      toast.info("The puzzle is already completed!");
      return;
    }

    try {
      const updated = await sudokuApi.move(
          gameId, playerName.trim(), row, col, value
      );
      setGame(updated);

      if (updated.status === "COMPLETED") {
        setModalOpen(true);
      }
    } catch (err) {
      toast.error(err.message || "Move failed");
    }
  }, [gameId, playerName, toast]);

  // ─── Keyboard handler ─────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        makeMove(parseInt(e.key));
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        makeMove(0);
        return;
      }

      const cell = selectedCellRef.current;
      if (!cell) return;

      const { row, col } = cell;
      let nextRow = row;
      let nextCol = col;

      if (e.key === "ArrowUp")    { e.preventDefault(); nextRow = Math.max(0, row - 1); }
      if (e.key === "ArrowDown")  { e.preventDefault(); nextRow = Math.min(8, row + 1); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); nextCol = Math.max(0, col - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); nextCol = Math.min(8, col + 1); }

      if (nextRow !== row || nextCol !== col) {
        setSelectedCell({ row: nextRow, col: nextCol });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [makeMove]);

  // ─── Computed ──────────────────────────────────────────────────────────────
  const canEditSelected = useMemo(() => {
    if (!selectedCell || !game?.fixed) return false;
    return !game.fixed[selectedCell.row][selectedCell.col];
  }, [selectedCell, game]);

  const isCompleted = game?.status === "COMPLETED";

  // Modal Props
  const modalResult = useMemo(() => {
    if (game?.mode === "collaborative") return "win"; // Everyone wins in collaborative
    return game?.winner === playerName.trim() ? "win" : "loss";
  }, [game, playerName]);

  const modalTitle = useMemo(() => {
    if (game?.mode === "collaborative") return "Puzzle Solved!";
    return game?.winner === playerName.trim() ? "Victory!" : "Defeat!";
  }, [game, playerName]);

  const modalSubtitle = useMemo(() => {
    if (game?.mode === "collaborative") return "Collaborative team victory! High five! 🙌";
    return `Winner: ${game?.winner} solved the final block!`;
  }, [game]);

  // ─── Actions ───────────────────────────────────────────────────────────────
  async function requestHint() {
    if (!selectedCell) {
      toast.info("Select a cell to get a hint");
      return;
    }

    const { row, col } = selectedCell;

    if (game?.fixed?.[row][col]) {
      toast.warning("That cell is already a clue");
      return;
    }

    if (!playerName.trim()) {
      toast.warning("Set your player name first");
      return;
    }

    try {
      const checkResult = await sudokuApi.checkCell(gameId, row, col);
      if (checkResult.correct) {
        toast.info("That cell is already correct!");
        return;
      }
    } catch {
      // proceed on check failure
    }

    try {
      const hint = await sudokuApi.hint(gameId, row, col);
      const updated = await sudokuApi.move(
          gameId, playerName.trim(), hint.row, hint.col, hint.value
      );
      setGame(updated);
      toast.success(`Hint: ${hint.value} placed at row ${row + 1}, col ${col + 1}`);
    } catch (err) {
      toast.error(err.message || "Hint failed");
    }
  }

  async function validateBoard() {
    try {
      const result = await sudokuApi.validate(gameId);
      setWrongCells(new Set(result.wrongCells));
      if (result.count === 0) {
        toast.success("No mistakes found! Looking good ✅");
      } else {
        toast.warning(`Found ${result.count} mistake(s) — highlighted in red`);
      }
    } catch (err) {
      toast.error(err.message || "Validation failed");
    }
  }

  async function resetBoard() {
    try {
      const updated = await sudokuApi.reset(gameId);
      setGame(updated);
      setWrongCells(new Set());
      setSelectedCell(null);
      setModalOpen(false);
      toast.success("Board reset to original puzzle");
    } catch (err) {
      toast.error(err.message || "Reset failed");
    }
  }

  // ─── Cell styling ──────────────────────────────────────────────────────────
  function getCellStyle(rowIndex, colIndex, value) {
    const isFixed = game?.fixed?.[rowIndex][colIndex];
    const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
    const isWrong = wrongCells.has(`${rowIndex},${colIndex}`);

    const inSameBox = selectedCell &&
        Math.floor(selectedCell.row / 3) === Math.floor(rowIndex / 3) &&
        Math.floor(selectedCell.col / 3) === Math.floor(colIndex / 3);

    const inSameLine = selectedCell &&
        (selectedCell.row === rowIndex || selectedCell.col === colIndex);

    const sameValue = selectedCell && value !== 0 &&
        game?.board?.[selectedCell.row]?.[selectedCell.col] === value;

    const thickRight = (colIndex + 1) % 3 === 0 && colIndex !== 8;
    const thickBottom = (rowIndex + 1) % 3 === 0 && rowIndex !== 8;

    let bg = "bg-white";
    if (isSelected)       bg = "bg-blue-200";
    else if (isWrong)     bg = "bg-rose-100";
    else if (sameValue)   bg = "bg-blue-100";
    else if (inSameBox)   bg = "bg-blue-50";
    else if (inSameLine)  bg = "bg-gray-50";

    let textColor = isFixed
        ? "text-gray-900 font-bold"
        : isWrong
            ? "text-rose-600 font-semibold"
            : "text-blue-600 font-semibold";

    let border = "border border-gray-300 ";
    if (thickRight)  border += "border-r-2 border-r-gray-700 ";
    if (thickBottom) border += "border-b-2 border-b-gray-700 ";

    return `h-12 w-12 text-base transition-colors cursor-pointer
      ${bg} ${textColor} ${border}
      hover:bg-blue-100`;
  }

  if (loading) {
    return (
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-gray-500">Loading sudoku...</p>
        </div>
    );
  }

  const difficultyColor = {
    easy:   "bg-emerald-100 text-emerald-700",
    medium: "bg-amber-100 text-amber-700",
    hard:   "bg-rose-100 text-rose-700",
  }[game?.difficulty] || "bg-gray-100 text-gray-600";

  return (
      <div className="mx-auto max-w-6xl p-6">

        <GameOverModal
            isOpen={modalOpen}
            title={modalTitle}
            subtitle={modalSubtitle}
            emoji="🧩"
            result={modalResult}
            stats={[
              { label: "Difficulty", value: game?.difficulty?.toUpperCase() || "" },
              { label: "Total Mistakes", value: `${game?.mistakes ?? 0}` },
            ]}
            onRematch={resetBoard}
            onClose={() => setModalOpen(false)}
        />

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">🔢 Sudoku</h1>
          <Link
              href="/lobby"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ← Lobbies
          </Link>
        </div>

        {/* Info bar */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${difficultyColor}`}>
          {game?.difficulty}
        </span>
          <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
          {game?.mode}
        </span>
          <span
              onClick={() => isCompleted && setModalOpen(true)}
              className={`rounded-full px-3 py-1 text-xs font-semibold cursor-pointer ${
                  isCompleted
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-blue-100 text-blue-700"
              }`}
          >
          {isCompleted ? "✅ Completed (Review Stats)" : "🎮 Playing"}
        </span>
          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
          ❌ Mistakes: {game?.mistakes ?? 0}
        </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">

          {/* Board */}
          <div>
            <p className="mb-2 text-xs text-gray-400">
              💡 Click a cell then use keyboard (1-9, Delete, Arrow keys)
            </p>

            <div
                ref={boardRef}
                className="inline-grid grid-cols-9 overflow-hidden rounded-xl border-2 border-gray-700 bg-gray-700 shadow-lg"
                tabIndex={0}
            >
              {game?.board?.map((row, rowIndex) =>
                  row.map((value, colIndex) => (
                      <button
                          key={`${rowIndex}-${colIndex}`}
                          onClick={() => setSelectedCell({ row: rowIndex, col: colIndex })}
                          className={getCellStyle(rowIndex, colIndex, value)}
                      >
                        {value === 0 ? "" : value}
                      </button>
                  ))
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-5">

            {/* Selected cell info */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">
                Selected Cell
              </h2>
              {selectedCell ? (
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-600">
                      Row {selectedCell.row + 1}, Col {selectedCell.col + 1}
                    </p>
                    <p className={canEditSelected ? "text-emerald-600" : "text-rose-500"}>
                      {canEditSelected ? "✏️ Editable" : "🔒 Fixed clue"}
                    </p>
                  </div>
              ) : (
                  <p className="text-sm text-gray-400">No cell selected</p>
              )}
            </div>

            {/* Number pad */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-700">
                Number Pad
                <span className="ml-2 text-xs font-normal text-gray-400">
                (or use keyboard)
              </span>
              </h2>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                        key={num}
                        onClick={() => makeMove(num)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-800 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                    >
                      {num}
                    </button>
                ))}
                <button
                    onClick={() => makeMove(0)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600 transition-colors"
                >
                  ⌫
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-700">
                Actions
              </h2>
              <div className="flex flex-col gap-2">
                <button
                    onClick={requestHint}
                    disabled={isCompleted}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 cursor-pointer"
                >
                  💡 Get Hint
                </button>
                <button
                    onClick={validateBoard}
                    className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 cursor-pointer"
                >
                  ✅ Validate Board
                </button>
                <button
                    onClick={resetBoard}
                    className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 cursor-pointer"
                >
                  🔄 Reset Puzzle
                </button>
              </div>
            </div>

            {/* Players */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-700">
                Players ({game?.players?.length || 0})
              </h2>
              {game?.players?.length ? (
                  <ul className="space-y-2">
                    {game.players.map((player) => (
                        <li
                            key={player}
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                                player === playerName.trim()
                                    ? "bg-blue-50 text-blue-800 font-medium"
                                    : "bg-gray-50 text-gray-700"
                            }`}
                        >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-xs font-bold text-white">
                      {player.charAt(0).toUpperCase()}
                    </span>
                          {player}
                          {player === playerName.trim() && (
                              <span className="ml-auto text-xs text-blue-500">You</span>
                          )}
                        </li>
                    ))}
                  </ul>
              ) : (
                  <p className="text-sm text-gray-400">No players yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
  );
}