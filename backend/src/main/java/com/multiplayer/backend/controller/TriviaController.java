package com.multiplayer.backend.controller;

import com.multiplayer.backend.model.TriviaGameState;
import com.multiplayer.backend.service.TriviaService;
import com.multiplayer.backend.util.InputValidator;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/trivia")
public class TriviaController {

    private final TriviaService triviaService;
    private final SimpMessagingTemplate messagingTemplate;

    public TriviaController(TriviaService triviaService, SimpMessagingTemplate messagingTemplate) {
        this.triviaService = triviaService;
        this.messagingTemplate = messagingTemplate;
    }

    @PostMapping("/{gameId}/create")
    public ResponseEntity<TriviaGameState> createGame(
            @PathVariable String gameId,
            @RequestParam(defaultValue = "10") int rounds,
            @RequestParam(defaultValue = "15") int timeLimit) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        if (safeId == null) return ResponseEntity.badRequest().build();
        if (rounds < 1 || rounds > 30) return ResponseEntity.badRequest().build();
        if (timeLimit < 5 || timeLimit > 60) return ResponseEntity.badRequest().build();
        TriviaGameState s = triviaService.createGame(safeId, rounds, timeLimit);
        if (s == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(s);
    }

    @GetMapping("/{gameId}")
    public ResponseEntity<TriviaGameState> getGame(@PathVariable String gameId) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        if (safeId == null) return ResponseEntity.badRequest().build();
        TriviaGameState s = triviaService.getGame(safeId);
        if (s == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(s);
    }

    @PostMapping("/{gameId}/join")
    public ResponseEntity<TriviaGameState> join(@PathVariable String gameId,
                                                @RequestParam String playerName) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        String safeName = InputValidator.sanitizePlayerName(playerName);
        if (safeId == null || safeName == null) return ResponseEntity.badRequest().build();
        TriviaGameState s = triviaService.joinGame(safeId, safeName);
        if (s == null) return ResponseEntity.badRequest().build();
        messagingTemplate.convertAndSend("/topic/trivia/" + safeId, s);
        return ResponseEntity.ok(s);
    }

    @PostMapping("/{gameId}/start")
    public ResponseEntity<TriviaGameState> start(@PathVariable String gameId) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        if (safeId == null) return ResponseEntity.badRequest().build();
        TriviaGameState s = triviaService.startGame(safeId);
        if (s == null) return ResponseEntity.badRequest().build();
        messagingTemplate.convertAndSend("/topic/trivia/" + safeId, s);
        return ResponseEntity.ok(s);
    }

    @PostMapping("/{gameId}/answer")
    public ResponseEntity<TriviaGameState> answer(@PathVariable String gameId,
                                                  @RequestParam String playerName,
                                                  @RequestParam int option) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        String safeName = InputValidator.sanitizePlayerName(playerName);
        if (safeId == null || safeName == null) return ResponseEntity.badRequest().build();
        if (!InputValidator.isValidOptionIndex(option)) return ResponseEntity.badRequest().build();
        TriviaGameState s = triviaService.submitAnswer(safeId, safeName, option);
        if (s == null) return ResponseEntity.notFound().build();
        messagingTemplate.convertAndSend("/topic/trivia/" + safeId, s);
        return ResponseEntity.ok(s);
    }

    @PostMapping("/{gameId}/reset")
    public ResponseEntity<TriviaGameState> reset(@PathVariable String gameId) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        if (safeId == null) return ResponseEntity.badRequest().build();
        boolean ok = triviaService.resetGame(safeId);
        if (!ok) return ResponseEntity.notFound().build();
        TriviaGameState s = triviaService.getGame(safeId);
        messagingTemplate.convertAndSend("/topic/trivia/" + safeId, s);
        return ResponseEntity.ok(s);
    }

    @DeleteMapping("/{gameId}")
    public ResponseEntity<String> delete(@PathVariable String gameId) {
        String safeId = InputValidator.sanitizeGameId(gameId);
        if (safeId == null) return ResponseEntity.badRequest().build();
        boolean ok = triviaService.deleteGame(safeId);
        if (!ok) return ResponseEntity.notFound().build();
        return ResponseEntity.ok("Trivia game " + safeId + " deleted.");
    }
}