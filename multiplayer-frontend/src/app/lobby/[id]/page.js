"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

let stompClient = null;

export default function GameRoom() {
  const { id } = useParams(); // lobby/game ID
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState(null);

  // Connect WebSocket + fetch game
  useEffect(() => {
    // Fetch initial game state
    fetch(`http://localhost:8080/api/tictactoe/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("No game found");
        return res.json();
      })
      .then((data) => setGameState(data))
      .catch(() => {
        // If no game, create it
        fetch(`http://localhost:8080/api/tictactoe/${id}/create`, {
          method: "POST",
        })
          .then(() =>
            fetch(`http://localhost:8080/api/tictactoe/${id}`).then((res) =>
              res.json()
            )
          )
          .then((data) => setGameState(data));
      });

    // WebSocket client
    const client = new Client({
      webSocketFactory: () => new SockJS("http://localhost:8080/ws"),
      onConnect: () => {
        setConnected(true);
        client.subscribe(`/topic/tictactoe/${id}`, (msg) => {
          setGameState(JSON.parse(msg.body));
        });
      },
    });

    stompClient = client;
    client.activate();

    return () => client.deactivate();
  }, [id]);

  // Make move
  const makeMove = (row, col) => {
    if (!gameState || gameState.winner) return;

    fetch(
      `http://localhost:8080/api/tictactoe/${id}/move?row=${row}&col=${col}&symbol=${gameState.currentPlayer}`,
      { method: "POST" }
    )
      .then((res) => res.json())
      .then((data) => setGameState(data));
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Tic-Tac-Toe Room: {id}</h1>

      {!gameState ? (
        <p>Loading game...</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 w-48">
            {gameState.board.map((row, r) =>
              row.map((cell, c) => (
                <button
                  key={`${r}-${c}`}
                  onClick={() => makeMove(r, c)}
                  className="w-16 h-16 text-xl font-bold border flex items-center justify-center"
                >
                  {cell !== "-" ? cell : ""}
                </button>
              ))
            )}
          </div>

          <div className="mt-4">
            {gameState.winner ? (
              <p className="text-lg font-bold text-green-600">
                Winner: {gameState.winner}
              </p>
            ) : (
              <p className="text-lg">
                Current Player: {gameState.currentPlayer}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
