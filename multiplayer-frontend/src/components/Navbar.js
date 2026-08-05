"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/context/SessionContext";

export default function Navbar() {
    const pathname = usePathname();
    const router   = useRouter();

    const {
        playerName,
        activeGameId,
        activeGameType,
        activeLobbyId,
    } = useSession();

    // Derive current game path from session
    function getActiveGamePath() {
        if (!activeGameId) return null;
        const lower = activeGameId.toLowerCase();
        if (lower.startsWith("chess-"))  return `/games/chess/${activeGameId}`;
        if (lower.startsWith("sudoku-")) return `/games/sudoku/${activeGameId}`;
        return `/games/tictactoe/${activeGameId}`;
    }

    const activeGamePath = getActiveGamePath();

    // Check if we are currently on a game page
    const isOnGamePage =
        pathname.includes("/games/") ||
        pathname.includes("/lobby/");

    const gameEmoji = {
        chess:     "♟️",
        sudoku:    "🔢",
        tictactoe: "❌",
    }[activeGameType] || "🎮";

    return (
        <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">

                {/* Left — Logo */}
                <Link
                    href="/"
                    className="flex items-center gap-2 text-lg font-bold text-gray-900 hover:text-blue-600"
                >
                    🌌 MultiverseHub
                </Link>

                {/* Center — Nav links */}
                <div className="flex items-center gap-1">
                    <NavLink href="/lobby" current={pathname} label="🏠 Lobbies" />

                    {/* Active game link — only shows if in a game */}
                    {activeGamePath && (
                        <NavLink
                            href={activeGamePath}
                            current={pathname}
                            label={`${gameEmoji} Active Game`}
                            highlight
                        />
                    )}

                    {/* Active lobby link */}
                    {activeLobbyId && !activeGamePath && (
                        <NavLink
                            href={`/lobby/${activeLobbyId}`}
                            current={pathname}
                            label="🚪 My Lobby"
                        />
                    )}
                </div>

                {/* Right — Player name */}
                <div className="flex items-center gap-3">
                    {playerName.trim() ? (
                        <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-sm font-bold text-white">
                {playerName.trim().charAt(0).toUpperCase()}
              </span>
                            <span className="hidden text-sm font-medium text-gray-700 sm:block">
                {playerName.trim()}
              </span>
                        </div>
                    ) : (
                        <span className="text-sm text-gray-400">Not signed in</span>
                    )}
                </div>
            </div>
        </nav>
    );
}

// ─── NavLink helper ───────────────────────────────────────────────────────────
function NavLink({ href, current, label, highlight = false }) {
    const isActive = current === href || current.startsWith(href + "/");

    return (
        <Link
            href={href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                    ? "bg-blue-100 text-blue-700"
                    : highlight
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
        >
            {label}
        </Link>
    );
}