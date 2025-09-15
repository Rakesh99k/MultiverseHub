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

    // ✅ Inject TicTacToeService bean only
    public GameController(@Qualifier("ticTacToeService") GameService ticTacToeService,
                          SimpMessagingTemplate messagingTemplate) {
        this.ticTacToeService = ticTacToeService;
        this.messagingTemplate = messagingTemplate;
    }

    // ✅ Create a new TicTacToe game
    @PostMapping("/tictactoe/{gameId}/create")
    public ResponseEntity<String> createTicTacToeGame(@PathVariable String gameId) {
        ticTacToeService.createGame(gameId);
        return ResponseEntity.ok("TicTacToe game " + gameId + " created.");
    }

    // ✅ Get current state of a TicTacToe game
    @GetMapping("/tictactoe/{gameId}")
    public ResponseEntity<GameState> getTicTacToeGame(@PathVariable String gameId) {
        GameState state = ticTacToeService.getGame(gameId);
        if (state != null) {
            return ResponseEntity.ok(state);
        }
        return ResponseEntity.notFound().build();
    }

    // ✅ Make a move in TicTacToe
    @PostMapping("/tictactoe/{gameId}/move")
    public ResponseEntity<GameState> makeTicTacToeMove(
            @PathVariable String gameId,
            @RequestParam int row,
            @RequestParam int col,
            @RequestParam String symbol
    ) {
        GameState state = ticTacToeService.makeMove(gameId, row, col, symbol);
        if (state == null) {
            return ResponseEntity.badRequest().build();
        }

        // 🔔 Broadcast updated game state
        messagingTemplate.convertAndSend("/topic/tictactoe/" + gameId, state);

        return ResponseEntity.ok(state);
    }
}
