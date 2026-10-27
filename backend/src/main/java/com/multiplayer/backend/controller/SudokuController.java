package com.multiplayer.backend.controller;

import com.multiplayer.backend.model.SudokuGameState;
import com.multiplayer.backend.service.SudokuService;
import com.multiplayer.backend.util.InputValidator;
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

    @PostMapping("/{gameId}/create")
    public ResponseEntity<SudokuGameState> createGame(
            @PathVariable String gameId,
            @RequestParam(defaultValue = "medium") String difficulty,
            @RequestParam(defaultValue = "collaborative") String mode) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        if (safeId == null) return ResponseEntity.badRequest().build();
        if (!List.of("easy", "medium", "hard").contains(difficulty.toLowerCase()))
            return ResponseEntity.badRequest().build();
        if (!List.of("collaborative", "competitive").contains(mode.toLowerCase()))
            return ResponseEntity.badRequest().build();
        SudokuGameState s = sudokuService.createGame(safeId, difficulty, mode);
        if (s == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(s);
    }

    @GetMapping("/{gameId}")
    public ResponseEntity<SudokuGameState> getGame(@PathVariable String gameId) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        if (safeId == null) return ResponseEntity.badRequest().build();
        SudokuGameState s = sudokuService.getGame(safeId);
        if (s == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(s);
    }

    @PostMapping("/{gameId}/join")
    public ResponseEntity<SudokuGameState> join(@PathVariable String gameId,
                                                @RequestParam String playerName) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        String safeName = InputValidator.sanitizePlayerName(playerName);
        if (safeId == null || safeName == null) return ResponseEntity.badRequest().build();
        SudokuGameState s = sudokuService.joinGame(safeId, safeName);
        if (s == null) return ResponseEntity.badRequest().build();
        messagingTemplate.convertAndSend("/topic/sudoku/" + safeId, s);
        return ResponseEntity.ok(s);
    }

    @PostMapping("/{gameId}/move")
    public ResponseEntity<SudokuGameState> makeMove(
            @PathVariable String gameId,
            @RequestParam String playerName,
            @RequestParam int row,
            @RequestParam int col,
            @RequestParam int value) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        String safeName = InputValidator.sanitizePlayerName(playerName);
        if (safeId == null || safeName == null) return ResponseEntity.badRequest().build();
        if (!InputValidator.isValidGridCoord(row, 0, 8) || !InputValidator.isValidGridCoord(col, 0, 8))
            return ResponseEntity.badRequest().build();
        if (!InputValidator.isValidSudokuValue(value))
            return ResponseEntity.badRequest().build();
        SudokuGameState s = sudokuService.makeMove(safeId, safeName, row, col, value);
        if (s == null) return ResponseEntity.notFound().build();
        messagingTemplate.convertAndSend("/topic/sudoku/" + safeId, s);
        return ResponseEntity.ok(s);
    }

    @GetMapping("/{gameId}/hint")
    public ResponseEntity<Map<String, Integer>> hint(@PathVariable String gameId,
                                                     @RequestParam int row,
                                                     @RequestParam int col) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        if (safeId == null) return ResponseEntity.badRequest().build();
        if (!InputValidator.isValidGridCoord(row, 0, 8) || !InputValidator.isValidGridCoord(col, 0, 8))
            return ResponseEntity.badRequest().build();
        Integer val = sudokuService.getHint(safeId, row, col);
        if (val == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("row", row, "col", col, "value", val));
    }

    @GetMapping("/{gameId}/check")
    public ResponseEntity<Map<String, Object>> checkCell(@PathVariable String gameId,
                                                         @RequestParam int row,
                                                         @RequestParam int col) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        if (safeId == null) return ResponseEntity.badRequest().build();
        if (!InputValidator.isValidGridCoord(row, 0, 8) || !InputValidator.isValidGridCoord(col, 0, 8))
            return ResponseEntity.badRequest().build();
        Boolean correct = sudokuService.isCellCorrect(safeId, row, col);
        if (correct == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("row", row, "col", col, "correct", correct));
    }

    @GetMapping("/{gameId}/validate")
    public ResponseEntity<Map<String, Object>> validate(@PathVariable String gameId) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        if (safeId == null) return ResponseEntity.badRequest().build();
        List<String> wrong = sudokuService.validateBoard(safeId);
        if (wrong == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("wrongCells", wrong, "count", wrong.size()));
    }

    @PostMapping("/{gameId}/reset")
    public ResponseEntity<SudokuGameState> reset(@PathVariable String gameId) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        if (safeId == null) return ResponseEntity.badRequest().build();
        boolean ok = sudokuService.resetGame(safeId);
        if (!ok) return ResponseEntity.notFound().build();
        SudokuGameState s = sudokuService.getGame(safeId);
        messagingTemplate.convertAndSend("/topic/sudoku/" + safeId, s);
        return ResponseEntity.ok(s);
    }

    @DeleteMapping("/{gameId}")
    public ResponseEntity<String> delete(@PathVariable String gameId) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        if (safeId == null) return ResponseEntity.badRequest().build();
        boolean ok = sudokuService.deleteGame(safeId);
        if (!ok) return ResponseEntity.notFound().build();
        return ResponseEntity.ok("Sudoku game " + safeId + " deleted.");
    }
}