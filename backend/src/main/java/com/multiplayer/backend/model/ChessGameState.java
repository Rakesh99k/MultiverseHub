package com.multiplayer.backend.model;

import java.util.ArrayList;
import java.util.List;

/**
 * Complete chess game state exposed via API.
 * Backed by chesslib internally (in ChessService), this is the DTO/model returned to clients.
 */
public class ChessGameState {

    private String playerWhite;
    private String playerBlack;
    private String currentTurn;       // "white" or "black"
    private String fen;               // current board position in FEN notation
    private List<String> moveHistory; // moves in SAN notation (e.g., "e4", "Nf3", "O-O")
    private String winner;            // "white", "black", "DRAW", or null
    private String status;            // "PLAYING", "CHECK", "CHECKMATE", "STALEMATE", "DRAW"
    private List<String> legalMoves;  // available legal moves in SAN for current player
    private int moveCount;            // total half-moves played

    public ChessGameState() {
        this.moveHistory = new ArrayList<>();
        this.legalMoves = new ArrayList<>();
        this.currentTurn = "white";
        this.status = "PLAYING";
        this.moveCount = 0;
    }

    // --- Getters and Setters ---

    public String getPlayerWhite() { return playerWhite; }
    public void setPlayerWhite(String playerWhite) { this.playerWhite = playerWhite; }

    public String getPlayerBlack() { return playerBlack; }
    public void setPlayerBlack(String playerBlack) { this.playerBlack = playerBlack; }

    public String getCurrentTurn() { return currentTurn; }
    public void setCurrentTurn(String currentTurn) { this.currentTurn = currentTurn; }

    public String getFen() { return fen; }
    public void setFen(String fen) { this.fen = fen; }

    public List<String> getMoveHistory() { return moveHistory; }
    public void setMoveHistory(List<String> moveHistory) { this.moveHistory = moveHistory; }

    public String getWinner() { return winner; }
    public void setWinner(String winner) { this.winner = winner; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public List<String> getLegalMoves() { return legalMoves; }
    public void setLegalMoves(List<String> legalMoves) { this.legalMoves = legalMoves; }

    public int getMoveCount() { return moveCount; }
    public void setMoveCount(int moveCount) { this.moveCount = moveCount; }
}
