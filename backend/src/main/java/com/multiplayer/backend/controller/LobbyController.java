package com.multiplayer.backend.controller;

import com.multiplayer.backend.model.Lobby;
import com.multiplayer.backend.service.LobbyService;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/lobbies")
public class LobbyController {

    private final LobbyService lobbyService;

    public LobbyController(LobbyService lobbyService) {
        this.lobbyService = lobbyService;
    }

    // ─── REST Endpoints ───────────────────────────────────────────────────────

    /**
     * Create a new lobby.
     * 400 if name is blank.
     */
    @PostMapping
    public ResponseEntity<Lobby> createLobby(@RequestParam String name) {
        Lobby lobby = lobbyService.createLobby(name);
        if (lobby == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(lobby);
    }

    /**
     * Get all lobbies.
     * Pass ?available=true to get only WAITING + not full lobbies.
     */
    @GetMapping
    public List<Lobby> getAllLobbies(
            @RequestParam(defaultValue = "false") boolean available
    ) {
        return available
                ? lobbyService.getAvailableLobbies()
                : lobbyService.getAllLobbies();
    }

    /**
     * Get a specific lobby.
     * 404 if not found.
     */
    @GetMapping("/{id}")
    public ResponseEntity<Lobby> getLobby(@PathVariable String id) {
        Lobby lobby = lobbyService.getLobby(id);
        if (lobby == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(lobby);
    }

    /**
     * Join a lobby.
     * 400 if full, already in game, blank name, or not found.
     */
    @PostMapping("/{id}/join")
    public ResponseEntity<Lobby> joinLobby(
            @PathVariable String id,
            @RequestParam String playerName
    ) {
        Lobby lobby = lobbyService.joinLobby(id, playerName);
        if (lobby == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(lobby);
    }

    /**
     * Leave a lobby.
     * 400 if playerName blank.
     * 404 if lobby not found.
     */
    @PostMapping("/{id}/leave")
    public ResponseEntity<Lobby> leaveLobby(
            @PathVariable String id,
            @RequestParam String playerName
    ) {
        if (playerName == null || playerName.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        Lobby lobby = lobbyService.leaveLobby(id, playerName);
        if (lobby == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(lobby);
    }

    /**
     * Start a game for this lobby.
     * ?game=tictactoe (default) | chess | sudoku
     * 400 if not enough players or lobby not in WAITING state.
     */
    @PostMapping("/{id}/start")
    public ResponseEntity<Lobby> startGame(
            @PathVariable String id,
            @RequestParam(defaultValue = "tictactoe") String game
    ) {
        Lobby lobby = lobbyService.startGame(id, game);
        if (lobby == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(lobby);
    }

    /**
     * Delete a lobby.
     * 404 if not found.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteLobby(@PathVariable String id) {
        boolean deleted = lobbyService.deleteLobby(id);
        if (!deleted) return ResponseEntity.notFound().build();
        return ResponseEntity.ok("Lobby " + id + " deleted.");
    }

    // ─── WebSocket Endpoints ──────────────────────────────────────────────────

    /**
     * WebSocket: create lobby.
     * Send to /app/lobby/create with lobby name as payload.
     * Broadcasts updated lobby list to /topic/lobbies.
     */
    @MessageMapping("/lobby/create")
    @SendTo("/topic/lobbies")
    public Lobby wsCreateLobby(String name) {
        return lobbyService.createLobby(name);
    }

    /**
     * WebSocket: join lobby.
     * Send to /app/lobby/join with payload "lobbyId:playerName".
     * Broadcasts updated lobby to /topic/lobbies.
     */
    @MessageMapping("/lobby/join")
    @SendTo("/topic/lobbies")
    public Lobby wsJoinLobby(String message) {
        if (message == null) return null;
        String[] parts = message.split(":", 2);
        if (parts.length != 2) return null;
        return lobbyService.joinLobby(parts[0].trim(), parts[1].trim());
    }
}