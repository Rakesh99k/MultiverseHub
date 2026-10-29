package com.multiplayer.backend.util;

import java.util.regex.Pattern;

/**
 * Centralized input sanitization and validation.
 * Prevents XSS, injection, and path traversal attacks.
 */
public final class InputValidator {

    private static final Pattern SAFE_NAME = Pattern.compile("^[a-zA-Z0-9 _\\-]{1,20}$");
    private static final Pattern SAFE_GAME_ID = Pattern.compile("^[a-zA-Z0-9\\-]{1,100}$");
    private static final Pattern SAFE_MOVE = Pattern.compile("^[a-zA-Z0-9\\-+=#]{1,10}$");

    private InputValidator() {}

    /**
     * Validate and sanitize a player name.
     * Rules: 1-20 chars, alphanumeric + spaces + underscores + hyphens.
     * Returns null if invalid.
     */
    public static String sanitizePlayerName(String name) {
        if (name == null) return null;
        String trimmed = name.trim();
        if (trimmed.isEmpty()) return null;
        if (!SAFE_NAME.matcher(trimmed).matches()) return null;
        return trimmed;
    }

    /**
     * Validate a game ID.
     * Rules: 1-100 chars, alphanumeric + hyphens.
     * Returns null if invalid.
     */
    public static String sanitizeGameId(String gameId) {
        if (gameId == null) return null;
        String trimmed = gameId.trim();
        if (trimmed.isEmpty()) return null;
        if (!SAFE_GAME_ID.matcher(trimmed).matches()) return null;
        return trimmed;
    }

    /**
     * Validate a chess move string.
     * Rules: 1-10 chars, alphanumeric + special chess notation chars.
     * Returns null if invalid.
     */
    public static String sanitizeMove(String move) {
        if (move == null) return null;
        String trimmed = move.trim();
        if (trimmed.isEmpty()) return null;
        if (!SAFE_MOVE.matcher(trimmed).matches()) return null;
        return trimmed;
    }

    /**
     * Validate row/col bounds for grid games.
     */
    public static boolean isValidGridCoord(int value, int min, int max) {
        return value >= min && value <= max;
    }

    /**
     * Validate Sudoku value (0-9, where 0 = erase).
     */
    public static boolean isValidSudokuValue(int value) {
        return value >= 0 && value <= 9;
    }

    /**
     * Validate trivia option index (0-3).
     */
    public static boolean isValidOptionIndex(int index) {
        return index >= 0 && index <= 3;
    }
}