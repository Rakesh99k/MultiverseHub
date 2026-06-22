package com.multiplayer.backend.service;

import com.multiplayer.backend.model.Lobby;
import com.multiplayer.backend.model.LobbyStatus;
import org.springframework.beans.factory.annotation.Qualifier;
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

    public LobbyService(@Qualifier("ticTacToeService") GameService gameService,
                        ChessService chessService,
                        SudokuService sudokuService) {
        this.gameService = gameService;
        this.chessService = chessService;
        this.sudokuService = sudokuService;
    }

    // Create a new lobby (validates name not blank)
    public Lobby createLobby(String name) {
        if (name == null || name.isBlank()) return null;
        String id = UUID.randomUUID().toString();
        Lobby lobby = new Lobby(id, name.trim());
        lobbies.put(id, lobby);
        return lobby;
    }

    // Get all lobbies
    public List<Lobby> getAllLobbies() {
        return new ArrayList<>(lobbies.values());
    }

    // Get only lobbies that are WAITING and not full
    public List<Lobby> getAvailableLobbies() {
        List<Lobby> result = new ArrayList<>();
        for (Lobby l : lobbies.values()) {
            if (l.getStatus() == LobbyStatus.WAITING && l.getPlayers().size() < MAX_PLAYERS) {
                result.add(l);
            }
        }
        return result;
    }

    // Get a specific lobby
    public Lobby getLobby(String id) {
        return lobbies.get(id);
    }

    // Join a lobby (validates playerName not blank)
    public Lobby joinLobby(String id, String playerName) {
        if (playerName == null || playerName.isBlank()) return null;
        Lobby lobby = lobbies.get(id);
        if (lobby == null) return null;
        if (lobby.getStatus() != LobbyStatus.WAITING) return null; // can't join in-game lobby
        if (lobby.getPlayers().contains(playerName.trim())) return lobby; // duplicate
        if (lobby.getPlayers().size() >= MAX_PLAYERS) return null; // full
        lobby.getPlayers().add(playerName.trim());
        return lobby;
    }

    // Start a TicTacToe game for a lobby (needs exactly 2 players)
    public Lobby startGame(String id) {
        return startGame(id, "tictactoe");
    }

    // Start a game for a lobby with game type selection
    public Lobby startGame(String id, String gameType) {
        Lobby lobby = lobbies.get(id);
        if (lobby == null) return null;
        if (lobby.getStatus() != LobbyStatus.WAITING) return null;

        // Sudoku allows solo or collaborative; others need 2 players
        int minPlayers = "sudoku".equalsIgnoreCase(gameType) ? 1 : 2;
        if (lobby.getPlayers().size() < minPlayers) return null;

        String gameId = gameType + "-" + id;
        String player1 = lobby.getPlayers().get(0);
        String player2 = lobby.getPlayers().size() > 1 ? lobby.getPlayers().get(1) : null;

        if ("chess".equalsIgnoreCase(gameType)) {
            chessService.createGame(gameId, player1, player2);
        } else if ("sudoku".equalsIgnoreCase(gameType)) {
            sudokuService.createGame(gameId, "medium", "collaborative");
            // auto-join all lobby players
            for (String p : lobby.getPlayers()) {
                sudokuService.joinGame(gameId, p);
            }
        } else {
            // default: tictactoe
            gameService.createGame(gameId, player1, player2);
        }

        lobby.setGameId(gameId);
        lobby.setStatus(LobbyStatus.IN_GAME);
        return lobby;
    }

    // Mark lobby as finished
    public Lobby finishLobby(String id) {
        Lobby lobby = lobbies.get(id);
        if (lobby != null) lobby.setStatus(LobbyStatus.FINISHED);
        return lobby;
    }

    // Delete a lobby
    public boolean deleteLobby(String id) {
        return lobbies.remove(id) != null;
    }
}
