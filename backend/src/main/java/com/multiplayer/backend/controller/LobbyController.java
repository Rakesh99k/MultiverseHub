package com.multiplayer.backend.controller;

import com.multiplayer.backend.model.Lobby;
import com.multiplayer.backend.service.LobbyService;
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

    // ---------- REST ENDPOINTS ----------

    // Create a new lobby
    @PostMapping
    public Lobby createLobby(@RequestParam String name) {
        return lobbyService.createLobby(name);
    }

    // Get all lobbies
    @GetMapping
    public List<Lobby> getAllLobbies() {
        return lobbyService.getAllLobbies();
    }

    // Get a specific lobby
    @GetMapping("/{id}")
    public Lobby getLobby(@PathVariable String id) {
        return lobbyService.getLobby(id);
    }

    // Join a lobby
    @PostMapping("/{id}/join")
    public Lobby joinLobby(@PathVariable String id, @RequestParam String playerName) {
        return lobbyService.joinLobby(id, playerName);
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
        // Expecting "lobbyId:playerName"
        String[] parts = message.split(":");
        return lobbyService.joinLobby(parts[0], parts[1]);
    }
}
