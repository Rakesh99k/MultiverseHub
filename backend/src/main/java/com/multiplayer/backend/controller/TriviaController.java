package com.multiplayer.backend.controller;

import com.multiplayer.backend.model.TriviaGameState;
import com.multiplayer.backend.service.TriviaService;
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
        TriviaGameState s = triviaService.createGame(gameId, rounds, timeLimit);
        if (s == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(s);
    }

    @GetMapping("/{gameId}")
    public ResponseEntity<TriviaGameState> getGame(@PathVariable String gameId) {
        TriviaGameState s = triviaService.getGame(gameId);
        if (s == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(s);
    }

    @PostMapping("/{gameId}/join")
    public ResponseEntity<TriviaGameState> join(@PathVariable String gameId,
                                                @RequestParam String playerName) {
        TriviaGameState s = triviaService.joinGame(gameId, playerName);
        if (s == null) return ResponseEntity.badRequest().build();
        messagingTemplate.convertAndSend("/topic/trivia/" + gameId, s);
        return ResponseEntity.ok(s);
    }

    @PostMapping("/{gameId}/start")
    public ResponseEntity<TriviaGameState> start(@PathVariable String gameId) {
        TriviaGameState s = triviaService.startGame(gameId);
        if (s == null) return ResponseEntity.badRequest().build();
        messagingTemplate.convertAndSend("/topic/trivia/" + gameId, s);
        return ResponseEntity.ok(s);
    }

    @PostMapping("/{gameId}/answer")
    public ResponseEntity<TriviaGameState> answer(@PathVariable String gameId,
                                                  @RequestParam String playerName,
                                                  @RequestParam int option) {
        TriviaGameState s = triviaService.submitAnswer(gameId, playerName, option);
        if (s == null) return ResponseEntity.notFound().build();
        messagingTemplate.convertAndSend("/topic/trivia/" + gameId, s);
        return ResponseEntity.ok(s);
    }

    @PostMapping("/{gameId}/reset")
    public ResponseEntity<TriviaGameState> reset(@PathVariable String gameId) {
        boolean ok = triviaService.resetGame(gameId);
        if (!ok) return ResponseEntity.notFound().build();
        TriviaGameState s = triviaService.getGame(gameId);
        messagingTemplate.convertAndSend("/topic/trivia/" + gameId, s);
        return ResponseEntity.ok(s);
    }

    @DeleteMapping("/{gameId}")
    public ResponseEntity<String> delete(@PathVariable String gameId) {
        boolean ok = triviaService.deleteGame(gameId);
        if (!ok) return ResponseEntity.notFound().build();
        return ResponseEntity.ok("Trivia game " + gameId + " deleted.");
    }
}