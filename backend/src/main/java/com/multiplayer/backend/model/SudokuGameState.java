package com.multiplayer.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;

import java.util.ArrayList;
import java.util.List;

/**
 * Sudoku game state.
 * Supports both collaborative (players work together) and competitive (race to solve) modes.
 */
public class SudokuGameState {

    private int[][] board;          // current board (0 = empty)
    private int[][] initialBoard;   // the puzzle as given (immutable cells marked)
    private int[][] solution;       // the full solution — HIDDEN from frontend
    private boolean[][] fixed;      // true = clue cell, cannot be modified
    private List<String> players;
    private String difficulty;      // "easy", "medium", "hard"
    private String mode;            // "collaborative" or "competitive"
    private String winner;          // player name (competitive) / "ALL" (collaborative) / null
    private String status;          // "PLAYING", "COMPLETED"
    private List<MoveRecord> moveHistory;
    private int mistakes;           // total wrong moves (collaborative shared)

    public SudokuGameState() {
        this.players = new ArrayList<>();
        this.moveHistory = new ArrayList<>();
        this.status = "PLAYING";
        this.mistakes = 0;
    }

    public static class MoveRecord {
        private String playerName;
        private int row;
        private int col;
        private int value;
        private boolean correct;

        public MoveRecord() {}
        public MoveRecord(String playerName, int row, int col, int value, boolean correct) {
            this.playerName = playerName;
            this.row = row;
            this.col = col;
            this.value = value;
            this.correct = correct;
        }

        public String getPlayerName() { return playerName; }
        public void setPlayerName(String playerName) { this.playerName = playerName; }

        public int getRow() { return row; }
        public void setRow(int row) { this.row = row; }

        public int getCol() { return col; }
        public void setCol(int col) { this.col = col; }

        public int getValue() { return value; }
        public void setValue(int value) { this.value = value; }

        public boolean isCorrect() { return correct; }
        public void setCorrect(boolean correct) { this.correct = correct; }
    }

    // ---- Getters / Setters ----
    public int[][] getBoard() { return board; }
    public void setBoard(int[][] board) { this.board = board; }

    public int[][] getInitialBoard() { return initialBoard; }
    public void setInitialBoard(int[][] initialBoard) { this.initialBoard = initialBoard; }

    // Solution is HIDDEN from frontend — never serialized to JSON
    @JsonIgnore
    public int[][] getSolution() { return solution; }
    public void setSolution(int[][] solution) { this.solution = solution; }

    public boolean[][] getFixed() { return fixed; }
    public void setFixed(boolean[][] fixed) { this.fixed = fixed; }

    public List<String> getPlayers() { return players; }
    public void setPlayers(List<String> players) { this.players = players; }

    public String getDifficulty() { return difficulty; }
    public void setDifficulty(String difficulty) { this.difficulty = difficulty; }

    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }

    public String getWinner() { return winner; }
    public void setWinner(String winner) { this.winner = winner; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public List<MoveRecord> getMoveHistory() { return moveHistory; }
    public void setMoveHistory(List<MoveRecord> moveHistory) { this.moveHistory = moveHistory; }

    public int getMistakes() { return mistakes; }
    public void setMistakes(int mistakes) { this.mistakes = mistakes; }
}