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

    // Create a new lobby (validates name)
    @PostMapping
    public ResponseEntity<Lobby> createLobby(@RequestParam String name) {
        Lobby lobby = lobbyService.createLobby(name);
        if (lobby == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(lobby);
    }

    // Get all lobbies, optionally filtered to available only
    @GetMapping
    public List<Lobby> getAllLobbies(@RequestParam(defaultValue = "false") boolean available) {
        return available ? lobbyService.getAvailableLobbies() : lobbyService.getAllLobbies();
    }

    // Get a specific lobby — 404 if not found
    @GetMapping("/{id}")
    public ResponseEntity<Lobby> getLobby(@PathVariable String id) {
        Lobby lobby = lobbyService.getLobby(id);
        if (lobby == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(lobby);
    }

    // Join a lobby — 400 if full, not found, or blank name
    @PostMapping("/{id}/join")
    public ResponseEntity<Lobby> joinLobby(@PathVariable String id, @RequestParam String playerName) {
        Lobby lobby = lobbyService.joinLobby(id, playerName);
        if (lobby == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(lobby);
    }

    // Leave a lobby
    @PostMapping("/{id}/leave")
    public ResponseEntity<Lobby> leaveLobby(@PathVariable String id, @RequestParam String playerName) {
        Lobby lobby = lobbyService.getLobby(id);
        if (lobby == null) return ResponseEntity.notFound().build();
        lobby.getPlayers().remove(playerName);
        return ResponseEntity.ok(lobby);
    }

    // Start game — creates TicTacToe (default) or Chess game linked to lobby players
    @PostMapping("/{id}/start")
    public ResponseEntity<Lobby> startGame(@PathVariable String id,
                                           @RequestParam(defaultValue = "tictactoe") String game) {
        Lobby lobby = lobbyService.startGame(id, game);
        if (lobby == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(lobby);
    }

    // Delete a lobby — 404 if not found
    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteLobby(@PathVariable String id) {
        boolean deleted = lobbyService.deleteLobby(id);
        if (!deleted) return ResponseEntity.notFound().build();
        return ResponseEntity.ok("Lobby " + id + " deleted.");
    }

    // ---------- WEBSOCKET MAPPINGS ----------

    @MessageMapping("/lobby/create")
    @SendTo("/topic/lobbies")
    public Lobby wsCreateLobby(String name) {
        return lobbyService.createLobby(name);
    }

    @MessageMapping("/lobby/join")
    @SendTo("/topic/lobbies")
    public Lobby wsJoinLobby(String message) {
        String[] parts = message.split(":");
        if (parts.length != 2) return null;
        return lobbyService.joinLobby(parts[0], parts[1]);
    }
}
