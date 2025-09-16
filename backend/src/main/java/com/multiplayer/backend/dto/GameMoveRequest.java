package com.multiplayer.backend.dto;

public class GameMoveRequest {
    private String playerId;
    private String move; // could be a position, action, etc.

    public GameMoveRequest() {}

    public GameMoveRequest(String playerId, String move) {
        this.playerId = playerId;
        this.move = move;
    }

    public String getPlayerId() {
        return playerId;
    }

    public void setPlayerId(String playerId) {
        this.playerId = playerId;
    }

    public String getMove() {
        return move;
    }

    public void setMove(String move) {
        this.move = move;
    }
}
