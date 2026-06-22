package com.multiplayer.backend.controller;

import com.multiplayer.backend.model.SudokuGameState;
import com.multiplayer.backend.service.SudokuService;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sudoku")
public class SudokuController {

    private final SudokuService sudokuService;
    private final SimpMessagingTemplate messagingTemplate;

    public SudokuController(SudokuService sudokuService, SimpMessagingTemplate messagingTemplate) {
        this.sudokuService = sudokuService;
        this.messagingTemplate = messagingTemplate;
    }

    // Create a new Sudoku game
    @PostMapping("/{gameId}/create")
    public ResponseEntity<SudokuGameState> createGame(
            @PathVariable String gameId,
            @RequestParam(defaultValue = "medium") String difficulty,
            @RequestParam(defaultValue = "collaborative") String mode) {
        SudokuGameState s = sudokuService.createGame(gameId, difficulty, mode);
        if (s == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(s);
    }

    // Get game state
    @GetMapping("/{gameId}")
    public ResponseEntity<SudokuGameState> getGame(@PathVariable String gameId) {
        SudokuGameState s = sudokuService.getGame(gameId);
        if (s == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(s);
    }

    // Join the game
    @PostMapping("/{gameId}/join")
    public ResponseEntity<SudokuGameState> join(@PathVariable String gameId,
                                                @RequestParam String playerName) {
        SudokuGameState s = sudokuService.joinGame(gameId, playerName);
        if (s == null) return ResponseEntity.badRequest().build();
        messagingTemplate.convertAndSend("/topic/sudoku/" + gameId, s);
        return ResponseEntity.ok(s);
    }

    // Make a move (value 0 = erase)
    @PostMapping("/{gameId}/move")
    public ResponseEntity<SudokuGameState> makeMove(
            @PathVariable String gameId,
            @RequestParam String playerName,
            @RequestParam int row,
            @RequestParam int col,
            @RequestParam int value) {
        SudokuGameState s = sudokuService.makeMove(gameId, playerName, row, col, value);
        if (s == null) return ResponseEntity.notFound().build();
        messagingTemplate.convertAndSend("/topic/sudoku/" + gameId, s);
        return ResponseEntity.ok(s);
    }

    // Get a hint for a specific cell
    @GetMapping("/{gameId}/hint")
    public ResponseEntity<Map<String, Integer>> hint(@PathVariable String gameId,
                                                     @RequestParam int row,
                                                     @RequestParam int col) {
        Integer val = sudokuService.getHint(gameId, row, col);
        if (val == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("row", row, "col", col, "value", val));
    }

    // Validate the current board — returns list of wrong cells as "row,col"
    @GetMapping("/{gameId}/validate")
    public ResponseEntity<Map<String, Object>> validate(@PathVariable String gameId) {
        List<String> wrong = sudokuService.validateBoard(gameId);
        if (wrong == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("wrongCells", wrong, "count", wrong.size()));
    }

    // Reset to the initial puzzle (keep players)
    @PostMapping("/{gameId}/reset")
    public ResponseEntity<SudokuGameState> reset(@PathVariable String gameId) {
        boolean ok = sudokuService.resetGame(gameId);
        if (!ok) return ResponseEntity.notFound().build();
        SudokuGameState s = sudokuService.getGame(gameId);
        messagingTemplate.convertAndSend("/topic/sudoku/" + gameId, s);
        return ResponseEntity.ok(s);
    }

    // Delete the game
    @DeleteMapping("/{gameId}")
    public ResponseEntity<String> delete(@PathVariable String gameId) {
        boolean ok = sudokuService.deleteGame(gameId);
        if (!ok) return ResponseEntity.notFound().build();
        return ResponseEntity.ok("Sudoku game " + gameId + " deleted.");
    }
}
