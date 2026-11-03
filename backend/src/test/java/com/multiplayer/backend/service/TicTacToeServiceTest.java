package com.multiplayer.backend.service;

import com.multiplayer.backend.model.GameState;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class TicTacToeServiceTest {

    @Mock
    private LobbyService lobbyService;

    private TicTacToeService service;

    @BeforeEach
    void setUp() {
        service = new TicTacToeService(lobbyService);
    }

    @Test
    @DisplayName("Create game initializes empty board")
    void createGame_initializesEmptyBoard() {
        service.createGame("g1", "Alice", "Bob");
        GameState state = service.getGame("g1");

        assertNotNull(state);
        assertEquals("Alice", state.getPlayerX());
        assertEquals("Bob", state.getPlayerO());
        assertEquals("X", state.getCurrentPlayer());
        assertNull(state.getWinner());

        for (int r = 0; r < 3; r++)
            for (int c = 0; c < 3; c++)
                assertEquals("-", state.getBoard()[r][c]);
    }

    @Test
    @DisplayName("Valid move places symbol and switches turn")
    void makeMove_validMove() {
        service.createGame("g2", "Alice", "Bob");
        GameState state = service.makeMoveByPlayer("g2", 0, 0, "Alice");

        assertNotNull(state);
        assertEquals("X", state.getBoard()[0][0]);
        assertEquals("O", state.getCurrentPlayer());
    }

    @Test
    @DisplayName("Wrong turn is rejected")
    void makeMove_wrongTurn() {
        service.createGame("g3", "Alice", "Bob");
        GameState state = service.makeMoveByPlayer("g3", 0, 0, "Bob");

        assertNotNull(state);
        assertEquals("-", state.getBoard()[0][0]); // unchanged
        assertEquals("X", state.getCurrentPlayer());
    }

    @Test
    @DisplayName("Occupied cell is rejected")
    void makeMove_occupiedCell() {
        service.createGame("g4", "Alice", "Bob");
        service.makeMoveByPlayer("g4", 0, 0, "Alice");
        GameState state = service.makeMoveByPlayer("g4", 0, 0, "Bob");

        assertEquals("X", state.getBoard()[0][0]); // still X
    }

    @Test
    @DisplayName("Row win detected correctly")
    void makeMove_rowWin() {
        service.createGame("g5", "Alice", "Bob");
        service.makeMoveByPlayer("g5", 0, 0, "Alice"); // X
        service.makeMoveByPlayer("g5", 1, 0, "Bob");   // O
        service.makeMoveByPlayer("g5", 0, 1, "Alice"); // X
        service.makeMoveByPlayer("g5", 1, 1, "Bob");   // O
        GameState state = service.makeMoveByPlayer("g5", 0, 2, "Alice"); // X wins

        assertEquals("X", state.getWinner());
    }

    @Test
    @DisplayName("Draw detected when board is full")
    void makeMove_draw() {
        service.createGame("g6", "Alice", "Bob");
        // X O X
        // X X O
        // O X O
        service.makeMoveByPlayer("g6", 0, 0, "Alice"); // X
        service.makeMoveByPlayer("g6", 0, 1, "Bob");   // O
        service.makeMoveByPlayer("g6", 0, 2, "Alice"); // X
        service.makeMoveByPlayer("g6", 1, 2, "Bob");   // O
        service.makeMoveByPlayer("g6", 1, 0, "Alice"); // X
        service.makeMoveByPlayer("g6", 2, 0, "Bob");   // O
        service.makeMoveByPlayer("g6", 1, 1, "Alice"); // X
        service.makeMoveByPlayer("g6", 2, 2, "Bob");   // O
        GameState state = service.makeMoveByPlayer("g6", 2, 1, "Alice"); // X

        assertEquals("DRAW", state.getWinner());
    }

    @Test
    @DisplayName("Move after game over is rejected")
    void makeMove_afterGameOver() {
        service.createGame("g7", "Alice", "Bob");
        service.makeMoveByPlayer("g7", 0, 0, "Alice");
        service.makeMoveByPlayer("g7", 1, 0, "Bob");
        service.makeMoveByPlayer("g7", 0, 1, "Alice");
        service.makeMoveByPlayer("g7", 1, 1, "Bob");
        service.makeMoveByPlayer("g7", 0, 2, "Alice"); // X wins

        GameState state = service.makeMoveByPlayer("g7", 2, 2, "Bob");
        assertEquals("X", state.getWinner()); // unchanged
    }

    @Test
    @DisplayName("Reset clears board but keeps players")
    void resetGame_keepsPlayers() {
        service.createGame("g8", "Alice", "Bob");
        service.makeMoveByPlayer("g8", 0, 0, "Alice");
        service.resetGame("g8");

        GameState state = service.getGame("g8");
        assertEquals("Alice", state.getPlayerX());
        assertEquals("Bob", state.getPlayerO());
        assertEquals("X", state.getCurrentPlayer());
        assertEquals("-", state.getBoard()[0][0]);
    }

    @Test
    @DisplayName("Out of bounds move is rejected")
    void makeMove_outOfBounds() {
        service.createGame("g9", "Alice", "Bob");
        GameState state = service.makeMoveByPlayer("g9", 5, 5, "Alice");
        assertEquals("-", state.getBoard()[0][0]); // unchanged
    }

    @Test
    @DisplayName("Unknown player is rejected")
    void makeMove_unknownPlayer() {
        service.createGame("g10", "Alice", "Bob");
        GameState state = service.makeMoveByPlayer("g10", 0, 0, "Charlie");
        assertEquals("-", state.getBoard()[0][0]);
    }

    @Test
    @DisplayName("Delete removes game")
    void deleteGame() {
        service.createGame("g11", "Alice", "Bob");
        assertTrue(service.deleteGame("g11"));
        assertNull(service.getGame("g11"));
    }
}