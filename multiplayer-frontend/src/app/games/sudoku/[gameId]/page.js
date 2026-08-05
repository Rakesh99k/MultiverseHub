"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { sudokuApi } from "../../../../lib/api";
import { createRealtimeClient } from "../../../../lib/websocket";
import { useSession } from "../../../../context/SessionContext";

function keyForCell(row, col) {
  return `${row},${col}`;
}

export default function SudokuGamePage() {
  const params = useParams();
  const gameId = params?.gameId;
  const { playerName } = useSession();

  const [game, setGame] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [wrongCells, setWrongCells] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadGame = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const data = await sudokuApi.getGame(gameId);
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
        realtime.subscribe(`/topic/sudoku/${gameId}`, (data) => {
          if (data) {
            setGame(data);
          }
        });
      },
    });

    realtime.activate();
    return () => realtime.deactivate();
  }, [gameId, loadGame]);

  useEffect(() => {
    if (!gameId || !playerName.trim()) {
      return;
    }

    sudokuApi.join(gameId, playerName.trim()).then(setGame).catch(() => {});
  }, [gameId, playerName]);

  const canEditSelectedCell = useMemo(() => {
    if (!selectedCell || !game?.fixed) {
      return false;
    }

    const { row, col } = selectedCell;
    return !game.fixed[row][col];
  }, [selectedCell, game]);

  async function makeMove(value) {
    if (!selectedCell) {
      setError("Select a cell first");
      return;
    }

    if (!playerName.trim()) {
      setError("Set player name in lobby first");
      return;
    }

    const { row, col } = selectedCell;

    if (game.fixed[row][col]) {
      setError("You cannot change fixed clues");
      return;
    }

    try {
      const updated = await sudokuApi.move(gameId, playerName.trim(), row, col, value);
      setGame(updated);
      setError("");
    } catch (err) {
      setError(err.message || "Move failed");
    }
  }

  // Replace the requestHint function

  async function requestHint() {
    if (!selectedCell) {
      setError("Select a cell to get a hint");
      return;
    }

    const { row, col } = selectedCell;

    // Guard: cannot hint a fixed clue cell
    if (game?.fixed?.[row][col]) {
      setError("That cell is already a clue — select an empty cell");
      return;
    }

    // Guard: cannot hint an already correctly filled cell
    if (game?.board?.[row][col] !== 0 &&
        game?.board?.[row][col] === game?.solution?.[row][col]) {
      setError("That cell is already correct");
      return;
    }

    if (!playerName.trim()) {
      setError("Set your player name first");
      return;
    }

    try {
      const hint = await sudokuApi.hint(gameId, row, col);
      const updated = await sudokuApi.move(
          gameId,
          playerName.trim(),
          hint.row,
          hint.col,
          hint.value
      );
      setGame(updated);
      setError("");
    } catch (err) {
      setError(err.message || "Hint failed");
    }
  }

  async function validateBoard() {
    try {
      const result = await sudokuApi.validate(gameId);
      setWrongCells(new Set(result.wrongCells));
      setError("");
    } catch (err) {
      setError(err.message || "Validation failed");
    }
  }

  async function resetBoard() {
    try {
      const updated = await sudokuApi.reset(gameId);
      setGame(updated);
      setWrongCells(new Set());
      setError("");
    } catch (err) {
      setError(err.message || "Reset failed");
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-5xl p-6">Loading sudoku game...</div>;
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Sudoku</h1>
        <Link href="/lobby" className="rounded-md border border-zinc-300 px-3 py-1.5">
          Back to Lobby
        </Link>
      </div>

      <div className="mb-4 rounded-lg bg-zinc-50 p-4 text-sm">
        <p>Game ID: {gameId}</p>
        <p>Difficulty: {game?.difficulty}</p>
        <p>Mode: {game?.mode}</p>
        <p>Status: {game?.status}</p>
        <p>Winner: {game?.winner || "-"}</p>
        <p>Mistakes: {game?.mistakes ?? 0}</p>
      </div>

      {error ? <p className="mb-3 rounded-md bg-rose-100 px-3 py-2 text-rose-700">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[560px_1fr]">
        <div className="grid grid-cols-9 overflow-hidden rounded-xl border-2 border-zinc-800 bg-zinc-800">
          {game?.board?.map((row, rowIndex) =>
            row.map((value, colIndex) => {
              const isFixed = game.fixed[rowIndex][colIndex];
              const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
              const isWrong = wrongCells.has(keyForCell(rowIndex, colIndex));
              const thickRight = (colIndex + 1) % 3 === 0 && colIndex !== 8;
              const thickBottom = (rowIndex + 1) % 3 === 0 && rowIndex !== 8;

              return (
                <button
                  key={keyForCell(rowIndex, colIndex)}
                  onClick={() => setSelectedCell({ row: rowIndex, col: colIndex })}
                  className={`h-14 border border-zinc-300 bg-white text-lg font-semibold ${
                    isFixed ? "text-zinc-900" : "text-blue-700"
                  } ${isSelected ? "bg-amber-100" : ""} ${isWrong ? "bg-rose-100" : ""} ${
                    thickRight ? "border-r-2 border-r-zinc-800" : ""
                  } ${thickBottom ? "border-b-2 border-b-zinc-800" : ""}`}
                >
                  {value === 0 ? "" : value}
                </button>
              );
            })
          )}
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold">Controls</h2>
          <p className="mb-2 text-sm text-zinc-600">
            Selected: {selectedCell ? `${selectedCell.row},${selectedCell.col}` : "none"}
          </p>
          <p className="mb-3 text-sm text-zinc-600">
            Editable: {canEditSelectedCell ? "yes" : "no"}
          </p>

          <div className="mb-4 grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((value) => (
              <button
                key={value}
                onClick={() => makeMove(value)}
                className="rounded-md border border-zinc-300 px-3 py-2 hover:bg-zinc-100"
              >
                {value === 0 ? "Clear" : value}
              </button>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <button onClick={requestHint} className="rounded-md bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700">
              Hint
            </button>
            <button
              onClick={validateBoard}
              className="rounded-md bg-amber-600 px-3 py-2 text-white hover:bg-amber-700"
            >
              Validate
            </button>
            <button onClick={resetBoard} className="rounded-md bg-zinc-700 px-3 py-2 text-white hover:bg-zinc-800">
              Reset
            </button>
          </div>

          <h2 className="mb-2 text-xl font-semibold">Players</h2>
          {game?.players?.length ? (
            <ul className="space-y-1 text-sm">
              {game.players.map((player) => (
                <li key={player} className="rounded-md bg-zinc-100 px-2 py-1">
                  {player}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No players joined</p>
          )}
        </div>
      </div>
    </div>
  );
}
