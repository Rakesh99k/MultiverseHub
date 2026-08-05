package com.multiplayer.backend.service;

import com.github.bhlangonijr.chesslib.Board;
import com.github.bhlangonijr.chesslib.Piece;
import com.github.bhlangonijr.chesslib.Side;
import com.github.bhlangonijr.chesslib.Square;
import com.github.bhlangonijr.chesslib.move.Move;
import com.multiplayer.backend.model.ChessGameState;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class ChessService {

    // ─── Internal game wrapper ────────────────────────────────────────────────

    private static class ChessGame {
        final Board  board;
        final String playerWhite;
        final String playerBlack;
        final List<String> moveHistorySan = new ArrayList<>();

        // Set when game ends via resign or mutual draw
        String overrideStatus = null;  // "RESIGNED" | "DRAW"
        String overrideWinner = null;  // "white" | "black" | "DRAW"

        ChessGame(String white, String black) {
            this.board       = new Board();
            this.playerWhite = white;
            this.playerBlack = black;
        }
    }

    private final ConcurrentMap<String, ChessGame> games = new ConcurrentHashMap<>();

    // Lazy to avoid circular dependency
    private final LobbyService lobbyService;

    public ChessService(@Lazy LobbyService lobbyService) {
        this.lobbyService = lobbyService;
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Create a new chess game with assigned white and black players.
     */
    public void createGame(String gameId, String whitePlayer, String blackPlayer) {
        games.putIfAbsent(gameId, new ChessGame(whitePlayer, blackPlayer));
    }

    /**
     * Get the current game state.
     * Returns null if game not found.
     */
    public ChessGameState getGame(String gameId) {
        ChessGame game = games.get(gameId);
        if (game == null) return null;
        return toState(gameId, game);
    }

    /**
     * Submit a move for a player.
     * Accepts UCI (e.g. "e2e4") or SAN (e.g. "e4", "Nf3", "O-O").
     * Returns null if game not found.
     * Returns unchanged state if move is illegal or wrong turn.
     */
    public ChessGameState makeMove(String gameId, String playerName, String moveStr) {
        ChessGame game = games.get(gameId);
        if (game == null) return null;

        Board board = game.board;

        // Game already ended
        if (game.overrideStatus != null)  return toState(gameId, game);
        if (isNaturallyOver(board))       return toState(gameId, game);

        // Verify it is this player's turn
        Side   sideToMove     = board.getSideToMove();
        String expectedPlayer = sideToMove == Side.WHITE
                ? game.playerWhite
                : game.playerBlack;

        if (!playerName.equals(expectedPlayer)) return toState(gameId, game);

        // Get legal moves as List<Move>
        List<Move> legalMoves = board.legalMoves();

        // Parse the submitted move
        Move move = parseMove(board, moveStr, legalMoves);
        if (move == null) return toState(gameId, game);

        // Generate SAN before executing (needs pre-move board state)
        String san = generateSan(board, move, legalMoves);
        game.moveHistorySan.add(san);

        // Execute the move
        board.doMove(move);

        // Check if game just ended naturally
        if (isNaturallyOver(board)) {
            lobbyService.onGameFinished(gameId);
        }

        return toState(gameId, game);
    }

    /**
     * The given player resigns. Opponent wins.
     * Returns null if game not found.
     */
    public ChessGameState resign(String gameId, String playerName) {
        ChessGame game = games.get(gameId);
        if (game == null) return null;

        if (game.overrideStatus == null && !isNaturallyOver(game.board)) {
            if (playerName.equals(game.playerWhite)) {
                game.overrideStatus = "RESIGNED";
                game.overrideWinner = "black";
                lobbyService.onGameFinished(gameId);
            } else if (playerName.equals(game.playerBlack)) {
                game.overrideStatus = "RESIGNED";
                game.overrideWinner = "white";
                lobbyService.onGameFinished(gameId);
            }
        }

        return toState(gameId, game);
    }

    /**
     * Declare a draw by mutual agreement.
     * Returns null if game not found.
     */
    public ChessGameState declareDraw(String gameId) {
        ChessGame game = games.get(gameId);
        if (game == null) return null;

        if (game.overrideStatus == null && !isNaturallyOver(game.board)) {
            game.overrideStatus = "DRAW";
            game.overrideWinner = "DRAW";
            lobbyService.onGameFinished(gameId);
        }

        return toState(gameId, game);
    }

    /**
     * Reset the game for a rematch.
     * Keeps same players, fresh board.
     */
    public boolean resetGame(String gameId) {
        ChessGame game = games.get(gameId);
        if (game == null) return false;
        games.put(gameId, new ChessGame(game.playerWhite, game.playerBlack));
        return true;
    }

    /**
     * Delete a game entirely.
     */
    public boolean deleteGame(String gameId) {
        return games.remove(gameId) != null;
    }

    // ─── State Projection ─────────────────────────────────────────────────────

    private ChessGameState toState(String gameId, ChessGame game) {
        Board board = game.board;

        ChessGameState state = new ChessGameState();
        state.setPlayerWhite(game.playerWhite);
        state.setPlayerBlack(game.playerBlack);
        state.setFen(board.getFen());
        state.setMoveHistory(new ArrayList<>(game.moveHistorySan));
        state.setMoveCount(game.moveHistorySan.size());
        state.setCurrentTurn(
                board.getSideToMove() == Side.WHITE ? "white" : "black"
        );

        // ── Override endings (resign / agreed draw) ───────────────────────────
        if (game.overrideStatus != null) {
            state.setStatus(game.overrideStatus);
            state.setWinner(game.overrideWinner);
            state.setLegalMoves(new ArrayList<>());
            return state;
        }

        // ── Natural endings ───────────────────────────────────────────────────
        if (board.isMated()) {
            String winner = board.getSideToMove() == Side.WHITE ? "black" : "white";
            state.setStatus("CHECKMATE");
            state.setWinner(winner);
            state.setLegalMoves(new ArrayList<>());
            return state;
        }

        if (board.isStaleMate()) {
            state.setStatus("STALEMATE");
            state.setWinner("DRAW");
            state.setLegalMoves(new ArrayList<>());
            return state;
        }

        if (board.isDraw()) {
            state.setStatus("DRAW");
            state.setWinner("DRAW");
            state.setLegalMoves(new ArrayList<>());
            return state;
        }

        // ── Active game ───────────────────────────────────────────────────────
        if (board.isKingAttacked()) {
            state.setStatus("CHECK");
        } else {
            state.setStatus("PLAYING");
        }

        // Legal moves in SAN for current player
        List<Move> legal = board.legalMoves();
        List<String> legalSan = new ArrayList<>();
        for (Move m : legal) {
            legalSan.add(generateSan(board, m, legal));
        }
        state.setLegalMoves(legalSan);

        return state;
    }

    // ─── Move Parsing ─────────────────────────────────────────────────────────

    /**
     * Parse a move string into a Move object.
     * Tries UCI first, then SAN matching.
     * Returns null if move is illegal or unrecognized.
     */
    private Move parseMove(Board board, String moveStr, List<Move> legalMoves) {
        if (moveStr == null || moveStr.isBlank()) return null;

        String trimmed = moveStr.trim();

        // ── Try UCI (e.g. "e2e4", "e7e8q") ──────────────────────────────────
        try {
            Move uciMove = new Move(trimmed, board.getSideToMove());
            if (legalMoves.contains(uciMove)) {
                return uciMove;
            }
        } catch (Exception ignored) {}

        // ── Try SAN matching ──────────────────────────────────────────────────
        for (Move legal : legalMoves) {
            try {
                String san = generateSan(board, legal, legalMoves);
                if (san.equals(trimmed)) {
                    return legal;
                }
            } catch (Exception ignored) {}
        }

        return null;
    }

    // ─── SAN Generation ──────────────────────────────────────────────────────

    /**
     * Generate Standard Algebraic Notation for a move.
     *
     * Handles:
     *  - Castling          (O-O, O-O-O)
     *  - Pawn moves        (e4, exd5, e8=Q)
     *  - Piece moves       (Nf3, Bxe5)
     *  - Disambiguation    (Nbd2, R1e1, Qd1f3)
     *  - En passant        (exd6)
     *  - Check suffix      (+)
     *  - Checkmate suffix  (#)
     */
    private String generateSan(Board board, Move move, List<Move> legalMoves) {
        Square from  = move.getFrom();
        Square to    = move.getTo();
        Piece  piece = board.getPiece(from);

        // Safety fallback — should not happen with valid legal moves
        if (piece == null || piece == Piece.NONE) {
            return move.toString();
        }

        String pieceTypeName = piece.getPieceType().name();

        // ── Castling ──────────────────────────────────────────────────────────
        if ("KING".equals(pieceTypeName)) {
            int fileDiff = to.getFile().ordinal() - from.getFile().ordinal();
            if (fileDiff == 2)  return addCheckSuffix(board, move, "O-O");
            if (fileDiff == -2) return addCheckSuffix(board, move, "O-O-O");
        }

        StringBuilder san    = new StringBuilder();
        boolean       isPawn = "PAWN".equals(pieceTypeName);

        // ── Piece letter (not for pawns) ──────────────────────────────────────
        if (!isPawn) {
            san.append(pieceLetterFor(pieceTypeName));
        }

        // ── Disambiguation (not for pawns) ────────────────────────────────────
        if (!isPawn) {
            List<Move> sameDestination = new ArrayList<>();
            for (Move m : legalMoves) {
                if (!m.getFrom().equals(from)
                        && m.getTo().equals(to)
                        && board.getPiece(m.getFrom()) == piece) {
                    sameDestination.add(m);
                }
            }

            if (!sameDestination.isEmpty()) {
                boolean sharedFile = sameDestination.stream()
                        .anyMatch(m -> m.getFrom().getFile() == from.getFile());
                boolean sharedRank = sameDestination.stream()
                        .anyMatch(m -> m.getFrom().getRank() == from.getRank());

                if (!sharedFile) {
                    // Different files — use file letter
                    san.append(from.getFile().getNotation().toLowerCase());
                } else if (!sharedRank) {
                    // Same file, different rank — use rank number
                    san.append(from.getRank().getNotation());
                } else {
                    // Same file AND rank possible — use both
                    san.append(from.getFile().getNotation().toLowerCase());
                    san.append(from.getRank().getNotation());
                }
            }
        }

        // ── Capture detection ─────────────────────────────────────────────────
        boolean targetOccupied = board.getPiece(to) != Piece.NONE;

        // En passant: pawn moves diagonally but target square is empty
        boolean isEnPassant = isPawn
                && !from.getFile().equals(to.getFile())
                && !targetOccupied;

        boolean isCapture = targetOccupied || isEnPassant;

        if (isCapture) {
            if (isPawn) {
                // Pawn captures must include source file (e.g. "exd5")
                san.append(from.getFile().getNotation().toLowerCase());
            }
            san.append("x");
        }

        // ── Destination square ────────────────────────────────────────────────
        san.append(to.toString().toLowerCase());

        // ── Promotion ─────────────────────────────────────────────────────────
        Piece promotion = move.getPromotion();
        if (promotion != null && promotion != Piece.NONE) {
            san.append("=");
            san.append(pieceLetterFor(promotion.getPieceType().name()));
        }

        // ── Check / Checkmate suffix ──────────────────────────────────────────
        return addCheckSuffix(board, move, san.toString());
    }

    /**
     * Clone the board, execute the move, and append
     * "#" for checkmate or "+" for check.
     */
    private String addCheckSuffix(Board board, Move move, String san) {
        try {
            Board testBoard = board.clone();
            testBoard.doMove(move);
            if (testBoard.isMated()) {
                return san + "#";
            }
            if (testBoard.isKingAttacked()) {
                return san + "+";
            }
        } catch (Exception ignored) {}
        return san;
    }

    /**
     * Map piece type name → SAN letter.
     * Pawns return empty string (no letter in SAN).
     */
    private String pieceLetterFor(String pieceTypeName) {
        return switch (pieceTypeName) {
            case "KING"   -> "K";
            case "QUEEN"  -> "Q";
            case "ROOK"   -> "R";
            case "BISHOP" -> "B";
            case "KNIGHT" -> "N";
            default       -> ""; // PAWN
        };
    }

    // ─── Utility ──────────────────────────────────────────────────────────────

    /**
     * True if board is in a terminal state
     * (checkmate, stalemate, or draw by rule).
     */
    private boolean isNaturallyOver(Board board) {
        return board.isMated() || board.isStaleMate() || board.isDraw();
    }
}