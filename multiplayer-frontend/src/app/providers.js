"use client";

import { SessionProvider } from "@/context/SessionContext";
import { ToastProvider } from "@/components/ToastProvider";

export default function Providers({ children }) {
  return (
      <SessionProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </SessionProvider>
  );
}