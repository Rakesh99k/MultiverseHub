// filename: src/app/lobby/[lobbyId]/page.js

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
  if (lower.startsWith("chess-"))  return `/games/chess/${gameId}`;
  if (lower.startsWith("sudoku-")) return `/games/sudoku/${gameId}`;
  return `/games/tictactoe/${gameId}`;
}

export default function LobbyDetailPage() {
  const params  = useParams();
  const router  = useRouter();
  const lobbyId = params?.lobbyId;

  const {
    playerName,
    setPlayerName,
    setActiveLobbyId,
    setActiveGameId,
    setActiveGameType,
  } = useSession();

  const [lobby,            setLobby]           = useState(null);
  const [chatInput,        setChatInput]        = useState("");
  const [chatMessages,     setChatMessages]     = useState([]);
  const [selectedGameType, setSelectedGameType] = useState("tictactoe");
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState("");
  const [connected,        setConnected]        = useState(false);
  const [redirecting,      setRedirecting]      = useState(false);

  // ─── Refs (always current, safe in callbacks) ─────────────────────────────
  const realtimeRef     = useRef(null);
  const hasRedirected   = useRef(false);
  const playerNameRef   = useRef(playerName);   // ← KEY: always current name
  const lobbyRef        = useRef(null);          // ← always current lobby

  // Keep refs in sync with state
  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);

  // ─── Redirect logic ───────────────────────────────────────────────────────
  // Uses refs — safe to call from WebSocket callbacks
  const tryRedirect = useCallback(
      (lobbyData) => {
        if (!lobbyData)             return;
        if (hasRedirected.current)  return;
        if (lobbyData.status !== "IN_GAME") return;
        if (!lobbyData.gameId)      return;

        const name = playerNameRef.current?.trim();
        if (!name)                  return;
        if (!lobbyData.players.includes(name)) return;

        // All checks passed — redirect
        hasRedirected.current = true;
        setRedirecting(true);

        setActiveGameId(lobbyData.gameId);
        const lower = lobbyData.gameId.toLowerCase();
        if (lower.startsWith("chess-"))       setActiveGameType("chess");
        else if (lower.startsWith("sudoku-")) setActiveGameType("sudoku");
        else                                  setActiveGameType("tictactoe");

        const path = resolveGamePath(lobbyData.gameId);

        setTimeout(() => router.push(path), 400);
      },
      [router, setActiveGameId, setActiveGameType]
  );

  // ─── Update lobby state + check redirect ─────────────────────────────────
  const applyLobbyUpdate = useCallback(
      (data) => {
        if (!data) return;
        setLobby(data);
        lobbyRef.current = data;
        tryRedirect(data);
      },
      [tryRedirect]
  );

  // ─── Fetch lobby from API ─────────────────────────────────────────────────
  const fetchLobby = useCallback(async () => {
    if (!lobbyId) return;
    try {
      const data = await lobbyApi.getLobby(lobbyId);
      applyLobbyUpdate(data);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load lobby");
    }
  }, [lobbyId, applyLobbyUpdate]);

  // ─── Setup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!lobbyId) return;

    setActiveLobbyId(lobbyId);

    // Initial load
    setLoading(true);
    fetchLobby().finally(() => setLoading(false));

    // WebSocket
    const realtime = createRealtimeClient({
      onConnect: () => {
        setConnected(true);

        // Subscribe to lobby-specific updates
        // Backend sends full lobby object here on join/leave/start
        realtime.subscribe(`/topic/lobby/${lobbyId}`, (data) => {
          console.log("[WS] /topic/lobby/" + lobbyId, data);
          applyLobbyUpdate(data);
        });

        // Subscribe to general lobby updates as fallback
        realtime.subscribe("/topic/lobbies", (data) => {
          console.log("[WS] /topic/lobbies", data);
          // Backend sends single lobby object
          if (data && data.id === lobbyId) {
            applyLobbyUpdate(data);
          }
        });

        // Chat
        realtime.subscribe(`/topic/lobby/${lobbyId}/chat`, (message) => {
          if (!message) return;
          const text = typeof message === "string"
              ? message
              : JSON.stringify(message);
          setChatMessages((prev) => [
            ...prev,
            { id: `${Date.now()}-${Math.random()}`, text },
          ]);
        });
      },

      onDisconnect: () => setConnected(false),
      onError: (msg) => setError(String(msg)),
    });

    realtimeRef.current = realtime;
    realtime.activate();

    // Polling fallback — every 3 seconds check lobby state
    // This guarantees redirect even if WebSocket message is missed
    const pollInterval = setInterval(() => {
      if (hasRedirected.current) {
        clearInterval(pollInterval);
        return;
      }
      fetchLobby();
    }, 3000);

    return () => {
      clearInterval(pollInterval);
      realtimeRef.current = null;
      realtime.deactivate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyId]);

  // ─── Re-check redirect when playerName changes ────────────────────────────
  // e.g. player types name AFTER game already started
  useEffect(() => {
    if (lobbyRef.current) {
      tryRedirect(lobbyRef.current);
    }
  }, [playerName, tryRedirect]);

  // ─── Computed ─────────────────────────────────────────────────────────────
  const isInLobby = useMemo(() => {
    if (!lobby || !playerName.trim()) return false;
    return lobby.players.includes(playerName.trim());
  }, [lobby, playerName]);

  const canStartGame = useMemo(() => {
    if (!lobby || !isInLobby)       return false;
    if (lobby.status !== "WAITING") return false;
    const min = selectedGameType === "sudoku" ? 1 : 2;
    return lobby.players.length >= min;
  }, [lobby, isInLobby, selectedGameType]);

  // ─── Actions ──────────────────────────────────────────────────────────────
  async function joinLobby() {
    if (!playerName.trim()) {
      setError("Enter your player name first");
      return;
    }
    try {
      const updated = await lobbyApi.joinLobby(lobbyId, playerName.trim());
      applyLobbyUpdate(updated);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to join");
    }
  }

  async function leaveLobby() {
    if (!playerName.trim()) {
      setError("Enter your player name first");
      return;
    }
    try {
      const updated = await lobbyApi.leaveLobby(lobbyId, playerName.trim());
      applyLobbyUpdate(updated);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to leave");
    }
  }

  async function startGame() {
    if (!canStartGame) return;
    try {
      const updated = await lobbyApi.startGame(lobbyId, selectedGameType);
      // This player redirects immediately from the API response
      applyLobbyUpdate(updated);
    } catch (err) {
      setError(err.message || "Unable to start game");
    }
  }

  async function sendChat() {
    if (!chatInput.trim()) return;
    if (!realtimeRef.current?.isConnected()) {
      setError("Not connected");
      return;
    }
    const payload = `${playerName || "Anonymous"}: ${chatInput.trim()}`;
    realtimeRef.current.publish(`/app/lobby/${lobbyId}/chat`, payload);
    setChatInput("");
  }

  // ─── Render: loading / redirecting ───────────────────────────────────────
  if (loading) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <p className="text-gray-500">Loading lobby...</p>
        </div>
    );
  }

  if (redirecting) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="mb-4 text-5xl">🎮</div>
            <p className="text-2xl font-bold text-gray-900">Game Starting!</p>
            <p className="mt-2 text-gray-500">
              Taking you to the game...
            </p>
          </div>
        </div>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-5xl p-6">

          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">Lobby</h1>
            <Link
                href="/lobby"
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              ← Back
            </Link>
          </div>

          {/* Lobby info */}
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-400">{lobby?.id}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {lobby?.name}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  lobby?.status === "WAITING"  ? "bg-emerald-100 text-emerald-700" :
                      lobby?.status === "IN_GAME"  ? "bg-amber-100 text-amber-700" :
                          "bg-gray-100 text-gray-500"
              }`}>
                {lobby?.status}
              </span>
                <span className={`flex items-center gap-1 text-xs ${
                    connected ? "text-emerald-600" : "text-rose-500"
                }`}>
                <span className={`h-2 w-2 rounded-full ${
                    connected ? "bg-emerald-500" : "bg-rose-500"
                }`} />
                  {connected ? "Live" : "Disconnected"}
              </span>
              </div>
            </div>

            {/* Rejoin link */}
            {lobby?.gameId && lobby?.status === "IN_GAME" && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-medium text-amber-800">
                    A game is already in progress
                  </p>
                  <button
                      onClick={() => router.push(resolveGamePath(lobby.gameId))}
                      className="mt-1 text-sm text-blue-600 underline hover:text-blue-800"
                  >
                    Click here to rejoin →
                  </button>
                </div>
            )}
          </div>

          {/* Error */}
          {error && (
              <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <span>{error}</span>
                <button
                    onClick={() => setError("")}
                    className="ml-4 font-bold text-red-400 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
          )}

          {/* Controls */}
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Controls
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Your name
                </label>
                <input
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Alice"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Game type
                </label>
                <select
                    value={selectedGameType}
                    onChange={(e) => setSelectedGameType(e.target.value)}
                    disabled={lobby?.status !== "WAITING"}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="tictactoe">❌ TicTacToe</option>
                  <option value="chess">♟️ Chess</option>
                  <option value="sudoku">🔢 Sudoku</option>
                </select>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                {!isInLobby ? (
                    <button
                        onClick={joinLobby}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                    >
                      Join Lobby
                    </button>
                ) : (
                    <button
                        onClick={leaveLobby}
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                    >
                      Leave
                    </button>
                )}

                <button
                    onClick={startGame}
                    disabled={!canStartGame}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  🚀 Start
                </button>
              </div>
            </div>

            {/* Status hint */}
            {isInLobby && lobby?.status === "WAITING" && (
                <p className="mt-3 text-xs text-gray-500">
                  {canStartGame
                      ? `✅ Ready! Click Start to begin ${selectedGameType}.`
                      : `⏳ Need ${selectedGameType === "sudoku" ? 1 : 2} player(s) minimum.`}
                </p>
            )}
          </div>

          {/* Players + Chat */}
          <div className="grid gap-4 md:grid-cols-2">

            {/* Players */}
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Players ({lobby?.players?.length || 0}/4)
              </h2>

              {lobby?.players?.length ? (
                  <ul className="space-y-2">
                    {lobby.players.map((player, i) => (
                        <li
                            key={player}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                                player === playerName.trim()
                                    ? "bg-blue-50 ring-1 ring-blue-200"
                                    : "bg-gray-50"
                            }`}
                        >
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-xs font-bold text-white">
                      {player.charAt(0).toUpperCase()}
                    </span>
                          <span className="text-sm font-medium text-gray-800">
                      {player}
                    </span>
                          <div className="ml-auto flex gap-1">
                            {i === 0 && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                          Host
                        </span>
                            )}
                            {player === playerName.trim() && (
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                          You
                        </span>
                            )}
                          </div>
                        </li>
                    ))}
                  </ul>
              ) : (
                  <p className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
                    No players yet. Join to get started!
                  </p>
              )}
            </section>

            {/* Chat */}
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Lobby Chat
              </h2>

              <div className="mb-3 h-48 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                {chatMessages.length === 0 ? (
                    <p className="text-center text-gray-400">
                      No messages yet 👋
                    </p>
                ) : (
                    chatMessages.map((msg) => (
                        <p key={msg.id} className="mb-1 leading-relaxed text-gray-700">
                          {msg.text}
                        </p>
                    ))
                )}
              </div>

              <div className="flex gap-2">
                <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendChat()}
                    placeholder="Type a message..."
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                    onClick={sendChat}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
                >
                  Send
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
  );
}