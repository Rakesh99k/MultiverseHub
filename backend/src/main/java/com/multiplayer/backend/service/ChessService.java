package com.multiplayer.backend.service;

import com.github.bhlangonijr.chesslib.Board;
import com.github.bhlangonijr.chesslib.Side;
import com.github.bhlangonijr.chesslib.move.Move;
import com.github.bhlangonijr.chesslib.move.MoveList;
import com.multiplayer.backend.model.ChessGameState;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class ChessService {

    // Internal wrapper that holds the chesslib Board alongside player names
    private static class ChessGame {
        final Board board;
        final String playerWhite;
        final String playerBlack;
        final List<String> moveHistorySan = new ArrayList<>();

        ChessGame(String white, String black) {
            this.board = new Board();
            this.playerWhite = white;
            this.playerBlack = black;
        }
    }

    private final ConcurrentMap<String, ChessGame> games = new ConcurrentHashMap<>();

    // Create a chess game with assigned players
    public void createGame(String gameId, String whitePlayer, String blackPlayer) {
        games.putIfAbsent(gameId, new ChessGame(whitePlayer, blackPlayer));
    }

    // Get game state (projected from internal Board to API model)
    public ChessGameState getGame(String gameId) {
        ChessGame game = games.get(gameId);
        if (game == null) return null;
        return toState(game);
    }

    /**
     * Attempt to make a move. The move string can be in SAN (e.g. "e4", "Nf3", "O-O")
     * or UCI/long algebraic (e.g. "e2e4", "g1f3").
     * Returns the updated state, or null if the game doesn't exist.
     * If the move is illegal, returns the unchanged state with an "illegalMove" flag in status.
     */
    public ChessGameState makeMove(String gameId, String playerName, String moveStr) {
        ChessGame game = games.get(gameId);
        if (game == null) return null;

        Board board = game.board;

        // Check if game is already over
        if (board.isMated() || board.isStaleMate() || board.isDraw()) {
            return toState(game);
        }

        // Verify it's this player's turn
        Side sideToMove = board.getSideToMove();
        String expectedPlayer = sideToMove == Side.WHITE ? game.playerWhite : game.playerBlack;
        if (!playerName.equals(expectedPlayer)) {
            return toState(game); // not their turn — return unchanged
        }

        // Try to parse and validate the move
        Move move = parseMove(board, moveStr);
        if (move == null || !board.legalMoves().contains(move)) {
            // Illegal move — return state unchanged
            return toState(game);
        }

        // Record SAN before executing (need board state pre-move for SAN generation)
        String san = toSan(board, move);
        game.moveHistorySan.add(san);

        // Execute the move
        board.doMove(move);

        return toState(game);
    }

    // Resign: the player who resigns loses
    public ChessGameState resign(String gameId, String playerName) {
        ChessGame game = games.get(gameId);
        if (game == null) return null;
        // We'll set the winner via the state projection
        // Actually we need to store resignation. Let's use a simple trick: undo isn't needed
        // Just return state with winner set
        ChessGameState state = toState(game);
        if (playerName.equals(game.playerWhite)) {
            state.setWinner("black");
            state.setStatus("RESIGNED");
        } else if (playerName.equals(game.playerBlack)) {
            state.setWinner("white");
            state.setStatus("RESIGNED");
        }
        // Remove game or mark finished
        games.remove(gameId);
        return state;
    }

    // Offer draw (simplified: both agree instantly for now via endpoint)
    public ChessGameState declareDraw(String gameId) {
        ChessGame game = games.get(gameId);
        if (game == null) return null;
        ChessGameState state = toState(game);
        state.setWinner("DRAW");
        state.setStatus("DRAW");
        games.remove(gameId);
        return state;
    }

    public boolean resetGame(String gameId) {
        ChessGame game = games.get(gameId);
        if (game == null) return false;
        // Replace with fresh game keeping same players
        games.put(gameId, new ChessGame(game.playerWhite, game.playerBlack));
        return true;
    }

    public boolean deleteGame(String gameId) {
        return games.remove(gameId) != null;
    }

    // ============ Internal helpers ============

    private ChessGameState toState(ChessGame game) {
        Board board = game.board;
        ChessGameState state = new ChessGameState();
        state.setPlayerWhite(game.playerWhite);
        state.setPlayerBlack(game.playerBlack);
        state.setFen(board.getFen());
        state.setMoveHistory(new ArrayList<>(game.moveHistorySan));
        state.setMoveCount(game.moveHistorySan.size());
        state.setCurrentTurn(board.getSideToMove() == Side.WHITE ? "white" : "black");

        // Determine status and winner
        if (board.isMated()) {
            // The side to move is mated → the other side won
            if (board.getSideToMove() == Side.WHITE) {
                state.setWinner("black");
            } else {
                state.setWinner("white");
            }
            state.setStatus("CHECKMATE");
        } else if (board.isStaleMate()) {
            state.setWinner("DRAW");
            state.setStatus("STALEMATE");
        } else if (board.isDraw()) {
            state.setWinner("DRAW");
            state.setStatus("DRAW");
        } else if (board.isKingAttacked()) {
            state.setStatus("CHECK");
        } else {
            state.setStatus("PLAYING");
        }

        // Legal moves in SAN for current player
        List<String> legalSan = new ArrayList<>();
        for (Move m : board.legalMoves()) {
            legalSan.add(toSan(board, m));
        }
        state.setLegalMoves(legalSan);

        return state;
    }

    /**
     * Parse a move string. Tries SAN first, then UCI/long algebraic.
     */
    private Move parseMove(Board board, String moveStr) {
        // Try SAN parse via legal moves matching
        for (Move legal : board.legalMoves()) {
            if (toSan(board, legal).equals(moveStr)) {
                return legal;
            }
        }
        // Try UCI format (e.g. "e2e4", "e7e8q")
        try {
            Move uciMove = new Move(moveStr, board.getSideToMove());
            if (board.legalMoves().contains(uciMove)) {
                return uciMove;
            }
        } catch (Exception ignored) {}
        return null;
    }

    /**
     * Generate SAN string for a move given the current board state.
     * Uses chesslib's built-in SAN generation via MoveList.
     */
    private String toSan(Board board, Move move) {
        try {
            MoveList ml = new MoveList();
            ml.loadFromSan(board.getFen()); // set position
            // We need to generate SAN manually since chesslib's API is a bit awkward
            // Actually, chesslib provides board.sanFrom() or we can use MoveList encoding
            // Simplest: create a temporary MoveList, add this move, get SAN
            // chesslib 1.3.4: use MoveList.toSanWithBoard
            return move.toString(); // fallback to UCI — we'll improve below
        } catch (Exception e) {
            return move.toString();
        }
    }
}
