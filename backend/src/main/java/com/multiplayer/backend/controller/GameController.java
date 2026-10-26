package com.multiplayer.backend.controller;

import com.multiplayer.backend.model.GameState;
import com.multiplayer.backend.service.GameService;
import com.multiplayer.backend.util.InputValidator;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class GameController {

    private final GameService ticTacToeService;
    private final SimpMessagingTemplate messagingTemplate;

    public GameController(@Qualifier("ticTacToeService") GameService ticTacToeService,
                          SimpMessagingTemplate messagingTemplate) {
        this.ticTacToeService = ticTacToeService;
        this.messagingTemplate = messagingTemplate;
    }

    @PostMapping("/tictactoe/{gameId}/create")
    public ResponseEntity<String> createGame(@PathVariable String gameId) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        if (safeId == null) return ResponseEntity.badRequest().body("Invalid game ID");
        ticTacToeService.createGame(safeId);
        return ResponseEntity.ok("TicTacToe game " + safeId + " created.");
    }

    @GetMapping("/tictactoe/{gameId}")
    public ResponseEntity<GameState> getGame(@PathVariable String gameId) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        if (safeId == null) return ResponseEntity.badRequest().build();
        GameState state = ticTacToeService.getGame(safeId);
        if (state == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(state);
    }

    @PostMapping("/tictactoe/{gameId}/move")
    public ResponseEntity<GameState> makeMove(
            @PathVariable String gameId,
            @RequestParam int row,
            @RequestParam int col,
            @RequestParam String symbol) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        if (safeId == null) return ResponseEntity.badRequest().build();
        if (!symbol.equals("X") && !symbol.equals("O"))
            return ResponseEntity.badRequest().build();
        if (!InputValidator.isValidGridCoord(row, 0, 2) || !InputValidator.isValidGridCoord(col, 0, 2))
            return ResponseEntity.badRequest().build();
        GameState state = ticTacToeService.makeMove(safeId, row, col, symbol);
        if (state == null) return ResponseEntity.notFound().build();
        messagingTemplate.convertAndSend("/topic/tictactoe/" + safeId, state);
        return ResponseEntity.ok(state);
    }

    @PostMapping("/tictactoe/{gameId}/play")
    public ResponseEntity<GameState> makeMoveByPlayer(
            @PathVariable String gameId,
            @RequestParam int row,
            @RequestParam int col,
            @RequestParam String playerName) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        String safeName = InputValidator.sanitizePlayerName(playerName);
        if (safeId == null || safeName == null) return ResponseEntity.badRequest().build();
        if (!InputValidator.isValidGridCoord(row, 0, 2) || !InputValidator.isValidGridCoord(col, 0, 2))
            return ResponseEntity.badRequest().build();
        GameState state = ticTacToeService.makeMoveByPlayer(safeId, row, col, safeName);
        if (state == null) return ResponseEntity.notFound().build();
        messagingTemplate.convertAndSend("/topic/tictactoe/" + safeId, state);
        return ResponseEntity.ok(state);
    }

    @PostMapping("/tictactoe/{gameId}/reset")
    public ResponseEntity<GameState> resetGame(@PathVariable String gameId) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        if (safeId == null) return ResponseEntity.badRequest().build();
        GameState check = ticTacToeService.getGame(safeId);
        if (check == null) return ResponseEntity.notFound().build();
        ticTacToeService.resetGame(safeId);
        GameState state = ticTacToeService.getGame(safeId);
        messagingTemplate.convertAndSend("/topic/tictactoe/" + safeId, state);
        return ResponseEntity.ok(state);
    }

    @DeleteMapping("/tictactoe/{gameId}")
    public ResponseEntity<String> deleteGame(@PathVariable String gameId) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        if (safeId == null) return ResponseEntity.badRequest().build();
        boolean deleted = ticTacToeService.deleteGame(safeId);
        if (!deleted) return ResponseEntity.notFound().build();
        return ResponseEntity.ok("Game " + safeId + " deleted.");
    }
}