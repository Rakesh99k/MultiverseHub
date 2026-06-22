/* eslint-disable no-console */
const { Client } = require("@stomp/stompjs");
const SockJS = require("sockjs-client/dist/sockjs");

const API_BASE = "http://localhost:8080";
const WS_URL = "http://localhost:8080/ws";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    cache: "no-store",
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorText = payload?.error || `${response.status} ${response.statusText}`;
    throw new Error(`Request failed ${path}: ${errorText}`);
  }

  return payload;
}

function createProbe(name) {
  const messages = new Map();

  const client = new Client({
    webSocketFactory: () => new SockJS(WS_URL),
    reconnectDelay: 0,
    debug: () => {},
  });

  client.onStompError = (frame) => {
    throw new Error(`${name} STOMP error: ${frame.headers?.message || "unknown"}`);
  };

  client.onWebSocketError = () => {
    throw new Error(`${name} websocket error`);
  };

  const connected = new Promise((resolve) => {
    client.onConnect = () => resolve();
  });

  client.activate();

  return {
    name,
    client,
    async waitConnected() {
      await connected;
    },
    subscribe(topic) {
      if (!messages.has(topic)) {
        messages.set(topic, []);
      }
      client.subscribe(topic, (message) => {
        messages.get(topic).push(message.body);
      });
    },
    publish(destination, body) {
      client.publish({ destination, body });
    },
    count(topic) {
      return (messages.get(topic) || []).length;
    },
    values(topic) {
      return messages.get(topic) || [];
    },
    async waitFor(topic, predicate, timeoutMs = 7000) {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        const topicMessages = messages.get(topic) || [];
        for (const msg of topicMessages) {
          if (predicate(msg)) {
            return msg;
          }
        }
        await sleep(120);
      }

      throw new Error(`${name} timed out waiting for message on ${topic}`);
    },
    async close() {
      client.deactivate();
      await sleep(150);
    },
  };
}

async function setupTwoProbes() {
  const tabA = createProbe("TabA");
  const tabB = createProbe("TabB");
  await Promise.all([tabA.waitConnected(), tabB.waitConnected()]);
  return { tabA, tabB };
}

async function testLobbyChat() {
  console.log("\n[1/4] Testing lobby chat realtime sync...");

  const lobbyName = randomId("SmokeLobby");
  const lobby = await requestJson(`/api/lobbies?name=${encodeURIComponent(lobbyName)}`, {
    method: "POST",
  });

  await requestJson(`/api/lobbies/${lobby.id}/join?playerName=Alice`, { method: "POST" });
  await requestJson(`/api/lobbies/${lobby.id}/join?playerName=Bob`, { method: "POST" });

  const { tabA, tabB } = await setupTwoProbes();
  const topic = `/topic/lobby/${lobby.id}/chat`;
  const payload = `Alice: smoke-chat-${Date.now()}`;

  try {
    tabA.subscribe(topic);
    tabB.subscribe(topic);
    await sleep(200);

    tabA.publish(`/app/lobby/${lobby.id}/chat`, payload);

    await Promise.all([
      tabA.waitFor(topic, (m) => m.includes(payload)),
      tabB.waitFor(topic, (m) => m.includes(payload)),
    ]);

    console.log(`PASS lobby chat: both tabs received payload on ${topic}`);
  } finally {
    await Promise.all([tabA.close(), tabB.close()]);
  }

  return lobby.id;
}

async function testTicTacToeFromLobby(lobbyId) {
  console.log("\n[2/4] Testing TicTacToe realtime sync...");

  const started = await requestJson(`/api/lobbies/${lobbyId}/start?game=tictactoe`, {
    method: "POST",
  });
  const gameId = started.gameId;

  const { tabA, tabB } = await setupTwoProbes();
  const topic = `/topic/tictactoe/${gameId}`;

  try {
    tabA.subscribe(topic);
    tabB.subscribe(topic);
    await sleep(600);

    await requestJson(`/api/tictactoe/${gameId}/play?row=0&col=0&playerName=Alice`, { method: "POST" });
    await requestJson(`/api/tictactoe/${gameId}/play?row=1&col=1&playerName=Bob`, { method: "POST" });

    const isFinalBoard = (raw) => {
      try {
        const parsed = JSON.parse(raw);
        return parsed?.board?.[0]?.[0] === "X" && parsed?.board?.[1]?.[1] === "O";
      } catch {
        return false;
      }
    };

    await Promise.all([tabA.waitFor(topic, isFinalBoard), tabB.waitFor(topic, isFinalBoard)]);

    console.log(`PASS tictactoe: both tabs received synchronized final board on ${topic}`);
  } finally {
    await Promise.all([tabA.close(), tabB.close()]);
  }
}

async function testChessRealtime() {
  console.log("\n[3/4] Testing Chess realtime sync...");

  const gameId = randomId("chess-smoke");
  await requestJson(`/api/chess/${gameId}/create?white=Alice&black=Bob`, { method: "POST" });

  const { tabA, tabB } = await setupTwoProbes();
  const topic = `/topic/chess/${gameId}`;

  try {
    tabA.subscribe(topic);
    tabB.subscribe(topic);
    await sleep(600);

    await requestJson(`/api/chess/${gameId}/move?playerName=Alice&move=e2e4`, { method: "POST" });
    await requestJson(`/api/chess/${gameId}/move?playerName=Bob&move=e7e5`, { method: "POST" });

    const hasTwoMoves = (raw) => {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.moveHistory) && parsed.moveHistory.length >= 2;
      } catch {
        return false;
      }
    };

    await Promise.all([tabA.waitFor(topic, hasTwoMoves), tabB.waitFor(topic, hasTwoMoves)]);

    console.log(`PASS chess: both tabs received synchronized moveHistory updates on ${topic}`);
  } finally {
    await Promise.all([tabA.close(), tabB.close()]);
  }
}

async function testSudokuRealtime() {
  console.log("\n[4/4] Testing Sudoku realtime sync...");

  const gameId = randomId("sudoku-smoke");
  await requestJson(`/api/sudoku/${gameId}/create?difficulty=easy&mode=collaborative`, { method: "POST" });
  await requestJson(`/api/sudoku/${gameId}/join?playerName=Alice`, { method: "POST" });
  await requestJson(`/api/sudoku/${gameId}/join?playerName=Bob`, { method: "POST" });

  const state = await requestJson(`/api/sudoku/${gameId}`);
  let target = null;

  for (let row = 0; row < 9 && !target; row += 1) {
    for (let col = 0; col < 9 && !target; col += 1) {
      if (!state.fixed[row][col]) {
        target = { row, col, value: state.solution[row][col] };
      }
    }
  }

  if (!target) {
    throw new Error("Unable to find editable sudoku cell");
  }

  const { tabA, tabB } = await setupTwoProbes();
  const topic = `/topic/sudoku/${gameId}`;

  try {
    tabA.subscribe(topic);
    tabB.subscribe(topic);
    await sleep(200);

    await requestJson(
      `/api/sudoku/${gameId}/move?playerName=Alice&row=${target.row}&col=${target.col}&value=${target.value}`,
      { method: "POST" }
    );

    await Promise.all([
      tabA.waitFor(topic, (m) => m.includes('"mistakes"')),
      tabB.waitFor(topic, (m) => m.includes('"mistakes"')),
    ]);

    if (tabA.count(topic) < 1 || tabB.count(topic) < 1) {
      throw new Error(`Expected sudoku updates for both tabs, got TabA=${tabA.count(topic)} TabB=${tabB.count(topic)}`);
    }

    console.log(`PASS sudoku: both tabs received updates on ${topic}`);
  } finally {
    await Promise.all([tabA.close(), tabB.close()]);
  }
}

async function main() {
  const start = Date.now();

  try {
    const lobbyId = await testLobbyChat();
    await testTicTacToeFromLobby(lobbyId);
    await testChessRealtime();
    await testSudokuRealtime();

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\nALL SMOKE TESTS PASSED in ${elapsed}s`);
    process.exit(0);
  } catch (error) {
    console.error("\nSMOKE TEST FAILED:", error.message);
    process.exit(1);
  }
}

main();
