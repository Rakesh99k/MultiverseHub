"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function LobbyPage() {
  const [lobbies, setLobbies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all lobbies on mount
  useEffect(() => {
    fetch("http://localhost:8080/api/lobbies")
      .then((res) => res.json())
      .then((data) => {
        setLobbies(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Create a new lobby
  const createLobby = () => {
    fetch("http://localhost:8080/api/lobbies", { method: "POST" })
      .then((res) => res.json())
      .then((newLobby) => {
        setLobbies((prev) => [...prev, newLobby]);
      });
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Available Lobbies</h1>

      <button
        onClick={createLobby}
        className="bg-green-500 text-white px-4 py-2 rounded mb-4"
      >
        ➕ Create New Lobby
      </button>

      {loading ? (
        <p>Loading lobbies...</p>
      ) : lobbies.length === 0 ? (
        <p>No lobbies available. Create one!</p>
      ) : (
        <ul className="space-y-2">
          {lobbies.map((lobby) => (
            <li key={lobby.id} className="p-3 border rounded bg-gray-50">
              <p className="font-semibold">Lobby ID: {lobby.id}</p>
              <Link
                href={`/lobby/${lobby.id}`}
                className="text-blue-600 underline"
              >
                Join Lobby
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
