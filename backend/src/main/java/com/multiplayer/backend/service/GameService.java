package com.multiplayer.backend.service;

import com.multiplayer.backend.model.GameState;

public interface GameService {
    void createGame(String gameId);
    GameState getGame(String gameId);
    GameState makeMove(String gameId, int row, int col, String symbol);
}
