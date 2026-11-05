package com.multiplayer.backend.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class InputValidatorTest {

    @Test
    @DisplayName("Valid player names accepted")
    void sanitizePlayerName_valid() {
        assertEquals("Alice", InputValidator.sanitizePlayerName("Alice"));
        assertEquals("Bob 123", InputValidator.sanitizePlayerName("Bob 123"));
        assertEquals("Player_One", InputValidator.sanitizePlayerName("Player_One"));
        assertEquals("test-player", InputValidator.sanitizePlayerName("test-player"));
    }

    @Test
    @DisplayName("Invalid player names rejected")
    void sanitizePlayerName_invalid() {
        assertNull(InputValidator.sanitizePlayerName(null));
        assertNull(InputValidator.sanitizePlayerName(""));
        assertNull(InputValidator.sanitizePlayerName("   "));
        assertNull(InputValidator.sanitizePlayerName("<script>alert(1)</script>"));
        assertNull(InputValidator.sanitizePlayerName("a".repeat(21))); // too long
        assertNull(InputValidator.sanitizePlayerName("Alice@#$"));
    }

    @Test
    @DisplayName("Valid game IDs accepted")
    void sanitizeGameId_valid() {
        assertEquals("game-123", InputValidator.sanitizeGameId("game-123"));
        assertEquals("trivia-abc-def", InputValidator.sanitizeGameId("trivia-abc-def"));
    }

    @Test
    @DisplayName("Invalid game IDs rejected")
    void sanitizeGameId_invalid() {
        assertNull(InputValidator.sanitizeGameId(null));
        assertNull(InputValidator.sanitizeGameId(""));
        assertNull(InputValidator.sanitizeGameId("../../../etc/passwd"));
        assertNull(InputValidator.sanitizeGameId("game id with spaces"));
    }

    @Test
    @DisplayName("Valid moves accepted")
    void sanitizeMove_valid() {
        assertEquals("e4", InputValidator.sanitizeMove("e4"));
        assertEquals("e2e4", InputValidator.sanitizeMove("e2e4"));
        assertEquals("O-O", InputValidator.sanitizeMove("O-O"));
        assertEquals("Nf3", InputValidator.sanitizeMove("Nf3"));
        assertEquals("e8=Q", InputValidator.sanitizeMove("e8=Q"));
    }

    @Test
    @DisplayName("Invalid moves rejected")
    void sanitizeMove_invalid() {
        assertNull(InputValidator.sanitizeMove(null));
        assertNull(InputValidator.sanitizeMove(""));
        assertNull(InputValidator.sanitizeMove("<script>"));
        assertNull(InputValidator.sanitizeMove("a".repeat(11))); // too long
    }

    @Test
    @DisplayName("Grid coordinate validation")
    void isValidGridCoord() {
        assertTrue(InputValidator.isValidGridCoord(0, 0, 8));
        assertTrue(InputValidator.isValidGridCoord(8, 0, 8));
        assertFalse(InputValidator.isValidGridCoord(-1, 0, 8));
        assertFalse(InputValidator.isValidGridCoord(9, 0, 8));
    }
}