package com.multiplayer.backend.model;

public class GameState {

    private String[][] board;
    private String currentPlayer;  // "X" or "O"
    private String winner;         // "X", "O", "DRAW", or null
    private String playerX;        // lobby player name assigned to X
    private String playerO;        // lobby player name assigned to O

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

    public String getPlayerX() {
        return playerX;
    }

    public void setPlayerX(String playerX) {
        this.playerX = playerX;
    }

    public String getPlayerO() {
        return playerO;
    }

    public void setPlayerO(String playerO) {
        this.playerO = playerO;
    }

    /** Switch to the other player’s turn */
    public void switchPlayer() {
        this.currentPlayer = this.currentPlayer.equals("X") ? "O" : "X";
    }

    /** Returns the symbol ("X"/"O") for a given player name, or null if not assigned */
    public String symbolForPlayer(String playerName) {
        if (playerName.equals(playerX)) return "X";
        if (playerName.equals(playerO)) return "O";
        return null;
    }

    /** Returns the name of the player whose turn it currently is */
    public String currentPlayerName() {
        return currentPlayer.equals("X") ? playerX : playerO;
    }

    /** Reset the game state to the initial configuration */
    public void reset() {
        for (int i = 0; i < 3; i++)
            for (int j = 0; j < 3; j++)
                board[i][j] = "-";
        this.currentPlayer = "X";
        this.winner = null;
    }
}
