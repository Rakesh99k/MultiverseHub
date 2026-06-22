package com.multiplayer.backend.service;

import com.multiplayer.backend.model.GameState;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service("ticTacToeService") // specific bean name
public class TicTacToeService implements GameService {

    private final ConcurrentMap<String, GameState> games = new ConcurrentHashMap<>();

    @Override
    public void createGame(String gameId) {
        games.putIfAbsent(gameId, new GameState());
    }

    @Override
    public void createGame(String gameId, String playerX, String playerO) {
        GameState state = new GameState();
        state.setPlayerX(playerX);
        state.setPlayerO(playerO);
        games.putIfAbsent(gameId, state);
    }

    @Override
    public GameState getGame(String gameId) {
        return games.get(gameId);
    }

    @Override
    public GameState makeMove(String gameId, int row, int col, String symbol) {
        GameState state = games.get(gameId);
        if (state == null) return null;

        if (state.getWinner() != null) return state; // already ended
        if (!symbol.equals(state.getCurrentPlayer())) {
            return state; // wrong turn
        }

        String[][] b = state.getBoard();
        if (row < 0 || row > 2 || col < 0 || col > 2) return state;
        if (!"-".equals(b[row][col])) return state; // already occupied

        b[row][col] = symbol;

        if (checkWinner(b, symbol)) {
            state.setWinner(symbol);
        } else if (isBoardFull(b)) {
            state.setWinner("DRAW");
        } else {
            state.switchPlayer();
        }

        return state;
    }

    @Override
    public GameState makeMoveByPlayer(String gameId, int row, int col, String playerName) {
        GameState state = games.get(gameId);
        if (state == null) return null;

        if (state.getWinner() != null) return state; // already ended

        String symbol = state.symbolForPlayer(playerName);
        if (symbol == null) return state; // player not in this game
        if (!symbol.equals(state.getCurrentPlayer())) return state; // not their turn

        String[][] b = state.getBoard();
        if (row < 0 || row > 2 || col < 0 || col > 2) return state;
        if (!"-".equals(b[row][col])) return state; // already occupied

        b[row][col] = symbol;

        if (checkWinner(b, symbol)) {
            state.setWinner(symbol);
        } else if (isBoardFull(b)) {
            state.setWinner("DRAW");
        } else {
            state.switchPlayer();
        }

        return state;
    }

    @Override
    public void resetGame(String gameId) {
        GameState state = games.get(gameId);
        if (state != null) state.reset();
    }

    @Override
    public boolean deleteGame(String gameId) {
        return games.remove(gameId) != null;
    }

    private boolean checkWinner(String[][] b, String p) {
        for (int i = 0; i < 3; i++) {
            if (p.equals(b[i][0]) && p.equals(b[i][1]) && p.equals(b[i][2])) return true;
            if (p.equals(b[0][i]) && p.equals(b[1][i]) && p.equals(b[2][i])) return true;
        }
        return (p.equals(b[0][0]) && p.equals(b[1][1]) && p.equals(b[2][2])) ||
                (p.equals(b[0][2]) && p.equals(b[1][1]) && p.equals(b[2][0]));
    }

    private boolean isBoardFull(String[][] b) {
        for (String[] row : b)
            for (String cell : row)
                if ("-".equals(cell)) return false;
        return true;
    }
}
