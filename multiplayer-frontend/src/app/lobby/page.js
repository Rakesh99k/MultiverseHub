"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { lobbyApi } from "@/lib/api";
import { createRealtimeClient } from "@/lib/websocket";
import { useSession } from "@/context/SessionContext";
import { useToast } from "@/components/ToastProvider";

export default function LobbyPage() {
  const router = useRouter();
  const { playerName, setPlayerName, setActiveLobbyId } = useSession();
  const toast = useToast();

  const [lobbies,         setLobbies]        = useState([]);
  const [loading,         setLoading]        = useState(true);
  const [createLobbyName, setCreateLobbyName] = useState("");
  const [availableOnly,   setAvailableOnly]  = useState(false);

  const loadLobbies = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const data = await lobbyApi.getLobbies(availableOnly);
      setLobbies(data);
    } catch (err) {
      toast.error(err.message || "Unable to load lobbies");
    } finally {
      setLoading(false);
    }
  }, [availableOnly, toast]);

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
    return () => realtime.deactivate();
  }, [loadLobbies]);

  async function createLobby() {
    if (!createLobbyName.trim()) {
      toast.warning("Enter a lobby name first");
      return;
    }
    try {
      const newLobby = await lobbyApi.createLobby(createLobbyName.trim());
      setCreateLobbyName("");
      setActiveLobbyId(newLobby.id);
      toast.success(`Lobby "${newLobby.name}" created!`);
      router.push(`/lobby/${newLobby.id}`);
    } catch (err) {
      toast.error(err.message || "Unable to create lobby");
    }
  }

  function openLobby(lobbyId) {
    if (!playerName.trim()) {
      toast.warning("Enter your player name first");
      return;
    }
    setActiveLobbyId(lobbyId);
    router.push(`/lobby/${lobbyId}`);
  }

  const statusBadge = (status) => ({
    WAITING:  "bg-emerald-100 text-emerald-700",
    IN_GAME:  "bg-amber-100 text-amber-700",
    FINISHED: "bg-gray-100 text-gray-500",
  }[status] || "bg-gray-100 text-gray-500");

  return (
      <div className="mx-auto max-w-5xl p-6">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">🎮 Lobbies</h1>
          <p className="mt-1 text-gray-500">
            Create or join a lobby to start playing
          </p>
        </div>

        {/* Create card */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Get Started
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Your player name
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
                New lobby name
              </label>
              <input
                  value={createLobbyName}
                  onChange={(e) => setCreateLobbyName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createLobby()}
                  placeholder="Arena, Game Room..."
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <button
                  onClick={createLobby}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                + Create Lobby
              </button>

              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                    type="checkbox"
                    checked={availableOnly}
                    onChange={(e) => setAvailableOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                />
                Available only
              </label>
            </div>
          </div>
        </div>

        {/* Lobby list */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {availableOnly ? "Available Lobbies" : "All Lobbies"}
            </h2>
            <button
                onClick={() => loadLobbies(false)}
                className="text-sm text-blue-600 hover:text-blue-800"
            >
              ↻ Refresh
            </button>
          </div>

          {loading ? (
              <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-400">
                Loading lobbies...
              </div>
          ) : lobbies.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
                <p className="text-gray-500">No lobbies found.</p>
                <p className="mt-1 text-sm text-gray-400">
                  Create one above to get started!
                </p>
              </div>
          ) : (
              <ul className="space-y-3">
                {lobbies.map((lobby) => (
                    <li
                        key={lobby.id}
                        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-lg font-semibold text-gray-900">
                              {lobby.name}
                            </p>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(lobby.status)}`}>
                        {lobby.status}
                      </span>
                          </div>
                          <p className="mt-0.5 text-xs text-gray-400">{lobby.id}</p>
                          <p className="mt-1 text-sm text-gray-600">
                            👥 {lobby.players.length} / 4
                            {lobby.players.length > 0 && (
                                <span className="ml-2 text-gray-400">
                          ({lobby.players.join(", ")})
                        </span>
                            )}
                          </p>
                        </div>

                        <button
                            onClick={() => openLobby(lobby.id)}
                            className="ml-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                        >
                          Open →
                        </button>
                      </div>
                    </li>
                ))}
              </ul>
          )}
        </div>
      </div>
  );
}