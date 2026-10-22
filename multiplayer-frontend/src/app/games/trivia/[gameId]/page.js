"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { triviaApi } from "@/lib/api";
import { createRealtimeClient } from "@/lib/websocket";
import { useSession } from "@/context/SessionContext";
import { useToast } from "@/components/ToastProvider";
import GameOverModal from "@/components/GameOverModal";

const OPTION_LABELS = ["A", "B", "C", "D"];
const OPTION_COLORS = [
    { bg: "bg-blue-500 hover:bg-blue-600", ring: "ring-blue-300" },
    { bg: "bg-rose-500 hover:bg-rose-600", ring: "ring-rose-300" },
    { bg: "bg-emerald-500 hover:bg-emerald-600", ring: "ring-emerald-300" },
    { bg: "bg-amber-500 hover:bg-amber-600", ring: "ring-amber-300" },
];

export default function TriviaGamePage() {
    const params = useParams();
    const gameId = params?.gameId;
    const { playerName } = useSession();
    const toast = useToast();

    const [game, setGame] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState(0);
    const [modalOpen, setModalOpen] = useState(false);

    const timerRef = useRef(null);

    // ─── Load game ─────────────────────────────────────────────────────────────
    const loadGame = useCallback(async (showLoader = false) => {
        if (showLoader) setLoading(true);
        try {
            const data = await triviaApi.getGame(gameId);
            setGame(data);
        } catch (err) {
            toast.error(err.message || "Unable to load game");
        } finally {
            setLoading(false);
        }
    }, [gameId, toast]);

    // ─── WebSocket + join ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!gameId) return;
        loadGame(true);

        const realtime = createRealtimeClient({
            onConnect: () => {
                realtime.subscribe(`/topic/trivia/${gameId}`, (data) => {
                    if (data) {
                        setGame(data);
                        if (data.status === "FINISHED") {
                            setModalOpen(true);
                        }
                    }
                });
            },
        });
        realtime.activate();
        return () => realtime.deactivate();
    }, [gameId, loadGame]);

    // Auto-join
    useEffect(() => {
        if (!gameId || !playerName?.trim()) return;
        triviaApi.join(gameId, playerName.trim()).then(setGame).catch(() => {});
    }, [gameId, playerName]);

    // ─── Countdown timer ──────────────────────────────────────────────────────
    useEffect(() => {
        if (timerRef.current) clearInterval(timerRef.current);

        if (game?.status === "PLAYING" && game?.roundEndTime > 0) {
            const tick = () => {
                const remaining = Math.max(0, Math.ceil((game.roundEndTime - Date.now()) / 1000));
                setTimeLeft(remaining);
                if (remaining <= 0) clearInterval(timerRef.current);
            };
            tick();
            timerRef.current = setInterval(tick, 250);
        } else {
            setTimeLeft(0);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [game?.status, game?.roundEndTime]);

    // ─── Computed ──────────────────────────────────────────────────────────────
    const isHost = useMemo(() => {
        if (!game?.players?.length || !playerName?.trim()) return false;
        return game.players[0] === playerName.trim();
    }, [game, playerName]);

    const hasAnswered = useMemo(() => {
        if (!game?.playerAnswers || !playerName?.trim()) return false;
        return playerName.trim() in game.playerAnswers;
    }, [game, playerName]);

    const myAnswer = useMemo(() => {
        if (!game?.playerAnswers || !playerName?.trim()) return -1;
        return game.playerAnswers[playerName.trim()] ?? -1;
    }, [game, playerName]);

    const sortedLeaderboard = useMemo(() => {
        if (!game?.scores) return [];
        return Object.entries(game.scores)
            .sort((a, b) => b[1] - a[1])
            .map(([name, score], i) => ({ rank: i + 1, name, score }));
    }, [game?.scores]);

    // Modal Props
    const modalResult = useMemo(() => {
        if (!sortedLeaderboard.length) return "draw";
        return sortedLeaderboard[0].name === playerName.trim() ? "win" : "loss";
    }, [sortedLeaderboard, playerName]);

    const modalTitle = useMemo(() => {
        if (!sortedLeaderboard.length) return "Quiz Finished";
        return sortedLeaderboard[0].name === playerName.trim() ? "Victory!" : "Defeat!";
    }, [sortedLeaderboard, playerName]);

    const modalSubtitle = useMemo(() => {
        if (!sortedLeaderboard.length) return "";
        const topScore = sortedLeaderboard[0].score;
        return `${sortedLeaderboard[0].name} dominated the quiz with ${topScore} points! 👑`;
    }, [sortedLeaderboard]);

    const modalStats = useMemo(() => {
        const myScore = game?.scores?.[playerName.trim()] ?? 0;
        return [
            { label: "Your Score", value: `${myScore} pts` },
            { label: "Winner Score", value: sortedLeaderboard.length ? `${sortedLeaderboard[0].score} pts` : "0" },
        ];
    }, [game, playerName, sortedLeaderboard]);

    // ─── Actions ───────────────────────────────────────────────────────────────
    async function startGame() {
        try {
            const updated = await triviaApi.start(gameId);
            setGame(updated);
            toast.success("Game started! 🎉");
        } catch (err) {
            toast.error(err.message || "Unable to start");
        }
    }

    async function submitAnswer(optionIndex) {
        if (!playerName?.trim()) {
            toast.warning("Set your player name first");
            return;
        }
        if (hasAnswered) return;

        try {
            const updated = await triviaApi.answer(gameId, playerName.trim(), optionIndex);
            setGame(updated);
        } catch (err) {
            toast.error(err.message || "Answer failed");
        }
    }

    async function resetGame() {
        try {
            const updated = await triviaApi.reset(gameId);
            setGame(updated);
            setModalOpen(false);
            toast.success("Game reset!");
        } catch (err) {
            toast.error(err.message || "Reset failed");
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <p className="text-gray-500">Loading trivia...</p>
            </div>
        );
    }

    const q = game?.currentQuestion;
    const correctIdx = q?.correctIndex ?? -1;
    const isRoundEnd = game?.status === "ROUND_END";
    const isFinished = game?.status === "FINISHED";
    const isPlaying = game?.status === "PLAYING";
    const isWaiting = game?.status === "WAITING";
    const timerPct = game?.timeLimitSeconds
        ? (timeLeft / game.timeLimitSeconds) * 100
        : 0;

    return (
        <div className="mx-auto max-w-4xl p-6">

            <GameOverModal
                isOpen={modalOpen}
                title={modalTitle}
                subtitle={modalSubtitle}
                emoji={modalResult === "win" ? "🏆" : "🎌"}
                result={modalResult}
                stats={modalStats}
                onRematch={resetGame}
                onClose={() => setModalOpen(false)}
            />

            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900">🎌 Anime Trivia</h1>
                <Link
                    href="/lobby"
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                    ← Lobbies
                </Link>
            </div>

            {/* Status bar */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isWaiting ? "bg-blue-100 text-blue-700" :
                isPlaying ? "bg-emerald-100 text-emerald-700" :
                    isRoundEnd ? "bg-amber-100 text-amber-700" :
                        "bg-purple-100 text-purple-700 cursor-pointer"
        }`}
              onClick={() => isFinished && setModalOpen(true)}
        >
          {isFinished ? "FINISHED (Review Final Leaderboard)" : game?.status}
        </span>
                {!isWaiting && !isFinished && (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
            Round {game?.currentRound} / {game?.totalRounds}
          </span>
                )}
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          👥 {game?.players?.length || 0} players
        </span>
            </div>

            {/* ─── WAITING SCREEN ──────────────────────────────────────────────── */}
            {isWaiting && (
                <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                    <p className="text-5xl mb-4">🎌</p>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        Anime Trivia Quiz
                    </h2>
                    <p className="text-gray-500 mb-6">
                        {game?.totalRounds} rounds • {game?.timeLimitSeconds}s per question • First correct gets bonus!
                    </p>

                    <div className="mb-6 flex flex-wrap justify-center gap-3">
                        {game?.players?.map((p, i) => (
                            <div
                                key={p}
                                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
                                    p === playerName?.trim()
                                        ? "bg-blue-50 text-blue-800 ring-1 ring-blue-200"
                                        : "bg-gray-50 text-gray-700"
                                }`}
                            >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-xs font-bold text-white">
                  {p.charAt(0).toUpperCase()}
                </span>
                                {p}
                                {i === 0 && <span className="text-xs text-amber-600">👑</span>}
                            </div>
                        ))}
                    </div>

                    {isHost ? (
                        <button
                            onClick={startGame}
                            disabled={!game?.players?.length}
                            className="rounded-xl bg-emerald-600 px-8 py-3 text-lg font-bold text-white shadow-lg hover:bg-emerald-700 disabled:opacity-40 cursor-pointer"
                        >
                            🚀 Start Quiz
                        </button>
                    ) : (
                        <p className="text-gray-400">Waiting for host to start...</p>
                    )}
                </div>
            )}

            {/* ─── PLAYING / ROUND_END SCREEN ──────────────────────────────────── */}
            {(isPlaying || isRoundEnd) && q && (
                <>
                    {isPlaying && (
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-600">
                  ⏱️ Time remaining
                </span>
                                <span className={`text-lg font-bold ${
                                    timeLeft <= 5 ? "text-rose-600 animate-pulse" : "text-gray-800"
                                }`}>
                  {timeLeft}s
                </span>
                            </div>
                            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                                <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                        timeLeft <= 5 ? "bg-rose-500" : "bg-emerald-500"
                                    }`}
                                    style={{ width: `${timerPct}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="mb-1 flex items-center gap-2">
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                {q.category}
              </span>
                            <span className="text-xs text-gray-400">
                Question {game?.currentRound} of {game?.totalRounds}
              </span>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mt-2">
                            {q.question}
                        </h2>
                    </div>

                    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {q.options?.map((opt, i) => {
                            let style = `${OPTION_COLORS[i].bg} text-white`;
                            let ring = "";

                            if (isRoundEnd) {
                                if (i === correctIdx) {
                                    style = "bg-emerald-600 text-white ring-4 ring-emerald-300";
                                } else if (myAnswer === i && i !== correctIdx) {
                                    style = "bg-rose-600 text-white ring-4 ring-rose-300";
                                } else {
                                    style = "bg-gray-300 text-gray-500";
                                }
                            } else if (isPlaying) {
                                if (myAnswer === i) {
                                    ring = `ring-4 ${OPTION_COLORS[i].ring}`;
                                }
                                if (hasAnswered) {
                                    style = myAnswer === i
                                        ? `${OPTION_COLORS[i].bg} text-white opacity-80`
                                        : "bg-gray-300 text-gray-500";
                                }
                            }

                            return (
                                <button
                                    key={i}
                                    onClick={() => submitAnswer(i)}
                                    disabled={isRoundEnd || hasAnswered || !isPlaying}
                                    className={`flex items-center gap-3 rounded-xl px-5 py-4 text-left text-base font-semibold shadow-sm transition-all ${style} ${ring} ${
                                        !hasAnswered && isPlaying ? "cursor-pointer hover:scale-[1.02]" : "cursor-default"
                                    }`}
                                >
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/20 text-sm font-bold">
                    {OPTION_LABELS[i]}
                  </span>
                                    <span className="flex-1">{opt}</span>
                                    {isRoundEnd && i === correctIdx && (
                                        <span className="text-xl">✅</span>
                                    )}
                                    {isRoundEnd && myAnswer === i && i !== correctIdx && (
                                        <span className="text-xl">❌</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {isRoundEnd && (
                        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                            <p className="text-sm font-semibold text-amber-800 mb-2">
                                🏁 Round {game?.currentRound} Results
                            </p>
                            <div className="space-y-1">
                                {game?.players?.map((p) => {
                                    const pts = game?.roundPoints?.[p] ?? 0;
                                    const correct = game?.playerCorrect?.[p];
                                    const isFirst = p === game?.firstCorrectPlayer;
                                    return (
                                        <div key={p} className="flex items-center gap-2 text-sm">
                      <span className={correct ? "text-emerald-600" : "text-rose-500"}>
                        {correct ? "✅" : "❌"}
                      </span>
                                            <span className="font-medium text-gray-800">{p}</span>
                                            <span className="text-gray-500">+{pts} pts</span>
                                            {isFirst && (
                                                <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-800">
                          ⚡ First!
                        </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="mt-2 text-xs text-amber-600">
                                Next round starting automatically...
                            </p>
                        </div>
                    )}

                    {isPlaying && !hasAnswered && (
                        <p className="text-center text-sm text-gray-500">
                            Pick your answer!
                        </p>
                    )}
                    {isPlaying && hasAnswered && (
                        <p className="text-center text-sm text-blue-600 font-medium">
                            ✅ Answer locked in! Waiting for others...
                            ({Object.keys(game?.playerAnswers || {}).length}/{game?.players?.length})
                        </p>
                    )}
                </>
            )}

            {/* ─── FINISHED SCREEN ─────────────────────────────────────────────── */}
            {isFinished && (
                <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                    <p className="text-5xl mb-4">🏆</p>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">Quiz Complete!</h2>
                    <p className="text-gray-500 mb-6">
                        Click any button below or click the upper-left status bubble to review final points.
                    </p>

                    <div className="mx-auto max-w-md space-y-2 mb-6">
                        {sortedLeaderboard.map((entry) => (
                            <div
                                key={entry.name}
                                className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                                    entry.rank === 1
                                        ? "bg-amber-50 ring-2 ring-amber-300"
                                        : "bg-gray-50"
                                }`}
                            >
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    entry.rank === 1 ? "bg-amber-400 text-white" : "bg-gray-200 text-gray-600"
                }`}>
                  {entry.rank === 1 ? "👑" : entry.rank}
                </span>
                                <span className="flex-1 text-left font-semibold text-gray-800">
                  {entry.name}
                </span>
                                <span className="text-lg font-bold text-indigo-700">
                  {entry.score}
                </span>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-2 max-w-md mx-auto">
                        <button
                            onClick={() => setModalOpen(true)}
                            className="rounded-xl bg-emerald-600 px-8 py-3 text-lg font-bold text-white shadow-md hover:bg-emerald-700 cursor-pointer"
                        >
                            📊 Show Game Summary
                        </button>
                        <button
                            onClick={resetGame}
                            className="rounded-xl bg-indigo-600 px-8 py-3 text-lg font-bold text-white shadow-md hover:bg-indigo-700 cursor-pointer"
                        >
                            🔄 Play Again
                        </button>
                    </div>
                </div>
            )}

            {/* ─── LIVE LEADERBOARD (during game) ──────────────────────────────── */}
            {!isWaiting && !isFinished && (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm mt-4">
                    <h2 className="mb-3 text-sm font-semibold text-gray-700">
                        📊 Live Leaderboard
                    </h2>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {sortedLeaderboard.map((entry) => (
                            <div
                                key={entry.name}
                                className={`rounded-lg px-3 py-2 text-center ${
                                    entry.name === playerName?.trim()
                                        ? "bg-blue-50 ring-1 ring-blue-200"
                                        : "bg-gray-50"
                                }`}
                            >
                                <p className="text-xs text-gray-400 truncate">{entry.name}</p>
                                <p className="text-lg font-bold text-indigo-700">{entry.score}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}