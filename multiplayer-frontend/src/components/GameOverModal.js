"use client";

import { useRouter } from "next/navigation";

/**
 * Reusable game over modal.
 *
 * Props:
 *   isOpen      → boolean
 *   title       → string  (e.g. "Checkmate!")
 *   subtitle    → string  (e.g. "White wins!")
 *   emoji       → string  (e.g. "🏆")
 *   result      → "win" | "loss" | "draw"
 *   stats       → { label: string, value: string }[]
 *   onRematch   → function or null (null hides rematch button)
 *   onClose     → function
 */
export default function GameOverModal({
                                          isOpen,
                                          title    = "Game Over",
                                          subtitle = "",
                                          emoji    = "🎮",
                                          result   = "draw",
                                          stats    = [],
                                          onRematch,
                                          onClose,
                                      }) {
    const router = useRouter();

    if (!isOpen) return null;

    const resultStyle = {
        win:  { bg: "from-emerald-400 to-emerald-600", text: "text-emerald-800", label: "Victory!" },
        loss: { bg: "from-rose-400 to-rose-600",       text: "text-rose-800",   label: "Defeat" },
        draw: { bg: "from-gray-400 to-gray-500",       text: "text-gray-800",   label: "Draw" },
    }[result];

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with gradient */}
                <div className={`bg-gradient-to-br ${resultStyle.bg} px-6 py-8 text-center`}>
                    <div className="text-6xl">{emoji}</div>
                    <p className="mt-2 text-xs font-bold uppercase tracking-wider text-white/80">
                        {resultStyle.label}
                    </p>
                    <h2 className="mt-1 text-3xl font-bold text-white">
                        {title}
                    </h2>
                    {subtitle && (
                        <p className="mt-1 text-lg text-white/90">
                            {subtitle}
                        </p>
                    )}
                </div>

                {/* Stats */}
                {stats.length > 0 && (
                    <div className="border-b border-gray-100 px-6 py-4">
                        <div className="grid grid-cols-2 gap-3">
                            {stats.map((stat, i) => (
                                <div key={i} className="rounded-lg bg-gray-50 px-3 py-2 text-center">
                                    <p className="text-xs uppercase tracking-wide text-gray-500">
                                        {stat.label}
                                    </p>
                                    <p className="mt-0.5 text-lg font-bold text-gray-900">
                                        {stat.value}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Buttons */}
                <div className="flex flex-col gap-2 p-6">
                    {onRematch && (
                        <button
                            onClick={() => {
                                onRematch();
                                onClose();
                            }}
                            className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
                        >
                            🔄 Play Again
                        </button>
                    )}
                    <button
                        onClick={() => {
                            onClose();
                            router.push("/lobby");
                        }}
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                    >
                        ← Back to Lobbies
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full rounded-lg px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700"
                    >
                        Stay & Review
                    </button>
                </div>
            </div>
        </div>
    );
}