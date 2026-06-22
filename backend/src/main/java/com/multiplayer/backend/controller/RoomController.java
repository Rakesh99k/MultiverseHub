package com.multiplayer.backend.controller;

import com.multiplayer.backend.model.Lobby;
import com.multiplayer.backend.service.LobbyService;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final LobbyService lobbyService;

    public RoomController(LobbyService lobbyService) {
        this.lobbyService = lobbyService;
    }

    // REST: join a specific room in a lobby
    @PostMapping("/{lobbyId}/join")
    public ResponseEntity<Lobby> joinRoom(@PathVariable String lobbyId, @RequestParam String playerName) {
        Lobby lobby = lobbyService.joinLobby(lobbyId, playerName);
        if (lobby == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(lobby);
    }

    // WebSocket: join lobby room
    @MessageMapping("/room/join")
    @SendTo("/topic/rooms")
    public Lobby joinRoomWS(String message) {
        // message format: lobbyId:playerName
        String[] parts = message.split(":");
        if (parts.length != 2) return null;
        return lobbyService.joinLobby(parts[0], parts[1]);
    }
}
