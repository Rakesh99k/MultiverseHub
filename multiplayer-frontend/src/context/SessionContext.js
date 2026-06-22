"use client";

import { createContext, useContext, useMemo, useState } from "react";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [playerName, setPlayerName] = useState("");
  const [activeLobbyId, setActiveLobbyId] = useState("");
  const [activeGameId, setActiveGameId] = useState("");
  const [activeGameType, setActiveGameType] = useState("");

  const value = useMemo(
    () => ({
      playerName,
      setPlayerName,
      activeLobbyId,
      setActiveLobbyId,
      activeGameId,
      setActiveGameId,
      activeGameType,
      setActiveGameType,
    }),
    [playerName, activeLobbyId, activeGameId, activeGameType]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }

  return context;
}
