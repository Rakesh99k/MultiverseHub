package com.multiplayer.backend.controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

import java.util.*;

@Controller
public class RoomController {

    private final Map<String, List<String>> rooms = new HashMap<>();

    @MessageMapping("/join")
    @SendTo("/topic/rooms")
    public Map<String, List<String>> joinRoom(Map<String, String> payload) {
        String roomId = payload.get("roomId");
        String player = payload.get("player");

        rooms.putIfAbsent(roomId, new ArrayList<>());
        rooms.get(roomId).add(player);

        return rooms; // send updated list of rooms
    }
}
