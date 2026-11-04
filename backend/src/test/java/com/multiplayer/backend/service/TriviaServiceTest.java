package com.multiplayer.backend.service;

import com.multiplayer.backend.model.TriviaGameState;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class TriviaServiceTest {

    @Mock
    private LobbyService lobbyService;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    private TriviaService service;

    @BeforeEach
    void setUp() {
        service = new TriviaService(lobbyService, messagingTemplate);
    }

    @Test
    @DisplayName("Create game initializes with WAITING status")
    void createGame() {
        TriviaGameState state = service.createGame("t1", 5, 15);

        assertNotNull(state);
        assertEquals("WAITING", state.getStatus());
        assertEquals(5, state.getTotalRounds());
        assertEquals(15, state.getTimeLimitSeconds());
        assertEquals(0, state.getCurrentRound());
    }

    @Test
    @DisplayName("Join adds player with zero score")
    void joinGame() {
        service.createGame("t2", 5, 15);
        TriviaGameState state = service.joinGame("t2", "Alice");

        assertNotNull(state);
        assertTrue(state.getPlayers().contains("Alice"));
        assertEquals(0, state.getScores().get("Alice"));
    }

    @Test
    @DisplayName("Duplicate join is idempotent")
    void joinGame_idempotent() {
        service.createGame("t3", 5, 15);
        service.joinGame("t3", "Alice");
        TriviaGameState state = service.joinGame("t3", "Alice");

        assertEquals(1, state.getPlayers().size());
    }

    @Test
    @DisplayName("Cannot join after game started")
    void joinGame_afterStart() {
        service.createGame("t4", 5, 15);
        service.joinGame("t4", "Alice");
        service.startGame("t4");
        TriviaGameState state = service.joinGame("t4", "Bob");

        assertNull(state); // rejected
    }

    @Test
    @DisplayName("Start transitions to PLAYING")
    void startGame() {
        service.createGame("t5", 5, 15);
        service.joinGame("t5", "Alice");
        TriviaGameState state = service.startGame("t5");

        assertNotNull(state);
        assertEquals("PLAYING", state.getStatus());
        assertEquals(1, state.getCurrentRound());
        assertNotNull(state.getCurrentQuestion());
        assertEquals(-1, state.getCurrentQuestion().getCorrectIndex()); // hidden
    }

    @Test
    @DisplayName("Correct answer awards 100 points")
    void submitAnswer_correct() {
        service.createGame("t6", 1, 15);
        service.joinGame("t6", "Alice");
        service.startGame("t6");

        // Get the correct answer from the internal state
        TriviaGameState playing = service.getGame("t6");
        // We need to find the correct answer — submit all options
        // The correct index is hidden, so try each
        for (int i = 0; i < 4; i++) {
            service.createGame("t6b-" + i, 1, 15);
            service.joinGame("t6b-" + i, "Alice");
            service.startGame("t6b-" + i);
            TriviaGameState result = service.submitAnswer("t6b-" + i, "Alice", i);
            if (Boolean.TRUE.equals(result.getPlayerCorrect().get("Alice"))) {
                assertTrue(result.getRoundPoints().get("Alice") >= 100);
                return;
            }
        }
        fail("Should have found a correct answer");
    }

    @Test
    @DisplayName("Cannot answer twice")
    void submitAnswer_duplicate() {
        service.createGame("t7", 1, 15);
        service.joinGame("t7", "Alice");
        service.startGame("t7");

        service.submitAnswer("t7", "Alice", 0);
        TriviaGameState state = service.submitAnswer("t7", "Alice", 1);

        assertEquals(0, state.getPlayerAnswers().get("Alice")); // first answer kept
    }

    @Test
    @DisplayName("Reset returns to WAITING")
    void resetGame() {
        service.createGame("t8", 5, 15);
        service.joinGame("t8", "Alice");
        service.startGame("t8");

        assertTrue(service.resetGame("t8"));
        TriviaGameState state = service.getGame("t8");
        assertEquals("WAITING", state.getStatus());
        assertEquals(0, state.getCurrentRound());
        assertEquals(0, state.getScores().get("Alice"));
    }

    @Test
    @DisplayName("Delete removes game")
    void deleteGame() {
        service.createGame("t9", 5, 15);
        assertTrue(service.deleteGame("t9"));
        assertNull(service.getGame("t9"));
    }

    @Test
    @DisplayName("Invalid option index is rejected")
    void submitAnswer_invalidOption() {
        service.createGame("t10", 1, 15);
        service.joinGame("t10", "Alice");
        service.startGame("t10");

        TriviaGameState state = service.submitAnswer("t10", "Alice", 5);
        assertFalse(state.getPlayerAnswers().containsKey("Alice"));
    }
}