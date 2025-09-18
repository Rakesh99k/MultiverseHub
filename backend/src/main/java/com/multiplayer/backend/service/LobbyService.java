package com.multiplayer.backend.service;

import com.multiplayer.backend.model.Lobby;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class LobbyService {

    private final Map<String, Lobby> lobbies = new HashMap<>();

    // Create a new lobby
    public Lobby createLobby(String name) {
        String id = UUID.randomUUID().toString();
        Lobby lobby = new Lobby(id, name);
        lobbies.put(id, lobby);
        return lobby;
    }

    // Get all lobbies
    public List<Lobby> getAllLobbies() {
        return new ArrayList<>(lobbies.values());
    }

    // Get a specific lobby
    public Lobby getLobby(String id) {
        return lobbies.get(id);
    }

    // Join a lobby
    public Lobby joinLobby(String id, String playerName) {
        Lobby lobby = lobbies.get(id);
        if (lobby != null) {
            lobby.getPlayers().add(playerName);
        }
        return lobby;
    }
}
