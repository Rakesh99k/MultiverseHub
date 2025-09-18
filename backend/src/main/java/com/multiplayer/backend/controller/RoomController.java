package com.multiplayer.backend.controller;

import com.multiplayer.backend.model.Lobby;
import com.multiplayer.backend.service.LobbyService;
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
    public Lobby joinRoom(@PathVariable String lobbyId, @RequestParam String playerName) {
        return lobbyService.joinLobby(lobbyId, playerName);
    }

    // WebSocket: join lobby room
    @MessageMapping("/room/join")
    @SendTo("/topic/rooms")
    public Lobby joinRoomWS(String message) {
        // message format: lobbyId:playerName
        String[] parts = message.split(":");
        if (parts.length != 2) return null;

        String lobbyId = parts[0];
        String playerName = parts[1];

        return lobbyService.joinLobby(lobbyId, playerName);
    }
}
