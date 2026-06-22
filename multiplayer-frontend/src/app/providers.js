"use client";

import { SessionProvider } from "../context/SessionContext";

export default function Providers({ children }) {
  return <SessionProvider>{children}</SessionProvider>;
}
