const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
async function parseError(response) {
  try {
    const data = await response.json();
    return data?.error || JSON.stringify(data);
  } catch {
    return `HTTP ${response.status}`;
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const lobbyApi = {
  createLobby: (name) => request(`/api/lobbies?name=${encodeURIComponent(name)}`, { method: "POST" }),
  getLobbies: (availableOnly = false) =>
    request(`/api/lobbies${availableOnly ? "?available=true" : ""}`),
  getLobby: (id) => request(`/api/lobbies/${encodeURIComponent(id)}`),
  joinLobby: (id, playerName) =>
    request(
      `/api/lobbies/${encodeURIComponent(id)}/join?playerName=${encodeURIComponent(playerName)}`,
      { method: "POST" }
    ),
  leaveLobby: (id, playerName) =>
    request(
      `/api/lobbies/${encodeURIComponent(id)}/leave?playerName=${encodeURIComponent(playerName)}`,
      { method: "POST" }
    ),
  startGame: (id, gameType) =>
    request(`/api/lobbies/${encodeURIComponent(id)}/start?game=${encodeURIComponent(gameType)}`, {
      method: "POST",
    }),
};

export const ticTacToeApi = {
  getGame: (gameId) => request(`/api/tictactoe/${encodeURIComponent(gameId)}`),
  play: (gameId, row, col, playerName) =>
    request(
      `/api/tictactoe/${encodeURIComponent(gameId)}/play?row=${row}&col=${col}&playerName=${encodeURIComponent(playerName)}`,
      {
        method: "POST",
      }
    ),
  reset: (gameId) => request(`/api/tictactoe/${encodeURIComponent(gameId)}/reset`, { method: "POST" }),
};

export const chessApi = {
  getGame: (gameId) => request(`/api/chess/${encodeURIComponent(gameId)}`),
  move: (gameId, playerName, move) =>
    request(
      `/api/chess/${encodeURIComponent(gameId)}/move?playerName=${encodeURIComponent(playerName)}&move=${encodeURIComponent(move)}`,
      {
        method: "POST",
      }
    ),
  resign: (gameId, playerName) =>
    request(
      `/api/chess/${encodeURIComponent(gameId)}/resign?playerName=${encodeURIComponent(playerName)}`,
      {
        method: "POST",
      }
    ),
  draw: (gameId) => request(`/api/chess/${encodeURIComponent(gameId)}/draw`, { method: "POST" }),
  reset: (gameId) => request(`/api/chess/${encodeURIComponent(gameId)}/reset`, { method: "POST" }),
};

export const sudokuApi = {
  getGame: (gameId) => request(`/api/sudoku/${encodeURIComponent(gameId)}`),
  join: (gameId, playerName) =>
    request(`/api/sudoku/${encodeURIComponent(gameId)}/join?playerName=${encodeURIComponent(playerName)}`, {
      method: "POST",
    }),
  move: (gameId, playerName, row, col, value) =>
    request(
      `/api/sudoku/${encodeURIComponent(gameId)}/move?playerName=${encodeURIComponent(playerName)}&row=${row}&col=${col}&value=${value}`,
      {
        method: "POST",
      }
    ),
  hint: (gameId, row, col) => request(`/api/sudoku/${encodeURIComponent(gameId)}/hint?row=${row}&col=${col}`),
  validate: (gameId) => request(`/api/sudoku/${encodeURIComponent(gameId)}/validate`),
  reset: (gameId) => request(`/api/sudoku/${encodeURIComponent(gameId)}/reset`, { method: "POST" }),
};

export { API_BASE_URL };
