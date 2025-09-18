package com.multiplayer.backend.model;

import java.util.ArrayList;
import java.util.List;

public class Lobby {
    private String id;
    private String name;
    private List<String> players = new ArrayList<>();

    public Lobby(String id, String name) {
        this.id = id;
        this.name = name;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public List<String> getPlayers() { return players; }

    public void setId(String id) { this.id = id; }
    public void setName(String name) { this.name = name; }
    public void setPlayers(List<String> players) { this.players = players; }
}
