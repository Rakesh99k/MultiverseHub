"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lobbyApi } from "../../../lib/api";
import { createRealtimeClient } from "../../../lib/websocket";
import { useSession } from "../../../context/SessionContext";

function resolveGamePath(gameId) {
  if (!gameId) return "/lobby";
  const lower = gameId.toLowerCase();
  if (lower.startsWith("chess-"))   return `/games/chess/${gameId}`;
  if (lower.startsWith("sudoku-"))  return `/games/sudoku/${gameId}`;
  return `/games/tictactoe/${gameId}`;
}

export default function LobbyDetailPage() {
  const params   = useParams();
  const router   = useRouter();
  const lobbyId  = params?.lobbyId;

  const {
    playerName,
    setPlayerName,
    setActiveLobbyId,
    setActiveGameId,
    setActiveGameType,
  } = useSession();

  const [lobby,            setLobby]            = useState(null);
  const [chatInput,        setChatInput]         = useState("");
  const [chatMessages,     setChatMessages]      = useState([]);
  const [selectedGameType, setSelectedGameType]  = useState("tictactoe");
  const [loading,          setLoading]           = useState(true);
  const [error,            setError]             = useState("");
  const [connected,        setConnected]         = useState(false);
  const [redirecting,      setRedirecting]       = useState(false);

  const realtimeRef = useRef(null);

  // ─── Redirect helper ────────────────────────────────────────────────────────
  // Called whenever lobby data updates — checks if game has started
  const redirectIfGameStarted = useCallback(
      (lobbyData) => {
        if (!lobbyData) return;
        if (redirecting)  return;

        const gameStarted =
            lobbyData.status === "IN_GAME" && lobbyData.gameId;

        if (!gameStarted) return;

        // Only redirect players who are IN the lobby
        // Spectators / non-members stay on lobby page
        const playerIsInLobby =
            playerName.trim() &&
            lobbyData.players.includes(playerName.trim());

        if (!playerIsInLobby) return;

        // Redirect to the correct game page
        const path = resolveGamePath(lobbyData.gameId);
        setRedirecting(true);
        setActiveGameId(lobbyData.gameId);

        // Derive game type from gameId prefix
        const lower = lobbyData.gameId.toLowerCase();
        if (lower.startsWith("chess-"))        setActiveGameType("chess");
        else if (lower.startsWith("sudoku-"))  setActiveGameType("sudoku");
        else                                   setActiveGameType("tictactoe");

        router.push(path);
      },
      [playerName, redirecting, router, setActiveGameId, setActiveGameType]
  );

  // ─── Load lobby ─────────────────────────────────────────────────────────────
  const loadLobby = useCallback(
      async (showLoader = false) => {
        if (!lobbyId) return;
        if (showLoader) setLoading(true);

        try {
          const data = await lobbyApi.getLobby(lobbyId);
          setLobby(data);
          setError("");
          // Check immediately after load
          redirectIfGameStarted(data);
        } catch (err) {
          setError(err.message || "Unable to load lobby");
        } finally {
          setLoading(false);
        }
      },
      [lobbyId, redirectIfGameStarted]
  );

  // ─── Initial setup + WebSocket ───────────────────────────────────────────────
  useEffect(() => {
    if (!lobbyId) return;

    setActiveLobbyId(lobbyId);
    loadLobby(true);

    const realtime = createRealtimeClient({
      onConnect: () => {
        setConnected(true);

        // Listen for any lobby list changes
        // (fires when anyone joins, leaves, or starts game)
        realtime.subscribe("/topic/lobbies", () => {
          loadLobby(false);
        });

        // Listen for chat messages in this lobby
        realtime.subscribe(`/topic/lobby/${lobbyId}/chat`, (message) => {
          if (!message) return;
          const text =
              typeof message === "string" ? message : JSON.stringify(message);
          setChatMessages((prev) => [
            ...prev,
            { id: Date.now() + Math.random(), text },
          ]);
        });
      },
      onDisconnect: () => setConnected(false),
      onError:      (message) => setError(message),
    });

    realtimeRef.current = realtime;
    realtime.activate();

    return () => {
      realtimeRef.current = null;
      realtime.deactivate();
    };
  }, [lobbyId, loadLobby, setActiveLobbyId]);

  // ─── Watch lobby state changes for redirect ───────────────────────────────
  // This covers the case where lobby state updates via WebSocket
  useEffect(() => {
    if (lobby) {
      redirectIfGameStarted(lobby);
    }
  }, [lobby, redirectIfGameStarted]);

  // ─── Computed values ──────────────────────────────────────────────────────
  const isInLobby = useMemo(() => {
    if (!lobby || !playerName.trim()) return false;
    return lobby.players.includes(playerName.trim());
  }, [lobby, playerName]);

  const canStartGame = useMemo(() => {
    if (!lobby || !isInLobby) return false;
    if (lobby.status !== "WAITING")  return false;
    const minPlayers = selectedGameType === "sudoku" ? 1 : 2;
    return lobby.players.length >= minPlayers;
  }, [lobby, isInLobby, selectedGameType]);

  // ─── Actions ──────────────────────────────────────────────────────────────
  async function joinLobby() {
    if (!playerName.trim()) {
      setError("Player name is required");
      return;
    }

    try {
      const updated = await lobbyApi.joinLobby(lobbyId, playerName.trim());
      setLobby(updated);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to join lobby");
    }
  }

  async function leaveLobby() {
    if (!playerName.trim()) {
      setError("Player name is required");
      return;
    }

    try {
      const updated = await lobbyApi.leaveLobby(lobbyId, playerName.trim());
      setLobby(updated);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to leave lobby");
    }
  }

  async function startGame() {
    if (!canStartGame) {
      const minPlayers = selectedGameType === "sudoku" ? 1 : 2;
      setError(`Need at least ${minPlayers} player(s) to start ${selectedGameType}`);
      return;
    }

    try {
      const updated = await lobbyApi.startGame(lobbyId, selectedGameType);
      setLobby(updated);
      // redirectIfGameStarted will fire via the useEffect watching lobby
    } catch (err) {
      setError(err.message || "Unable to start game");
    }
  }

  async function sendChatMessage() {
    if (!chatInput.trim()) return;

    if (!realtimeRef.current?.isConnected()) {
      setError("Chat is not connected yet");
      return;
    }

    const payload = `${playerName || "Player"}: ${chatInput.trim()}`;
    realtimeRef.current.publish(`/app/lobby/${lobbyId}/chat`, payload);
    setChatInput("");
  }

  function handleChatKeyDown(e) {
    if (e.key === "Enter") sendChatMessage();
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
        <div className="mx-auto max-w-4xl p-6">
          <p>Loading lobby...</p>
        </div>
    );
  }

  if (redirecting) {
    return (
        <div className="mx-auto max-w-4xl p-6">
          <p className="text-lg font-semibold">
            🎮 Game starting... redirecting you now
          </p>
        </div>
    );
  }

  return (
      <div className="mx-auto max-w-5xl p-6">

        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Lobby</h1>
          <Link
              href="/lobby"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            Back to Lobbies
          </Link>
        </div>

        {/* Lobby info */}
        <div className="mb-4 rounded-lg bg-zinc-50 p-4">
          <p className="text-xs text-zinc-400">{lobby?.id}</p>
          <p className="mt-1 text-xl font-semibold">{lobby?.name}</p>
          <div className="mt-1 flex gap-4 text-sm text-zinc-600">
          <span>
            Status:{" "}
            <span
                className={
                  lobby?.status === "WAITING"
                      ? "font-medium text-emerald-600"
                      : lobby?.status === "IN_GAME"
                          ? "font-medium text-amber-600"
                          : "font-medium text-zinc-500"
                }
            >
              {lobby?.status}
            </span>
          </span>
            <span>
            WebSocket:{" "}
              <span className={connected ? "text-emerald-600" : "text-rose-600"}>
              {connected ? "connected" : "disconnected"}
            </span>
          </span>
          </div>

          {/* Show game link if already in game */}
          {lobby?.gameId && lobby?.status === "IN_GAME" && (
              <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm">
                <span className="text-amber-800 font-medium">Game in progress: </span>
                <button
                    onClick={() => router.push(resolveGamePath(lobby.gameId))}
                    className="text-blue-600 underline hover:text-blue-800"
                >
                  Rejoin game →
                </button>
              </div>
          )}
        </div>

        {/* Player name + actions */}
        <div className="mb-6 rounded-xl border border-zinc-200 p-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Player name input */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Your player name
              </label>
              <input
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Alice"
              />
            </div>

            {/* Game type selector */}
            <div>
              <label className="mb-1 block text-sm font-medium">Game type</label>
              <select
                  value={selectedGameType}
                  onChange={(e) => setSelectedGameType(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  disabled={lobby?.status !== "WAITING"}
              >
                <option value="tictactoe">TicTacToe</option>
                <option value="chess">Chess</option>
                <option value="sudoku">Sudoku</option>
              </select>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-end gap-2">
              {!isInLobby ? (
                  <button
                      onClick={joinLobby}
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                  >
                    Join Lobby
                  </button>
              ) : (
                  <button
                      onClick={leaveLobby}
                      className="rounded-md border border-zinc-400 px-4 py-2 text-sm hover:bg-zinc-100"
                  >
                    Leave
                  </button>
              )}

              <button
                  onClick={startGame}
                  disabled={!canStartGame}
                  title={
                    !isInLobby
                        ? "Join the lobby first"
                        : !canStartGame
                            ? `Need at least ${selectedGameType === "sudoku" ? 1 : 2} player(s)`
                            : "Start the game"
                  }
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start Game
              </button>
            </div>
          </div>

          {/* Hint about minimum players */}
          {isInLobby && lobby?.status === "WAITING" && !canStartGame && (
              <p className="mt-2 text-xs text-zinc-500">
                {selectedGameType === "sudoku"
                    ? "You can start Sudoku solo or wait for more players."
                    : `Waiting for at least 2 players to start ${selectedGameType}.`}
              </p>
          )}
        </div>

        {/* Error */}
        {error ? (
            <p className="mb-4 rounded-md bg-rose-100 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
        ) : null}

        {/* Players + Chat */}
        <div className="grid gap-4 md:grid-cols-2">

          {/* Players list */}
          <section className="rounded-xl border border-zinc-200 p-4">
            <h2 className="mb-3 text-lg font-semibold">
              Players ({lobby?.players?.length || 0} / 4)
            </h2>

            {lobby?.players?.length ? (
                <ul className="space-y-2">
                  {lobby.players.map((player) => (
                      <li
                          key={player}
                          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                              player === playerName.trim()
                                  ? "bg-blue-50 font-medium text-blue-800"
                                  : "bg-zinc-100"
                          }`}
                      >
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        {player}
                        {player === playerName.trim() && (
                            <span className="ml-auto text-xs text-blue-500">(you)</span>
                        )}
                      </li>
                  ))}
                </ul>
            ) : (
                <p className="text-sm text-zinc-500">
                  No players yet — be the first to join!
                </p>
            )}
          </section>

          {/* Chat */}
          <section className="rounded-xl border border-zinc-200 p-4">
            <h2 className="mb-3 text-lg font-semibold">Lobby Chat</h2>

            {/* Message list */}
            <div className="mb-3 h-52 overflow-y-auto rounded-md border border-zinc-100 bg-zinc-50 p-2 text-sm">
              {chatMessages.length === 0 ? (
                  <p className="text-zinc-400">No messages yet...</p>
              ) : (
                  chatMessages.map((msg) => (
                      <p key={msg.id} className="mb-1 leading-snug">
                        {msg.text}
                      </p>
                  ))
              )}
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  placeholder="Type a message... (Enter to send)"
                  className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              <button
                  onClick={sendChatMessage}
                  className="rounded-md bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700"
              >
                Send
              </button>
            </div>
          </section>
        </div>
      </div>
  );
}