package com.multiplayer.backend.service;

import com.multiplayer.backend.model.SudokuGameState;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Sudoku service: generates puzzles, validates moves, tracks per-player progress.
 */
@Service
public class SudokuService {

    private final ConcurrentMap<String, SudokuGameState> games = new ConcurrentHashMap<>();
    private final Random random = new Random();

    /**
     * Create a new Sudoku game.
     * @param gameId    unique id
     * @param difficulty "easy" (40 clues), "medium" (32), "hard" (26)
     * @param mode      "collaborative" or "competitive"
     */
    public SudokuGameState createGame(String gameId, String difficulty, String mode) {
        if (gameId == null || gameId.isBlank()) return null;
        if (difficulty == null) difficulty = "medium";
        if (mode == null) mode = "collaborative";

        int clues = switch (difficulty.toLowerCase()) {
            case "easy" -> 40;
            case "hard" -> 26;
            default -> 32;
        };

        int[][] solution = generateFullBoard();
        int[][] puzzle = removeCells(solution, 81 - clues);
        boolean[][] fixed = new boolean[9][9];
        for (int r = 0; r < 9; r++)
            for (int c = 0; c < 9; c++)
                fixed[r][c] = puzzle[r][c] != 0;

        SudokuGameState state = new SudokuGameState();
        state.setSolution(solution);
        state.setInitialBoard(deepCopy(puzzle));
        state.setBoard(deepCopy(puzzle));
        state.setFixed(fixed);
        state.setDifficulty(difficulty.toLowerCase());
        state.setMode(mode.toLowerCase());

        games.put(gameId, state);
        return state;
    }

    public SudokuGameState getGame(String gameId) {
        return games.get(gameId);
    }

    public SudokuGameState joinGame(String gameId, String playerName) {
        SudokuGameState s = games.get(gameId);
        if (s == null || playerName == null || playerName.isBlank()) return null;
        if (!s.getPlayers().contains(playerName)) {
            s.getPlayers().add(playerName);
        }
        return s;
    }

    /**
     * Make a move: place value at (row, col) by playerName.
     * Returns updated state. Move is rejected silently if:
     *  - game over, cell is fixed (clue), out of range, or value not 1-9
     */
    public SudokuGameState makeMove(String gameId, String playerName, int row, int col, int value) {
        SudokuGameState s = games.get(gameId);
        if (s == null) return null;
        if ("COMPLETED".equals(s.getStatus())) return s;
        if (row < 0 || row > 8 || col < 0 || col > 8) return s;
        if (value < 0 || value > 9) return s; // 0 = erase
        if (s.getFixed()[row][col]) return s; // cannot overwrite a clue
        if (playerName == null || playerName.isBlank()) return s;

        s.getBoard()[row][col] = value;

        boolean correct = (value != 0) && (value == s.getSolution()[row][col]);
        s.getMoveHistory().add(new SudokuGameState.MoveRecord(playerName, row, col, value, correct));

        if (value != 0 && !correct) {
            s.setMistakes(s.getMistakes() + 1);
        }

        // Check completion
        if (isBoardComplete(s.getBoard(), s.getSolution())) {
            s.setStatus("COMPLETED");
            if ("competitive".equals(s.getMode())) {
                s.setWinner(playerName);
            } else {
                s.setWinner("ALL");
            }
        }
        return s;
    }

    /** Get a hint: returns the correct value for a cell (does not place it). */
    public Integer getHint(String gameId, int row, int col) {
        SudokuGameState s = games.get(gameId);
        if (s == null) return null;
        if (row < 0 || row > 8 || col < 0 || col > 8) return null;
        return s.getSolution()[row][col];
    }

    /** Validate current board: returns list of "row,col" strings that are wrong. */
    public List<String> validateBoard(String gameId) {
        SudokuGameState s = games.get(gameId);
        if (s == null) return null;
        List<String> wrong = new ArrayList<>();
        for (int r = 0; r < 9; r++) {
            for (int c = 0; c < 9; c++) {
                int v = s.getBoard()[r][c];
                if (v != 0 && v != s.getSolution()[r][c]) {
                    wrong.add(r + "," + c);
                }
            }
        }
        return wrong;
    }

    public boolean resetGame(String gameId) {
        SudokuGameState s = games.get(gameId);
        if (s == null) return false;
        s.setBoard(deepCopy(s.getInitialBoard()));
        s.getMoveHistory().clear();
        s.setMistakes(0);
        s.setStatus("PLAYING");
        s.setWinner(null);
        return true;
    }

    public boolean deleteGame(String gameId) {
        return games.remove(gameId) != null;
    }

    // ============ Internal helpers ============

    private boolean isBoardComplete(int[][] board, int[][] solution) {
        for (int r = 0; r < 9; r++)
            for (int c = 0; c < 9; c++)
                if (board[r][c] != solution[r][c]) return false;
        return true;
    }

    private int[][] deepCopy(int[][] src) {
        int[][] dst = new int[9][9];
        for (int r = 0; r < 9; r++)
            System.arraycopy(src[r], 0, dst[r], 0, 9);
        return dst;
    }

    /** Generate a complete valid Sudoku board using randomized backtracking. */
    private int[][] generateFullBoard() {
        int[][] board = new int[9][9];
        fillBoard(board);
        return board;
    }

    private boolean fillBoard(int[][] board) {
        for (int r = 0; r < 9; r++) {
            for (int c = 0; c < 9; c++) {
                if (board[r][c] == 0) {
                    List<Integer> nums = Arrays.asList(1, 2, 3, 4, 5, 6, 7, 8, 9);
                    Collections.shuffle(nums, random);
                    for (int n : nums) {
                        if (isValidPlacement(board, r, c, n)) {
                            board[r][c] = n;
                            if (fillBoard(board)) return true;
                            board[r][c] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }

    private boolean isValidPlacement(int[][] board, int row, int col, int val) {
        for (int i = 0; i < 9; i++) {
            if (board[row][i] == val) return false;
            if (board[i][col] == val) return false;
        }
        int br = (row / 3) * 3, bc = (col / 3) * 3;
        for (int r = br; r < br + 3; r++)
            for (int c = bc; c < bc + 3; c++)
                if (board[r][c] == val) return false;
        return true;
    }

    /** Remove cells from a full board to create a puzzle. */
    private int[][] removeCells(int[][] full, int toRemove) {
        int[][] puzzle = deepCopy(full);
        List<int[]> cells = new ArrayList<>();
        for (int r = 0; r < 9; r++)
            for (int c = 0; c < 9; c++)
                cells.add(new int[]{r, c});
        Collections.shuffle(cells, random);
        int removed = 0;
        for (int[] rc : cells) {
            if (removed >= toRemove) break;
            puzzle[rc[0]][rc[1]] = 0;
            removed++;
        }
        return puzzle;
    }
}
