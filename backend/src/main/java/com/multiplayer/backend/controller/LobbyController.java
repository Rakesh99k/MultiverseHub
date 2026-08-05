
package com.multiplayer.backend.controller;

import com.multiplayer.backend.model.Lobby;
import com.multiplayer.backend.service.LobbyService;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/lobbies")
public class LobbyController {

    private final LobbyService lobbyService;
    private final SimpMessagingTemplate messagingTemplate;

    public LobbyController(LobbyService lobbyService,
                           SimpMessagingTemplate messagingTemplate) {
        this.lobbyService      = lobbyService;
        this.messagingTemplate = messagingTemplate;
    }

    // ─── REST Endpoints ───────────────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<Lobby> createLobby(@RequestParam String name) {
        Lobby lobby = lobbyService.createLobby(name);
        if (lobby == null) return ResponseEntity.badRequest().build();
        // Broadcast so all lobby-list viewers see the new lobby
        messagingTemplate.convertAndSend("/topic/lobbies", lobby);
        return ResponseEntity.ok(lobby);
    }

    @GetMapping
    public List<Lobby> getAllLobbies(
            @RequestParam(defaultValue = "false") boolean available) {
        return available
                ? lobbyService.getAvailableLobbies()
                : lobbyService.getAllLobbies();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Lobby> getLobby(@PathVariable String id) {
        Lobby lobby = lobbyService.getLobby(id);
        if (lobby == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(lobby);
    }

    @PostMapping("/{id}/join")
    public ResponseEntity<Lobby> joinLobby(
            @PathVariable String id,
            @RequestParam String playerName) {
        Lobby lobby = lobbyService.joinLobby(id, playerName);
        if (lobby == null) return ResponseEntity.badRequest().build();
        // Broadcast join event so other tabs see the new player instantly
        messagingTemplate.convertAndSend("/topic/lobbies", lobby);
        messagingTemplate.convertAndSend("/topic/lobby/" + id, lobby);
        return ResponseEntity.ok(lobby);
    }

    @PostMapping("/{id}/leave")
    public ResponseEntity<Lobby> leaveLobby(
            @PathVariable String id,
            @RequestParam String playerName) {
        if (playerName == null || playerName.isBlank())
            return ResponseEntity.badRequest().build();
        Lobby lobby = lobbyService.leaveLobby(id, playerName);
        if (lobby == null) return ResponseEntity.notFound().build();
        // Broadcast leave event
        messagingTemplate.convertAndSend("/topic/lobbies", lobby);
        messagingTemplate.convertAndSend("/topic/lobby/" + id, lobby);
        return ResponseEntity.ok(lobby);
    }

    @PostMapping("/{id}/start")
    public ResponseEntity<Lobby> startGame(
            @PathVariable String id,
            @RequestParam(defaultValue = "tictactoe") String game) {
        Lobby lobby = lobbyService.startGame(id, game);
        if (lobby == null) return ResponseEntity.badRequest().build();

        // ✅ KEY FIX: Broadcast to BOTH topics so all tabs get notified
        // /topic/lobbies  → lobby list page updates
        // /topic/lobby/{id} → lobby detail page gets the gameId + IN_GAME status
        messagingTemplate.convertAndSend("/topic/lobbies", lobby);
        messagingTemplate.convertAndSend("/topic/lobby/" + id, lobby);

        return ResponseEntity.ok(lobby);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteLobby(@PathVariable String id) {
        boolean deleted = lobbyService.deleteLobby(id);
        if (!deleted) return ResponseEntity.notFound().build();
        return ResponseEntity.ok("Lobby " + id + " deleted.");
    }

    // ─── WebSocket Endpoints ──────────────────────────────────────────────────

    @MessageMapping("/lobby/create")
    @SendTo("/topic/lobbies")
    public Lobby wsCreateLobby(String name) {
        return lobbyService.createLobby(name);
    }

    @MessageMapping("/lobby/join")
    @SendTo("/topic/lobbies")
    public Lobby wsJoinLobby(String message) {
        if (message == null) return null;
        String[] parts = message.split(":", 2);
        if (parts.length != 2) return null;
        return lobbyService.joinLobby(parts[0].trim(), parts[1].trim());
    }
}