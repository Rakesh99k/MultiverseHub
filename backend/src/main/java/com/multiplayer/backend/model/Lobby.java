package com.multiplayer.backend.model;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public class Lobby {
    private String id;
    private String name;
    private List<String> players = new CopyOnWriteArrayList<>();
    private LobbyStatus status = LobbyStatus.WAITING;
    private String gameId;

    public Lobby(String id, String name) {
        this.id = id;
        this.name = name;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public List<String> getPlayers() { return players; }
    public LobbyStatus getStatus() { return status; }
    public String getGameId() { return gameId; }

    public void setId(String id) { this.id = id; }
    public void setName(String name) { this.name = name; }
    public void setPlayers(List<String> players) { this.players = new CopyOnWriteArrayList<>(players); }
    public void setStatus(LobbyStatus status) { this.status = status; }
    public void setGameId(String gameId) { this.gameId = gameId; }
}