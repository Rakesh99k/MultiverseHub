package com.multiplayer.backend.controller;

import com.multiplayer.backend.model.GameState;
import com.multiplayer.backend.service.GameService;
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

    // Create a standalone TicTacToe game (no players assigned)
    @PostMapping("/tictactoe/{gameId}/create")
    public ResponseEntity<String> createGame(@PathVariable String gameId) {
        ticTacToeService.createGame(gameId);
        return ResponseEntity.ok("TicTacToe game " + gameId + " created.");
    }

    // Get current state
    @GetMapping("/tictactoe/{gameId}")
    public ResponseEntity<GameState> getGame(@PathVariable String gameId) {
        GameState state = ticTacToeService.getGame(gameId);
        if (state == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(state);
    }

    // Make a move by symbol (legacy / standalone games)
    @PostMapping("/tictactoe/{gameId}/move")
    public ResponseEntity<GameState> makeMove(
            @PathVariable String gameId,
            @RequestParam int row,
            @RequestParam int col,
            @RequestParam String symbol) {
        if (!symbol.equals("X") && !symbol.equals("O"))
            return ResponseEntity.badRequest().build();
        GameState state = ticTacToeService.makeMove(gameId, row, col, symbol);
        if (state == null) return ResponseEntity.notFound().build();
        messagingTemplate.convertAndSend("/topic/tictactoe/" + gameId, state);
        return ResponseEntity.ok(state);
    }

    // Make a move by playerName (lobby-linked games — auto-resolves symbol)
    @PostMapping("/tictactoe/{gameId}/play")
    public ResponseEntity<GameState> makeMoveByPlayer(
            @PathVariable String gameId,
            @RequestParam int row,
            @RequestParam int col,
            @RequestParam String playerName) {
        if (playerName == null || playerName.isBlank())
            return ResponseEntity.badRequest().build();
        GameState state = ticTacToeService.makeMoveByPlayer(gameId, row, col, playerName);
        if (state == null) return ResponseEntity.notFound().build();
        messagingTemplate.convertAndSend("/topic/tictactoe/" + gameId, state);
        return ResponseEntity.ok(state);
    }

    // Reset / rematch — clears board but keeps player assignments
    @PostMapping("/tictactoe/{gameId}/reset")
    public ResponseEntity<GameState> resetGame(@PathVariable String gameId) {
        GameState state = ticTacToeService.getGame(gameId);
        if (state == null) return ResponseEntity.notFound().build();
        ticTacToeService.resetGame(gameId);
        messagingTemplate.convertAndSend("/topic/tictactoe/" + gameId, state);
        return ResponseEntity.ok(state);
    }

    // Delete a game
    @DeleteMapping("/tictactoe/{gameId}")
    public ResponseEntity<String> deleteGame(@PathVariable String gameId) {
        boolean deleted = ticTacToeService.deleteGame(gameId);
        if (!deleted) return ResponseEntity.notFound().build();
        return ResponseEntity.ok("Game " + gameId + " deleted.");
    }
}
