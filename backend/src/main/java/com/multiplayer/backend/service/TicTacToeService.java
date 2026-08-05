package com.multiplayer.backend.service;

import com.multiplayer.backend.model.GameState;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service("ticTacToeService")
public class TicTacToeService implements GameService {

    private final ConcurrentMap<String, GameState> games = new ConcurrentHashMap<>();

    // gameId is stored alongside each game so we can notify lobby on finish
    private final ConcurrentMap<String, String> gameIdMap = new ConcurrentHashMap<>();

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
        gameIdMap.put(gameId, gameId);
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
        gameIdMap.put(gameId, gameId);
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
            state.reset();
        }
    }

    /**
     * Delete a game entirely.
     * Returns false if not found.
     */
    @Override
    public boolean deleteGame(String gameId) {
        gameIdMap.remove(gameId);
        return games.remove(gameId) != null;
    }

    // ─── Move handling ────────────────────────────────────────────────────────

    /**
     * Make a move using the symbol directly ("X" or "O").
     * Used by the legacy /move endpoint.
     *
     * Rejected (returns unchanged state) if:
     *  - Game not found (returns null)
     *  - Game already has a winner
     *  - Symbol doesn't match current player's turn
     *  - Cell is already occupied
     *  - Row/col out of bounds
     */
    @Override
    public GameState makeMove(String gameId, int row, int col, String symbol) {
        GameState state = games.get(gameId);
        if (state == null) return null;

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

    /**
     * Make a move using the player's name.
     * Recommended endpoint — server resolves which symbol the player is.
     *
     * Rejected (returns unchanged state) if:
     *  - Game not found (returns null)
     *  - Game already has a winner
     *  - Player is not assigned to this game
     *  - It's not this player's turn
     *  - Cell is already occupied
     *  - Row/col out of bounds
     */
    @Override
    public GameState makeMoveByPlayer(String gameId, int row, int col, String playerName) {
        GameState state = games.get(gameId);
        if (state == null) return null;

        // Already finished
        if (state.getWinner() != null) return state;

        // Resolve symbol for this player
        String symbol = state.symbolForPlayer(playerName);
        if (symbol == null) return state; // player not in this game

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

    // ─── Win / Draw detection ─────────────────────────────────────────────────

    /**
     * Check if the given symbol has won.
     * Checks all rows, columns, and both diagonals.
     */
    private boolean checkWinner(String[][] board, String symbol) {
        // Rows
        for (int i = 0; i < 3; i++) {
            if (symbol.equals(board[i][0])
                    && symbol.equals(board[i][1])
                    && symbol.equals(board[i][2])) {
                return true;
            }
        }

        // Columns
        for (int j = 0; j < 3; j++) {
            if (symbol.equals(board[0][j])
                    && symbol.equals(board[1][j])
                    && symbol.equals(board[2][j])) {
                return true;
            }
        }

        // Diagonal top-left → bottom-right
        if (symbol.equals(board[0][0])
                && symbol.equals(board[1][1])
                && symbol.equals(board[2][2])) {
            return true;
        }

        // Diagonal top-right → bottom-left
        return symbol.equals(board[0][2])
                && symbol.equals(board[1][1])
                && symbol.equals(board[2][0]);
    }

    /**
     * Returns true if no empty cells remain on the board.
     */
    private boolean isBoardFull(String[][] board) {
        for (String[] row : board) {
            for (String cell : row) {
                if ("-".equals(cell)) return false;
            }
        }
        return true;
    }
}