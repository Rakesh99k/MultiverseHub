package com.multiplayer.backend.model;

public class GameState {

    private String[][] board;
    private String currentPlayer;
    private String winner;

    public GameState() {
        // Initialize 3x3 board with "-"
        this.board = new String[3][3];
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
                board[i][j] = "-";
            }
        }
        this.currentPlayer = "X"; // X always starts
        this.winner = null;
    }

    public String[][] getBoard() {
        return board;
    }

    public void setBoard(String[][] board) {
        this.board = board;
    }

    public String getCurrentPlayer() {
        return currentPlayer;
    }

    public void setCurrentPlayer(String currentPlayer) {
        this.currentPlayer = currentPlayer;
    }

    public String getWinner() {
        return winner;
    }

    public void setWinner(String winner) {
        this.winner = winner;
    }

    /** Switch to the other player’s turn */
    public void switchPlayer() {
        this.currentPlayer = this.currentPlayer.equals("X") ? "O" : "X";
    }
}
