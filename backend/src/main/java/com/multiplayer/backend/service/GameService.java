package com.multiplayer.backend.service;

import com.multiplayer.backend.model.GameState;

public interface GameService {
    void createGame(String gameId);
    void createGame(String gameId, String playerX, String playerO); // linked to lobby players
    GameState getGame(String gameId);
    GameState makeMove(String gameId, int row, int col, String symbol);
    GameState makeMoveByPlayer(String gameId, int row, int col, String playerName);
    void resetGame(String gameId);
    boolean deleteGame(String gameId);
}
