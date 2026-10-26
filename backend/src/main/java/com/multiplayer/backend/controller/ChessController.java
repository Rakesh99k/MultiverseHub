package com.multiplayer.backend.controller;

import com.multiplayer.backend.model.ChessGameState;
import com.multiplayer.backend.service.ChessService;
import com.multiplayer.backend.util.InputValidator;
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

    @PostMapping("/{gameId}/create")
    public ResponseEntity<String> createGame(@PathVariable String gameId,
                                             @RequestParam String white,
                                             @RequestParam String black) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        String safeWhite = InputValidator.sanitizePlayerName(white);
        String safeBlack = InputValidator.sanitizePlayerName(black);
        if (safeId == null || safeWhite == null || safeBlack == null)
            return ResponseEntity.badRequest().body("Invalid input: game ID and player names required (alphanumeric, 1-20 chars)");
        chessService.createGame(safeId, safeWhite, safeBlack);
        return ResponseEntity.ok("Chess game " + safeId + " created.");
    }

    @GetMapping("/{gameId}")
    public ResponseEntity<ChessGameState> getGame(@PathVariable String gameId) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        if (safeId == null) return ResponseEntity.badRequest().build();
        ChessGameState s = chessService.getGame(safeId);
        if (s == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(s);
    }

    @PostMapping("/{gameId}/move")
    public ResponseEntity<ChessGameState> makeMove(@PathVariable String gameId,
                                                   @RequestParam String playerName,
                                                   @RequestParam String move) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        String safeName = InputValidator.sanitizePlayerName(playerName);
        String safeMove = InputValidator.sanitizeMove(move);
        if (safeId == null || safeName == null || safeMove == null)
            return ResponseEntity.badRequest().build();

        ChessGameState s = chessService.makeMove(safeId, safeName, safeMove);
        if (s == null) return ResponseEntity.notFound().build();

        messagingTemplate.convertAndSend("/topic/chess/" + safeId, s);
        return ResponseEntity.ok(s);
    }

    @PostMapping("/{gameId}/resign")
    public ResponseEntity<ChessGameState> resign(@PathVariable String gameId,
                                                 @RequestParam String playerName) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        String safeName = InputValidator.sanitizePlayerName(playerName);
        if (safeId == null || safeName == null) return ResponseEntity.badRequest().build();
        ChessGameState s = chessService.resign(safeId, safeName);
        if (s == null) return ResponseEntity.notFound().build();
        messagingTemplate.convertAndSend("/topic/chess/" + safeId, s);
        return ResponseEntity.ok(s);
    }

    @PostMapping("/{gameId}/draw")
    public ResponseEntity<ChessGameState> declareDraw(@PathVariable String gameId) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        if (safeId == null) return ResponseEntity.badRequest().build();
        ChessGameState s = chessService.declareDraw(safeId);
        if (s == null) return ResponseEntity.notFound().build();
        messagingTemplate.convertAndSend("/topic/chess/" + safeId, s);
        return ResponseEntity.ok(s);
    }

    @PostMapping("/{gameId}/reset")
    public ResponseEntity<ChessGameState> reset(@PathVariable String gameId) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        if (safeId == null) return ResponseEntity.badRequest().build();
        boolean ok = chessService.resetGame(safeId);
        if (!ok) return ResponseEntity.notFound().build();
        ChessGameState s = chessService.getGame(safeId);
        messagingTemplate.convertAndSend("/topic/chess/" + safeId, s);
        return ResponseEntity.ok(s);
    }

    @DeleteMapping("/{gameId}")
    public ResponseEntity<String> delete(@PathVariable String gameId) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        if (safeId == null) return ResponseEntity.badRequest().build();
        boolean ok = chessService.deleteGame(safeId);
        if (!ok) return ResponseEntity.notFound().build();
        return ResponseEntity.ok("Chess game " + safeId + " deleted.");
    }
}