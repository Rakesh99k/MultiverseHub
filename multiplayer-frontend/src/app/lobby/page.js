"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { lobbyApi } from "../../lib/api";
import { createRealtimeClient } from "../../lib/websocket";
import { useSession } from "../../context/SessionContext";

export default function LobbyPage() {
  const router = useRouter();
  const { playerName, setPlayerName, setActiveLobbyId } = useSession();

  const [lobbies, setLobbies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createLobbyName, setCreateLobbyName] = useState("");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [error, setError] = useState("");

  const loadLobbies = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const data = await lobbyApi.getLobbies(availableOnly);
      setLobbies(data);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load lobbies");
    } finally {
      setLoading(false);
    }
  }, [availableOnly]);

  useEffect(() => {
    loadLobbies(true);
  }, [loadLobbies]);

  useEffect(() => {
    const realtime = createRealtimeClient({
      onConnect: () => {
        realtime.subscribe("/topic/lobbies", () => {
          loadLobbies(false);
        });
      },
    });

    realtime.activate();

    return () => {
      realtime.deactivate();
    };
  }, [loadLobbies]);

  async function createLobby() {
    if (!createLobbyName.trim()) {
      setError("Lobby name is required");
      return;
    }

    try {
      const newLobby = await lobbyApi.createLobby(createLobbyName.trim());
      setCreateLobbyName("");
      setError("");
      router.push(`/lobby/${newLobby.id}`);
    } catch (err) {
      setError(err.message || "Unable to create lobby");
    }
  }

  function joinLobby(lobbyId) {
    if (!playerName.trim()) {
      setError("Enter your player name before joining");
      return;
    }

    setActiveLobbyId(lobbyId);
    router.push(`/lobby/${lobbyId}`);
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-3xl font-bold">Lobbies</h1>

      <div className="mb-6 grid gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <label className="mb-2 block text-sm font-medium">Player name</label>
          <input
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            placeholder="Alice"
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
          />
        </div>

        <div className="md:col-span-1">
          <label className="mb-2 block text-sm font-medium">Create lobby</label>
          <input
            value={createLobbyName}
            onChange={(event) => setCreateLobbyName(event.target.value)}
            placeholder="Arena"
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
          />
        </div>

        <div className="flex items-end gap-3">
          <button
            onClick={createLobby}
            className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
          >
            Create
          </button>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(event) => setAvailableOnly(event.target.checked)}
            />
            Available only
          </label>
        </div>
      </div>

      {error ? <p className="mb-4 rounded-md bg-rose-100 px-3 py-2 text-rose-700">{error}</p> : null}

      {loading ? (
        <p>Loading lobbies...</p>
      ) : lobbies.length === 0 ? (
        <p>No lobbies available. Create one!</p>
      ) : (
        <ul className="space-y-3">
          {lobbies.map((lobby) => (
            <li key={lobby.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-zinc-500">{lobby.id}</p>
              <p className="mt-1 text-lg font-semibold">{lobby.name}</p>
              <p className="mt-1 text-sm">Players: {lobby.players.length}/4</p>
              <p className="text-sm">Status: {lobby.status}</p>

              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => joinLobby(lobby.id)}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
                >
                  Open Lobby
                </button>
                <Link href={`/lobby/${lobby.id}`} className="rounded-md border border-zinc-300 px-3 py-1.5">
                  View Details
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
