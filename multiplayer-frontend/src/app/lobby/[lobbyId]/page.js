"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lobbyApi } from "../../../lib/api";
import { createRealtimeClient } from "../../../lib/websocket";
import { useSession } from "../../../context/SessionContext";

function resolveGamePath(gameType, gameId) {
  const normalized = (gameType || "tictactoe").toLowerCase();
  if (normalized === "chess") {
    return `/games/chess/${gameId}`;
  }
  if (normalized === "sudoku") {
    return `/games/sudoku/${gameId}`;
  }
  return `/games/tictactoe/${gameId}`;
}

export default function LobbyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const lobbyId = params?.lobbyId;

  const {
    playerName,
    setPlayerName,
    setActiveLobbyId,
    setActiveGameId,
    setActiveGameType,
  } = useSession();

  const [lobby, setLobby] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [selectedGameType, setSelectedGameType] = useState("tictactoe");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const realtimeRef = useRef(null);

  const loadLobby = useCallback(async (showLoader = false) => {
    if (!lobbyId) {
      return;
    }

    if (showLoader) {
      setLoading(true);
    }

    try {
      const data = await lobbyApi.getLobby(lobbyId);
      setLobby(data);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load lobby");
    } finally {
      setLoading(false);
    }
  }, [lobbyId]);

  useEffect(() => {
    if (!lobbyId) {
      return;
    }

    setActiveLobbyId(lobbyId);
    loadLobby(true);

    const realtime = createRealtimeClient({
      onConnect: () => {
        setConnected(true);

        realtime.subscribe("/topic/lobbies", () => {
          loadLobby(false);
        });

        realtime.subscribe(`/topic/lobby/${lobbyId}/chat`, (message) => {
          if (!message) {
            return;
          }

          const text = typeof message === "string" ? message : JSON.stringify(message);
          setChatMessages((prev) => [...prev, text]);
        });
      },
      onDisconnect: () => setConnected(false),
      onError: (message) => setError(message),
    });

    realtimeRef.current = realtime;
    realtime.activate();

    return () => {
      realtimeRef.current = null;
      realtime.deactivate();
    };
  }, [lobbyId, loadLobby, setActiveLobbyId]);

  const isInLobby = useMemo(() => {
    if (!lobby || !playerName.trim()) {
      return false;
    }
    return lobby.players.includes(playerName.trim());
  }, [lobby, playerName]);

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
    try {
      const updated = await lobbyApi.startGame(lobbyId, selectedGameType);
      setLobby(updated);
      setActiveGameId(updated.gameId);
      setActiveGameType(selectedGameType);
      router.push(resolveGamePath(selectedGameType, updated.gameId));
    } catch (err) {
      setError(err.message || "Unable to start game");
    }
  }

  async function sendChatMessage() {
    if (!chatInput.trim()) {
      return;
    }

    if (!realtimeRef.current || !realtimeRef.current.isConnected()) {
      setError("Chat is not connected yet");
      return;
    }

    const payload = `${playerName || "Player"}: ${chatInput.trim()}`;
    realtimeRef.current.publish(`/app/lobby/${lobbyId}/chat`, payload);
    setChatInput("");
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl p-6">Loading lobby...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Lobby</h1>
        <Link href="/lobby" className="rounded-md border border-zinc-300 px-3 py-1.5">
          Back to Lobbies
        </Link>
      </div>

      <div className="mb-4 rounded-lg bg-zinc-50 p-4">
        <p className="text-sm text-zinc-500">{lobby?.id}</p>
        <p className="mt-1 text-lg font-semibold">{lobby?.name}</p>
        <p className="text-sm">Status: {lobby?.status}</p>
        <p className="text-sm">WebSocket: {connected ? "connected" : "disconnected"}</p>
      </div>

      <div className="mb-6 grid gap-4 rounded-xl border border-zinc-200 p-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <label className="mb-2 block text-sm font-medium">Player name</label>
          <input
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
            placeholder="Alice"
          />
        </div>

        <div className="md:col-span-2 flex flex-wrap items-end gap-3">
          <button
            onClick={joinLobby}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Join
          </button>
          <button
            onClick={leaveLobby}
            className="rounded-md border border-zinc-400 px-4 py-2 hover:bg-zinc-100"
          >
            Leave
          </button>

          <select
            value={selectedGameType}
            onChange={(event) => setSelectedGameType(event.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2"
          >
            <option value="tictactoe">TicTacToe</option>
            <option value="chess">Chess</option>
            <option value="sudoku">Sudoku</option>
          </select>

          <button
            onClick={startGame}
            disabled={!isInLobby}
            className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Start Game
          </button>
        </div>
      </div>

      {error ? <p className="mb-4 rounded-md bg-rose-100 px-3 py-2 text-rose-700">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 p-4">
          <h2 className="mb-3 text-xl font-semibold">Players ({lobby?.players?.length || 0}/4)</h2>
          {lobby?.players?.length ? (
            <ul className="space-y-2">
              {lobby.players.map((player) => (
                <li key={player} className="rounded-md bg-zinc-100 px-3 py-2">
                  {player}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No players yet</p>
          )}

          {lobby?.gameId ? (
            <div className="mt-4 rounded-md bg-emerald-100 px-3 py-2 text-emerald-800">
              Game created: {lobby.gameId}
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-zinc-200 p-4">
          <h2 className="mb-3 text-xl font-semibold">Lobby Chat</h2>
          <div className="mb-3 h-52 overflow-y-auto rounded-md border border-zinc-200 p-2 text-sm">
            {chatMessages.length === 0 ? (
              <p className="text-zinc-500">No messages yet</p>
            ) : (
              chatMessages.map((msg, index) => (
                <p key={`${msg}-${index}`} className="mb-1">
                  {msg}
                </p>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="Type your message"
              className="flex-1 rounded-md border border-zinc-300 px-3 py-2"
            />
            <button
              onClick={sendChatMessage}
              className="rounded-md bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700"
            >
              Send
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
