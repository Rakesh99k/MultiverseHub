package com.multiplayer.backend.controller;

import com.multiplayer.backend.model.ChessGameState;
import com.multiplayer.backend.service.ChessService;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chess")
public class ChessController {

    private final ChessService chessService;
    private final SimpMessagingTemplate messagingTemplate;

    public ChessController(ChessService chessService, SimpMessagingTemplate messagingTemplate) {
        this.chessService = chessService;
        this.messagingTemplate = messagingTemplate;
    }

    // Create a chess game: assign white and black players
    @PostMapping("/{gameId}/create")
    public ResponseEntity<String> createGame(@PathVariable String gameId,
                                             @RequestParam String white,
                                             @RequestParam String black) {
        if (white == null || white.isBlank() || black == null || black.isBlank())
            return ResponseEntity.badRequest().body("Both players required");
        chessService.createGame(gameId, white.trim(), black.trim());
        return ResponseEntity.ok("Chess game " + gameId + " created.");
    }

    // Get game state (FEN, legal moves, status, move history, players)
    @GetMapping("/{gameId}")
    public ResponseEntity<ChessGameState> getGame(@PathVariable String gameId) {
        ChessGameState s = chessService.getGame(gameId);
        if (s == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(s);
    }

    // Submit a move (SAN e.g. "e4", "Nf3", "O-O" or UCI e.g. "e2e4", "g1f3")
    @PostMapping("/{gameId}/move")
    public ResponseEntity<ChessGameState> makeMove(@PathVariable String gameId,
                                                   @RequestParam String playerName,
                                                   @RequestParam String move) {
        if (playerName == null || playerName.isBlank() || move == null || move.isBlank())
            return ResponseEntity.badRequest().build();

        ChessGameState s = chessService.makeMove(gameId, playerName.trim(), move.trim());
        if (s == null) return ResponseEntity.notFound().build();

        messagingTemplate.convertAndSend("/topic/chess/" + gameId, s);
        return ResponseEntity.ok(s);
    }

    // Resign — the player who calls this loses
    @PostMapping("/{gameId}/resign")
    public ResponseEntity<ChessGameState> resign(@PathVariable String gameId,
                                                 @RequestParam String playerName) {
        if (playerName == null || playerName.isBlank())
            return ResponseEntity.badRequest().build();
        ChessGameState s = chessService.resign(gameId, playerName.trim());
        if (s == null) return ResponseEntity.notFound().build();
        messagingTemplate.convertAndSend("/topic/chess/" + gameId, s);
        return ResponseEntity.ok(s);
    }

    // Declare draw (simplified: mutual agreement assumed)
    @PostMapping("/{gameId}/draw")
    public ResponseEntity<ChessGameState> declareDraw(@PathVariable String gameId) {
        ChessGameState s = chessService.declareDraw(gameId);
        if (s == null) return ResponseEntity.notFound().build();
        messagingTemplate.convertAndSend("/topic/chess/" + gameId, s);
        return ResponseEntity.ok(s);
    }

    // Reset game (rematch — same players, fresh board)
    @PostMapping("/{gameId}/reset")
    public ResponseEntity<ChessGameState> reset(@PathVariable String gameId) {
        boolean ok = chessService.resetGame(gameId);
        if (!ok) return ResponseEntity.notFound().build();
        ChessGameState s = chessService.getGame(gameId);
        messagingTemplate.convertAndSend("/topic/chess/" + gameId, s);
        return ResponseEntity.ok(s);
    }

    // Delete game
    @DeleteMapping("/{gameId}")
    public ResponseEntity<String> delete(@PathVariable String gameId) {
        boolean ok = chessService.deleteGame(gameId);
        if (!ok) return ResponseEntity.notFound().build();
        return ResponseEntity.ok("Chess game " + gameId + " deleted.");
    }
}
