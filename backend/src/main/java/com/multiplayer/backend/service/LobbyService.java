package com.multiplayer.backend.service;

import com.multiplayer.backend.model.Lobby;
import com.multiplayer.backend.model.LobbyStatus;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class LobbyService {

    private static final int MAX_PLAYERS = 4;

    private final Map<String, Lobby> lobbies = new ConcurrentHashMap<>();

    private final GameService gameService;
    private final ChessService chessService;
    private final SudokuService sudokuService;

    public LobbyService(
            @Qualifier("ticTacToeService") GameService gameService,
            @Lazy ChessService chessService,
            @Lazy SudokuService sudokuService
    ) {
        this.gameService  = gameService;
        this.chessService = chessService;
        this.sudokuService = sudokuService;
    }

    // ─── Lobby CRUD ───────────────────────────────────────────────────────────

    /**
     * Create a new lobby.
     * Returns null if name is blank.
     */
    public Lobby createLobby(String name) {
        if (name == null || name.isBlank()) return null;
        String id = UUID.randomUUID().toString();
        Lobby lobby = new Lobby(id, name.trim());
        lobbies.put(id, lobby);
        return lobby;
    }

    /**
     * Return all lobbies.
     */
    public List<Lobby> getAllLobbies() {
        return new ArrayList<>(lobbies.values());
    }

    /**
     * Return only lobbies that are WAITING and not full.
     */
    public List<Lobby> getAvailableLobbies() {
        List<Lobby> result = new ArrayList<>();
        for (Lobby lobby : lobbies.values()) {
            if (lobby.getStatus() == LobbyStatus.WAITING
                    && lobby.getPlayers().size() < MAX_PLAYERS) {
                result.add(lobby);
            }
        }
        return result;
    }

    /**
     * Get a specific lobby by id.
     * Returns null if not found.
     */
    public Lobby getLobby(String id) {
        return lobbies.get(id);
    }

    /**
     * Join a lobby.
     * Returns null if:
     *  - playerName is blank
     *  - lobby not found
     *  - lobby is not in WAITING state
     *  - lobby is full
     * Returns lobby unchanged if player already in it (idempotent).
     */
    public Lobby joinLobby(String id, String playerName) {
        if (playerName == null || playerName.isBlank()) return null;

        Lobby lobby = lobbies.get(id);
        if (lobby == null) return null;
        if (lobby.getStatus() != LobbyStatus.WAITING) return null;

        String trimmed = playerName.trim();

        // Idempotent — already joined
        if (lobby.getPlayers().contains(trimmed)) return lobby;

        // Full
        if (lobby.getPlayers().size() >= MAX_PLAYERS) return null;

        lobby.getPlayers().add(trimmed);
        return lobby;
    }

    /**
     * Remove a player from a lobby.
     * Returns null if lobby not found or playerName is blank.
     * Safe to call if player is not in lobby (no-op).
     */
    public Lobby leaveLobby(String id, String playerName) {
        if (playerName == null || playerName.isBlank()) return null;

        Lobby lobby = lobbies.get(id);
        if (lobby == null) return null;

        lobby.getPlayers().remove(playerName.trim());
        return lobby;
    }

    /**
     * Start a game for a lobby.
     * Overload with default game type = tictactoe.
     */
    public Lobby startGame(String id) {
        return startGame(id, "tictactoe");
    }

    /**
     * Start a game for a lobby with a specified game type.
     *
     * Rules:
     *  - Lobby must be WAITING
     *  - Sudoku needs at least 1 player
     *  - Chess and TicTacToe need at least 2 players
     *
     * Sets lobby status to IN_GAME and stores the gameId.
     */
    public Lobby startGame(String id, String gameType) {
        Lobby lobby = lobbies.get(id);
        if (lobby == null) return null;
        if (lobby.getStatus() != LobbyStatus.WAITING) return null;

        int minPlayers = "sudoku".equalsIgnoreCase(gameType) ? 1 : 2;
        if (lobby.getPlayers().size() < minPlayers) return null;

        String gameId   = gameType.toLowerCase() + "-" + id;
        String player1  = lobby.getPlayers().get(0);
        String player2  = lobby.getPlayers().size() > 1
                ? lobby.getPlayers().get(1)
                : null;

        switch (gameType.toLowerCase()) {
            case "chess" -> chessService.createGame(gameId, player1, player2);
            case "sudoku" -> {
                sudokuService.createGame(gameId, "medium", "collaborative");
                for (String p : lobby.getPlayers()) {
                    sudokuService.joinGame(gameId, p);
                }
            }
            default -> gameService.createGame(gameId, player1, player2);
        }

        lobby.setGameId(gameId);
        lobby.setStatus(LobbyStatus.IN_GAME);
        return lobby;
    }

    /**
     * Mark a lobby as FINISHED.
     * Called by game services when a game concludes.
     */
    public void onGameFinished(String gameId) {
        if (gameId == null) return;
        for (Lobby lobby : lobbies.values()) {
            if (gameId.equals(lobby.getGameId())) {
                lobby.setStatus(LobbyStatus.FINISHED);
                return;
            }
        }
    }

    /**
     * Manually mark a lobby as FINISHED.
     */
    public Lobby finishLobby(String id) {
        Lobby lobby = lobbies.get(id);
        if (lobby != null) {
            lobby.setStatus(LobbyStatus.FINISHED);
        }
        return lobby;
    }

    /**
     * Delete a lobby entirely.
     * Returns false if not found.
     */
    public boolean deleteLobby(String id) {
        return lobbies.remove(id) != null;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Check if a player is in a specific lobby.
     */
    public boolean isPlayerInLobby(String lobbyId, String playerName) {
        Lobby lobby = lobbies.get(lobbyId);
        if (lobby == null || playerName == null) return false;
        return lobby.getPlayers().contains(playerName.trim());
    }

    /**
     * Get how many lobbies currently exist.
     */
    public int getLobbyCount() {
        return lobbies.size();
    }
}