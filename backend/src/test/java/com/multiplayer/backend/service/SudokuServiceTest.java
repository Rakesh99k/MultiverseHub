package com.multiplayer.backend.service;

import com.multiplayer.backend.model.SudokuGameState;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SudokuServiceTest {

    private SudokuService service;

    @BeforeEach
    void setUp() {
        service = new SudokuService();
    }

    @Test
    @DisplayName("Create game generates valid puzzle")
    void createGame_generatesPuzzle() {
        SudokuGameState state = service.createGame("s1", "easy", "collaborative");

        assertNotNull(state);
        assertNotNull(state.getBoard());
        assertNotNull(state.getFixed());
        assertEquals("easy", state.getDifficulty());
        assertEquals("collaborative", state.getMode());
        assertEquals("PLAYING", state.getStatus());
        assertEquals(0, state.getMistakes());

        // Count clues — easy should have ~40
        int clues = 0;
        for (int r = 0; r < 9; r++)
            for (int c = 0; c < 9; c++)
                if (state.getFixed()[r][c]) clues++;

        assertEquals(40, clues);
    }

    @Test
    @DisplayName("Hard difficulty has fewer clues")
    void createGame_hardDifficulty() {
        SudokuGameState state = service.createGame("s2", "hard", "competitive");
        int clues = 0;
        for (int r = 0; r < 9; r++)
            for (int c = 0; c < 9; c++)
                if (state.getFixed()[r][c]) clues++;
        assertEquals(26, clues);
    }

    @Test
    @DisplayName("Valid move is accepted")
    void makeMove_validMove() {
        SudokuGameState state = service.createGame("s3", "medium", "collaborative");
        service.joinGame("s3", "Alice");

        // Find an empty cell
        int emptyRow = -1, emptyCol = -1;
        for (int r = 0; r < 9 && emptyRow == -1; r++)
            for (int c = 0; c < 9 && emptyRow == -1; c++)
                if (!state.getFixed()[r][c]) {
                    emptyRow = r;
                    emptyCol = c;
                }

        assertTrue(emptyRow >= 0, "Should have at least one empty cell");

        // Get the correct value from hint
        Integer correctValue = service.getHint("s3", emptyRow, emptyCol);
        assertNotNull(correctValue);

        SudokuGameState updated = service.makeMove("s3", "Alice", emptyRow, emptyCol, correctValue);
        assertEquals(correctValue, updated.getBoard()[emptyRow][emptyCol]);
    }

    @Test
    @DisplayName("Fixed cell cannot be overwritten")
    void makeMove_fixedCell() {
        SudokuGameState state = service.createGame("s4", "easy", "collaborative");
        service.joinGame("s4", "Alice");

        // Find a fixed cell
        int fixedRow = -1, fixedCol = -1;
        for (int r = 0; r < 9 && fixedRow == -1; r++)
            for (int c = 0; c < 9 && fixedRow == -1; c++)
                if (state.getFixed()[r][c]) {
                    fixedRow = r;
                    fixedCol = c;
                }

        int originalValue = state.getBoard()[fixedRow][fixedCol];
        SudokuGameState updated = service.makeMove("s4", "Alice", fixedRow, fixedCol, 9);
        assertEquals(originalValue, updated.getBoard()[fixedRow][fixedCol]); // unchanged
    }

    @Test
    @DisplayName("Wrong move increments mistakes")
    void makeMove_wrongMove() {
        SudokuGameState state = service.createGame("s5", "medium", "collaborative");
        service.joinGame("s5", "Alice");

        // Find an empty cell and place wrong value
        for (int r = 0; r < 9; r++) {
            for (int c = 0; c < 9; c++) {
                if (!state.getFixed()[r][c]) {
                    int correct = service.getHint("s5", r, c);
                    int wrong = (correct % 9) + 1; // different from correct
                    if (wrong != correct) {
                        SudokuGameState updated = service.makeMove("s5", "Alice", r, c, wrong);
                        assertEquals(1, updated.getMistakes());
                        return;
                    }
                }
            }
        }
    }

    @Test
    @DisplayName("Validate returns wrong cells")
    void validateBoard() {
        SudokuGameState state = service.createGame("s6", "medium", "collaborative");
        service.joinGame("s6", "Alice");

        // Place a wrong value
        for (int r = 0; r < 9; r++) {
            for (int c = 0; c < 9; c++) {
                if (!state.getFixed()[r][c]) {
                    int correct = service.getHint("s6", r, c);
                    int wrong = (correct % 9) + 1;
                    if (wrong != correct) {
                        service.makeMove("s6", "Alice", r, c, wrong);
                        var wrongCells = service.validateBoard("s6");
                        assertTrue(wrongCells.contains(r + "," + c));
                        return;
                    }
                }
            }
        }
    }

    @Test
    @DisplayName("Reset restores initial board")
    void resetGame() {
        SudokuGameState state = service.createGame("s7", "easy", "collaborative");
        int[][] initial = state.getInitialBoard();

        // Make a move
        for (int r = 0; r < 9; r++)
            for (int c = 0; c < 9; c++)
                if (!state.getFixed()[r][c]) {
                    service.makeMove("s7", "Alice", r, c, 5);
                    service.resetGame("s7");
                    SudokuGameState reset = service.getGame("s7");
                    assertEquals(initial[r][c], reset.getBoard()[r][c]);
                    assertEquals(0, reset.getMistakes());
                    assertEquals("PLAYING", reset.getStatus());
                    return;
                }
    }

    @Test
    @DisplayName("Cell correctness check works")
    void isCellCorrect() {
        service.createGame("s8", "medium", "collaborative");
        service.joinGame("s8", "Alice");

        for (int r = 0; r < 9; r++) {
            for (int c = 0; c < 9; c++) {
                if (!service.getGame("s8").getFixed()[r][c]) {
                    int correct = service.getHint("s8", r, c);
                    service.makeMove("s8", "Alice", r, c, correct);
                    assertTrue(service.isCellCorrect("s8", r, c));
                    return;
                }
            }
        }
    }
}