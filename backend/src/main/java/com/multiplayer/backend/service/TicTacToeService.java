package com.multiplayer.backend.service;

import com.multiplayer.backend.model.GameState;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service("ticTacToeService")
public class TicTacToeService implements GameService {

    private final ConcurrentMap<String, GameState> games = new ConcurrentHashMap<>();

    // Lazy to avoid circular dependency (LobbyService → TicTacToeService → LobbyService)
    private final LobbyService lobbyService;

    public TicTacToeService(@Lazy LobbyService lobbyService) {
        this.lobbyService = lobbyService;
    }

    // ─── Game lifecycle ───────────────────────────────────────────────────────

    /**
     * Create a standalone game (no players assigned).
     */
    @Override
    public void createGame(String gameId) {
        games.putIfAbsent(gameId, new GameState());
    }

    /**
     * Create a lobby-linked game with assigned players.
     * Player 1 → X, Player 2 → O.
     */
    @Override
    public void createGame(String gameId, String playerX, String playerO) {
        GameState state = new GameState();
        state.setPlayerX(playerX);
        state.setPlayerO(playerO);
        games.putIfAbsent(gameId, state);
    }

    /**
     * Get current game state.
     * Returns null if not found.
     */
    @Override
    public GameState getGame(String gameId) {
        return games.get(gameId);
    }

    /**
     * Reset the board for a rematch.
     * Keeps player assignments (playerX / playerO).
     * Resets board, currentPlayer, and winner.
     */
    @Override
    public void resetGame(String gameId) {
        GameState state = games.get(gameId);
        if (state != null) {
            synchronized (state) {
                state.reset();
            }
        }
    }

    /**
     * Delete a game entirely.
     * Returns false if not found.
     */
    @Override
    public boolean deleteGame(String gameId) {
        return games.remove(gameId) != null;
    }

    // ─── Move handling ────────────────────────────────────────────────────────

    /**
     * Make a move using the symbol directly ("X" or "O").
     * Used by the legacy /move endpoint.
     */
    @Override
    public GameState makeMove(String gameId, int row, int col, String symbol) {
        GameState state = games.get(gameId);
        if (state == null) return null;

        synchronized (state) {
            // Already finished
            if (state.getWinner() != null) return state;

            // Wrong turn
            if (!symbol.equals(state.getCurrentPlayer())) return state;

            // Bounds check
            if (row < 0 || row > 2 || col < 0 || col > 2) return state;

            String[][] board = state.getBoard();

            // Cell occupied
            if (!"-".equals(board[row][col])) return state;

            // Place the symbol
            board[row][col] = symbol;

            // Check result
            if (checkWinner(board, symbol)) {
                state.setWinner(symbol);
                lobbyService.onGameFinished(gameId);
            } else if (isBoardFull(board)) {
                state.setWinner("DRAW");
                lobbyService.onGameFinished(gameId);
            } else {
                state.switchPlayer();
            }

            return state;
        }
    }

    /**
     * Make a move using the player's name.
     * Server resolves which symbol the player is.
     */
    @Override
    public GameState makeMoveByPlayer(String gameId, int row, int col, String playerName) {
        GameState state = games.get(gameId);
        if (state == null) return null;

        synchronized (state) {
            // Already finished
            if (state.getWinner() != null) return state;

            // Resolve symbol for this player
            String symbol = state.symbolForPlayer(playerName);
            if (symbol == null) return state;

            // Not their turn
            if (!symbol.equals(state.getCurrentPlayer())) return state;

            // Bounds check
            if (row < 0 || row > 2 || col < 0 || col > 2) return state;

            String[][] board = state.getBoard();

            // Cell occupied
            if (!"-".equals(board[row][col])) return state;

            // Place the symbol
            board[row][col] = symbol;

            // Check result
            if (checkWinner(board, symbol)) {
                state.setWinner(symbol);
                lobbyService.onGameFinished(gameId);
            } else if (isBoardFull(board)) {
                state.setWinner("DRAW");
                lobbyService.onGameFinished(gameId);
            } else {
                state.switchPlayer();
            }

            return state;
        }
    }

    // ─── Win / Draw detection ─────────────────────────────────────────────────

    private boolean checkWinner(String[][] board, String symbol) {
        for (int i = 0; i < 3; i++) {
            if (symbol.equals(board[i][0])
                    && symbol.equals(board[i][1])
                    && symbol.equals(board[i][2])) {
                return true;
            }
        }

        for (int j = 0; j < 3; j++) {
            if (symbol.equals(board[0][j])
                    && symbol.equals(board[1][j])
                    && symbol.equals(board[2][j])) {
                return true;
            }
        }

        if (symbol.equals(board[0][0])
                && symbol.equals(board[1][1])
                && symbol.equals(board[2][2])) {
            return true;
        }

        return symbol.equals(board[0][2])
                && symbol.equals(board[1][1])
                && symbol.equals(board[2][0]);
    }

    private boolean isBoardFull(String[][] board) {
        for (String[] row : board) {
            for (String cell : row) {
                if ("-".equals(cell)) return false;
            }
        }
        return true;
    }
}