"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";

// ─── Context ──────────────────────────────────────────────────────────────────
const ToastContext = createContext(null);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used within ToastProvider");
    return ctx;
}

// ─── Toast types ──────────────────────────────────────────────────────────────
const STYLES = {
    success: {
        bar:  "bg-emerald-500",
        icon: "✅",
        bg:   "bg-white border-emerald-200",
        text: "text-gray-900",
    },
    error: {
        bar:  "bg-rose-500",
        icon: "❌",
        bg:   "bg-white border-rose-200",
        text: "text-gray-900",
    },
    info: {
        bar:  "bg-blue-500",
        icon: "ℹ️",
        bg:   "bg-white border-blue-200",
        text: "text-gray-900",
    },
    warning: {
        bar:  "bg-amber-500",
        icon: "⚠️",
        bg:   "bg-white border-amber-200",
        text: "text-gray-900",
    },
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const counterRef = useRef(0);

    const dismiss = useCallback((id) => {
        setToasts((prev) =>
            prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
        );
        // Remove from DOM after animation
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 300);
    }, []);

    const toast = useCallback(
        (message, type = "info", duration = 3500) => {
            const id = `toast-${++counterRef.current}`;
            setToasts((prev) => [...prev, { id, message, type, leaving: false }]);

            if (duration > 0) {
                setTimeout(() => dismiss(id), duration);
            }

            return id;
        },
        [dismiss]
    );

    // Convenience methods
    const success = useCallback(
        (msg, dur) => toast(msg, "success", dur),
        [toast]
    );
    const error   = useCallback(
        (msg, dur) => toast(msg, "error", dur),
        [toast]
    );
    const info    = useCallback(
        (msg, dur) => toast(msg, "info", dur),
        [toast]
    );
    const warning = useCallback(
        (msg, dur) => toast(msg, "warning", dur),
        [toast]
    );

    return (
        <ToastContext.Provider value={{ toast, success, error, info, warning, dismiss }}>
            {children}

            {/* Toast container — fixed bottom-right */}
            <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2">
                {toasts.map((t) => (
                    <ToastItem
                        key={t.id}
                        toast={t}
                        onDismiss={() => dismiss(t.id)}
                    />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

// ─── Single toast item ────────────────────────────────────────────────────────
function ToastItem({ toast: t, onDismiss }) {
    const style = STYLES[t.type] || STYLES.info;

    return (
        <div
            className={`
        relative flex w-80 items-start gap-3 overflow-hidden
        rounded-xl border shadow-lg
        transition-all duration-300
        ${style.bg}
        ${t.leaving
                ? "translate-x-full opacity-0"
                : "translate-x-0 opacity-100"}
      `}
        >
            {/* Colored left bar */}
            <div className={`absolute left-0 top-0 h-full w-1 ${style.bar}`} />

            {/* Content */}
            <div className="flex flex-1 items-start gap-3 px-4 py-3 pl-5">
                <span className="mt-0.5 text-lg leading-none">{style.icon}</span>
                <p className={`flex-1 text-sm font-medium leading-snug ${style.text}`}>
                    {t.message}
                </p>
                <button
                    onClick={onDismiss}
                    className="ml-1 mt-0.5 flex-shrink-0 text-gray-400 hover:text-gray-600"
                >
                    ✕
                </button>
            </div>

            {/* Progress bar */}
            <ProgressBar color={style.bar} />
        </div>
    );
}

// ─── Auto-dismiss progress bar ────────────────────────────────────────────────
function ProgressBar({ color }) {
    const [width, setWidth] = useState(100);

    useEffect(() => {
        const start = Date.now();
        const duration = 3500;

        const tick = () => {
            const elapsed = Date.now() - start;
            const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
            setWidth(remaining);
            if (remaining > 0) requestAnimationFrame(tick);
        };

        const raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, []);

    return (
        <div className="absolute bottom-0 left-0 h-0.5 w-full bg-gray-100">
            <div
                className={`h-full ${color} transition-none`}
                style={{ width: `${width}%` }}
            />
        </div>
    );
}