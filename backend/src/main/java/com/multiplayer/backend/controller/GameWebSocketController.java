package com.multiplayer.backend.controller;

import org.springframework.messaging.handler.annotation.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class GameWebSocketController {

    private final SimpMessagingTemplate messagingTemplate;

    public GameWebSocketController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    // Chat inside lobby
    @MessageMapping("/lobby/{lobbyId}/chat")
    public void sendChat(@DestinationVariable String lobbyId, String message) {
        messagingTemplate.convertAndSend("/topic/lobby/" + lobbyId + "/chat", message);
    }

    // Game moves inside lobby
    @MessageMapping("/lobby/{lobbyId}/move")
    public void sendMove(@DestinationVariable String lobbyId, String move) {
        messagingTemplate.convertAndSend("/topic/lobby/" + lobbyId + "/game", move);
    }
}
