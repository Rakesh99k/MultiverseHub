# MultiverseHub Backend API Documentation

> **Base URL:** `http://localhost:8080`  
> **WebSocket endpoint:** `/ws` (STOMP over SockJS)

---

## 🏠 Lobby Endpoints

| Method | Endpoint | Params | Description |
|--------|----------|--------|-------------|
| POST | `/api/lobbies` | `?name={name}` | Create a new lobby |
| GET | `/api/lobbies` | `?available=true` (optional) | List all lobbies, or only available (WAITING + not full) |
| GET | `/api/lobbies/{id}` | | Get specific lobby (404 if not found) |
| POST | `/api/lobbies/{id}/join` | `?playerName={name}` | Join a lobby (400 if full/in-game/invalid) |
| POST | `/api/lobbies/{id}/leave` | `?playerName={name}` | Leave a lobby |
| POST | `/api/lobbies/{id}/start` | `?game=tictactoe` (default), `?game=chess`, or `?game=sudoku` | Start a game (chess/tictactoe need ≥2 players, sudoku ≥1). Returns lobby with `gameId` and `status=IN_GAME` |
| DELETE | `/api/lobbies/{id}` | | Delete a lobby |

**Lobby JSON example:**
```json
{
  "id": "uuid-here",
  "name": "Arena",
  "players": ["Alice", "Bob"],
  "status": "WAITING",
  "gameId": null
}
```
Status values: `WAITING`, `IN_GAME`, `FINISHED`

---

## ❌⭕ TicTacToe Endpoints

| Method | Endpoint | Params | Description |
|--------|----------|--------|-------------|
| POST | `/api/tictactoe/{gameId}/create` | | Create a standalone game |
| GET | `/api/tictactoe/{gameId}` | | Get game state |
| POST | `/api/tictactoe/{gameId}/move` | `?row={0-2}&col={0-2}&symbol={X\|O}` | Move by symbol (legacy) |
| POST | `/api/tictactoe/{gameId}/play` | `?row={0-2}&col={0-2}&playerName={name}` | **Recommended:** Move by player name (server resolves X/O) |
| POST | `/api/tictactoe/{gameId}/reset` | | Reset board for rematch (keeps players) |
| DELETE | `/api/tictactoe/{gameId}` | | Delete game |

**Game State JSON:**
```json
{
  "board": [["X","-","-"],["-","O","-"],["-","-","-"]],
  "currentPlayer": "X",
  "winner": null,
  "playerX": "Alice",
  "playerO": "Bob"
}
```
Winner values: `"X"`, `"O"`, `"DRAW"`, or `null`

---

## ♟️ Chess Endpoints (Full Implementation)

The chess backend provides **complete move validation**, check/checkmate/stalemate detection, legal move generation, FEN tracking, and move history.

| Method | Endpoint | Params | Description |
|--------|----------|--------|-------------|
| POST | `/api/chess/{gameId}/create` | `?white={name}&black={name}` | Create chess game with assigned players |
| GET | `/api/chess/{gameId}` | | Get full game state (FEN, legal moves, status, history) |
| POST | `/api/chess/{gameId}/move` | `?playerName={name}&move={move}` | Submit a move (UCI format e.g. `e2e4`, `g1f3`, `e1g1` for castling) |
| POST | `/api/chess/{gameId}/resign` | `?playerName={name}` | Player resigns (opponent wins) |
| POST | `/api/chess/{gameId}/draw` | | Declare draw (mutual agreement) |
| POST | `/api/chess/{gameId}/reset` | | Reset for rematch (same players, fresh board) |
| DELETE | `/api/chess/{gameId}` | | Delete the game |

### Chess Game State JSON:
```json
{
  "playerWhite": "Alice",
  "playerBlack": "Bob",
  "currentTurn": "white",
  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
  "moveHistory": ["e4"],
  "winner": null,
  "status": "PLAYING",
  "legalMoves": ["a6","a5","b6","b5",...],
  "moveCount": 1
}
```

### Status values:
| Status | Meaning |
|--------|---------|
| `PLAYING` | Normal play |
| `CHECK` | Current player's king is in check |
| `CHECKMATE` | Game over — `winner` is set |
| `STALEMATE` | Draw — no legal moves but not in check |
| `DRAW` | Draw by agreement, repetition, or insufficient material |
| `RESIGNED` | A player resigned — `winner` is the opponent |

### Move format:
- Move submission accepts both SAN and UCI formats
  - SAN examples: `e4`, `Nf3`, `O-O`
  - UCI examples: `e2e4`, `g1f3`, `e1g1`, `e7e8q`
- `moveHistory` and `legalMoves` are returned in SAN notation

### Example: Scholar's Mate
```
POST /api/chess/game1/create?white=Alice&black=Bob
POST /api/chess/game1/move?playerName=Alice&move=e2e4
POST /api/chess/game1/move?playerName=Bob&move=e7e5
POST /api/chess/game1/move?playerName=Alice&move=d1h5
POST /api/chess/game1/move?playerName=Bob&move=b8c6
POST /api/chess/game1/move?playerName=Alice&move=f1c4
POST /api/chess/game1/move?playerName=Bob&move=g8f6
POST /api/chess/game1/move?playerName=Alice&move=h5f7  → status: "CHECKMATE", winner: "white"
```

---

## 🔢 Sudoku Endpoints

Multiplayer Sudoku with **puzzle generation**, **collaborative or competitive modes**, hints, and validation.

| Method | Endpoint | Params | Description |
|--------|----------|--------|-------------|
| POST | `/api/sudoku/{gameId}/create` | `?difficulty=easy\|medium\|hard&mode=collaborative\|competitive` | Create game (generates new puzzle) |
| GET | `/api/sudoku/{gameId}` | | Get full game state |
| POST | `/api/sudoku/{gameId}/join` | `?playerName={name}` | Join the game |
| POST | `/api/sudoku/{gameId}/move` | `?playerName={name}&row={0-8}&col={0-8}&value={0-9}` | Place value (0 = erase). Cannot overwrite clues. |
| GET | `/api/sudoku/{gameId}/hint` | `?row={0-8}&col={0-8}` | Reveal correct value for one cell |
| GET | `/api/sudoku/{gameId}/validate` | | Returns list of wrong cells as `"row,col"` |
| POST | `/api/sudoku/{gameId}/reset` | | Reset board to initial puzzle, clear history & mistakes |
| DELETE | `/api/sudoku/{gameId}` | | Delete the game |

### Sudoku Game State JSON:
```json
{
  "board": [[8,5,0,...],...],         // current state, 0 = empty
  "initialBoard": [[8,5,0,...],...],  // original puzzle (used for reset)
  "solution": [[8,5,4,...],...],      // full solution (for client validation)
  "fixed": [[true,true,false,...],...], // true = clue cell, immutable
  "players": ["Alice","Bob"],
  "difficulty": "easy",
  "mode": "collaborative",
  "winner": null,                      // player name (competitive), "ALL" (collaborative), or null
  "status": "PLAYING",                 // "PLAYING" or "COMPLETED"
  "moveHistory": [
    {"playerName":"Alice","row":0,"col":0,"value":8,"correct":true}
  ],
  "mistakes": 0
}
```

### Modes:
- **collaborative** — all players work on the same board; winner is `"ALL"` when solved
- **competitive** — race to make the move that completes the board; winner is the player who placed the last correct value

### Difficulty (clue count):
- `easy` — 40 clues
- `medium` — 32 clues
- `hard` — 26 clues

### Example flow:
```
POST /api/sudoku/sud1/create?difficulty=easy&mode=collaborative
POST /api/sudoku/sud1/join?playerName=Alice
POST /api/sudoku/sud1/join?playerName=Bob
POST /api/sudoku/sud1/move?playerName=Alice&row=0&col=0&value=8     → correct, mistakes=0
POST /api/sudoku/sud1/move?playerName=Bob&row=0&col=1&value=6       → wrong, mistakes=1
POST /api/sudoku/sud1/move?playerName=Bob&row=0&col=1&value=0       → erase
GET  /api/sudoku/sud1/hint?row=0&col=1                              → {"value":5,...}
GET  /api/sudoku/sud1/validate                                       → {"wrongCells":[],"count":0}
POST /api/sudoku/sud1/reset                                          → fresh start
```

When Sudoku is started through the lobby endpoint (`POST /api/lobbies/{id}/start?game=sudoku`), backend currently initializes with `difficulty=medium` and `mode=collaborative`.

### WebSocket topic:
- Subscribe to `/topic/sudoku/{gameId}` for real-time updates on every move/join/reset

---

## 🔌 WebSocket (STOMP) Topics

Connect to: `http://localhost:8080/ws` (SockJS)

| Subscribe to | Receives |
|---|---|
| `/topic/lobbies` | Lobby create/join updates |
| `/topic/tictactoe/{gameId}` | TicTacToe game state on every move |
| `/topic/chess/{gameId}` | Chess game state on every move/resign/draw |
| `/topic/sudoku/{gameId}` | Sudoku game state on every move/join/reset |
| `/topic/lobby/{lobbyId}/chat` | Chat messages within a lobby |
| `/topic/lobby/{lobbyId}/game` | Game move messages within a lobby |

### Send messages to:
| Destination | Payload | Broadcasts to |
|---|---|---|
| `/app/lobby/create` | `"lobbyName"` | `/topic/lobbies` |
| `/app/lobby/join` | `"lobbyId:playerName"` | `/topic/lobbies` |
| `/app/lobby/{lobbyId}/chat` | `"message text"` | `/topic/lobby/{lobbyId}/chat` |
| `/app/lobby/{lobbyId}/move` | `"move data"` | `/topic/lobby/{lobbyId}/game` |
| `/app/hello` | `"message"` | `/topic/greetings` |

---

## ⚠️ Error Responses

All errors return clean JSON:

```json
{ "error": "Missing required parameter", "parameter": "name" }
{ "error": "Not Found", "path": "api/lobbies/fakeid" }
{ "error": "Invalid number format: For input string: \"abc\"" }
```

- `400 Bad Request` — invalid input, full lobby, wrong turn, illegal move
- `404 Not Found` — resource doesn't exist
- `500 Internal Server Error` — unexpected errors

---

## 🎮 Typical Game Flow (Frontend)

### TicTacToe:
1. `POST /api/lobbies?name=MyRoom` → get lobby `id`
2. Player 2 calls `POST /api/lobbies/{id}/join?playerName=Bob`
3. `POST /api/lobbies/{id}/start` → get `gameId`
4. Subscribe to `/topic/tictactoe/{gameId}` via WebSocket
5. Players call `POST /api/tictactoe/{gameId}/play?row=0&col=0&playerName=Alice`
6. State updates broadcast to all subscribers

### Chess:
1. `POST /api/chess/{gameId}/create?white=Alice&black=Bob`
2. Subscribe to `/topic/chess/{gameId}` via WebSocket
3. Players call `POST /api/chess/{gameId}/move?playerName=Alice&move=e2e4`
4. Response includes `legalMoves` for the next player — display these on the board
5. Game ends when `status` is `CHECKMATE`, `STALEMATE`, `DRAW`, or `RESIGNED`
