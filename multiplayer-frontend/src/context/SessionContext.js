"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const SessionContext = createContext(null);

// Safe localStorage helpers (SSR safe)
function storageGet(key, fallback = "") {
    if (typeof window === "undefined") return fallback;
    try {
        return localStorage.getItem(key) ?? fallback;
    } catch {
        return fallback;
    }
}

function storageSet(key, value) {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(key, value);
    } catch {
        // storage might be full or blocked
    }
}

export function SessionProvider({ children }) {
    const [playerName, setPlayerNameState] = useState("");
    const [activeLobbyId, setActiveLobbyIdState] = useState("");
    const [activeGameId, setActiveGameIdState] = useState("");
    const [activeGameType, setActiveGameTypeState] = useState("");
    const [hydrated, setHydrated] = useState(false);

    // Hydrate from localStorage once on mount (client only)
    useEffect(() => {
        setPlayerNameState(storageGet("mvh_playerName", ""));
        setActiveLobbyIdState(storageGet("mvh_activeLobbyId", ""));
        setActiveGameIdState(storageGet("mvh_activeGameId", ""));
        setActiveGameTypeState(storageGet("mvh_activeGameType", ""));
        setHydrated(true);
    }, []);

    // Wrapped setters that also persist to localStorage
    const setPlayerName = useCallback((name) => {
        setPlayerNameState(name);
        storageSet("mvh_playerName", name);
    }, []);

    const setActiveLobbyId = useCallback((id) => {
        setActiveLobbyIdState(id);
        storageSet("mvh_activeLobbyId", id);
    }, []);

    const setActiveGameId = useCallback((id) => {
        setActiveGameIdState(id);
        storageSet("mvh_activeGameId", id);
    }, []);

    const setActiveGameType = useCallback((type) => {
        setActiveGameTypeState(type);
        storageSet("mvh_activeGameType", type);
    }, []);

    const value = useMemo(
        () => ({
            hydrated,
            playerName,
            setPlayerName,
            activeLobbyId,
            setActiveLobbyId,
            activeGameId,
            setActiveGameId,
            activeGameType,
            setActiveGameType,
        }),
        [
            hydrated,
            playerName,
            setPlayerName,
            activeLobbyId,
            setActiveLobbyId,
            activeGameId,
            setActiveGameId,
            activeGameType,
            setActiveGameType,
        ]
    );

    return (
        <SessionContext.Provider value={value}>
            {children}
        </SessionContext.Provider>
    );
}

export function useSession() {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error("useSession must be used within SessionProvider");
    }
    return context;
}