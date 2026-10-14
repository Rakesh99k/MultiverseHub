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

    private static final int MAX_PLAYERS = 8; // increased for trivia

    private final Map<String, Lobby> lobbies = new ConcurrentHashMap<>();

    private final GameService gameService;
    private final ChessService chessService;
    private final SudokuService sudokuService;
    private final TriviaService triviaService;

    public LobbyService(
            @Qualifier("ticTacToeService") GameService gameService,
            @Lazy ChessService chessService,
            @Lazy SudokuService sudokuService,
            @Lazy TriviaService triviaService
    ) {
        this.gameService = gameService;
        this.chessService = chessService;
        this.sudokuService = sudokuService;
        this.triviaService = triviaService;
    }

    // ─── Lobby CRUD ───────────────────────────────────────────────────────────

    public Lobby createLobby(String name) {
        if (name == null || name.isBlank()) return null;
        String id = UUID.randomUUID().toString();
        Lobby lobby = new Lobby(id, name.trim());
        lobbies.put(id, lobby);
        return lobby;
    }

    public List<Lobby> getAllLobbies() {
        return new ArrayList<>(lobbies.values());
    }

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

    public Lobby getLobby(String id) {
        return lobbies.get(id);
    }

    public Lobby joinLobby(String id, String playerName) {
        if (playerName == null || playerName.isBlank()) return null;

        Lobby lobby = lobbies.get(id);
        if (lobby == null) return null;
        if (lobby.getStatus() != LobbyStatus.WAITING) return null;

        String trimmed = playerName.trim();

        if (lobby.getPlayers().contains(trimmed)) return lobby;
        if (lobby.getPlayers().size() >= MAX_PLAYERS) return null;

        lobby.getPlayers().add(trimmed);
        return lobby;
    }

    public Lobby leaveLobby(String id, String playerName) {
        if (playerName == null || playerName.isBlank()) return null;

        Lobby lobby = lobbies.get(id);
        if (lobby == null) return null;

        lobby.getPlayers().remove(playerName.trim());
        return lobby;
    }

    public Lobby startGame(String id) {
        return startGame(id, "tictactoe");
    }

    public Lobby startGame(String id, String gameType) {
        Lobby lobby = lobbies.get(id);
        if (lobby == null) return null;
        if (lobby.getStatus() != LobbyStatus.WAITING) return null;

        int minPlayers = switch (gameType.toLowerCase()) {
            case "sudoku" -> 1;
            case "trivia" -> 1;
            default -> 2;
        };
        if (lobby.getPlayers().size() < minPlayers) return null;

        String gameId = gameType.toLowerCase() + "-" + id;
        String player1 = lobby.getPlayers().get(0);
        String player2 = lobby.getPlayers().size() > 1
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
            case "trivia" -> {
                triviaService.createGame(gameId, 10, 15);
                for (String p : lobby.getPlayers()) {
                    triviaService.joinGame(gameId, p);
                }
            }
            default -> gameService.createGame(gameId, player1, player2);
        }

        lobby.setGameId(gameId);
        lobby.setStatus(LobbyStatus.IN_GAME);
        return lobby;
    }

    public void onGameFinished(String gameId) {
        if (gameId == null) return;
        for (Lobby lobby : lobbies.values()) {
            if (gameId.equals(lobby.getGameId())) {
                lobby.setStatus(LobbyStatus.FINISHED);
                return;
            }
        }
    }

    public Lobby finishLobby(String id) {
        Lobby lobby = lobbies.get(id);
        if (lobby != null) {
            lobby.setStatus(LobbyStatus.FINISHED);
        }
        return lobby;
    }

    public boolean deleteLobby(String id) {
        return lobbies.remove(id) != null;
    }

    public boolean isPlayerInLobby(String lobbyId, String playerName) {
        Lobby lobby = lobbies.get(lobbyId);
        if (lobby == null || playerName == null) return false;
        return lobby.getPlayers().contains(playerName.trim());
    }

    public int getLobbyCount() {

        return lobbies.size();

    }
}