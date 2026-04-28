"use client";

import { useState, useEffect } from "react";
import { Lock, Loader2 } from "lucide-react";
import { useAppStore } from "@/lib/store";

export default function AuthGate({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, setAuthenticated } = useAppStore();
    const [token, setToken] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [checking, setChecking] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Check localStorage after mount to avoid hydration mismatch
    useEffect(() => {
        const stored = localStorage.getItem("ocular_token");
        if (stored) setAuthenticated(true);
        setMounted(true);
    }, [setAuthenticated]);

    const handleLogin = async () => {
        if (!token.trim()) return;
        setChecking(true);
        setError(null);

        try {
            const res = await fetch("/api/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: token.trim() }),
            });
            const data = await res.json();

            if (data.valid) {
                localStorage.setItem("ocular_token", token.trim());
                setAuthenticated(true);
            } else {
                setError("Invalid access token");
            }
        } catch {
            setError("Connection failed");
        }
        setChecking(false);
    };

    if (isAuthenticated) return <>{children}</>;

    return (
        <div className="h-full flex items-center justify-center bg-[var(--bg-primary)]">
            <div className="glass rounded-2xl p-8 max-w-sm w-full mx-4">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-[var(--accent-glow)] flex items-center justify-center">
                        <Lock className="w-6 h-6 text-[var(--accent)]" />
                    </div>
                    <div className="text-center">
                        <h2 className="font-semibold text-lg">Ocular</h2>
                        <p className="text-sm text-[var(--text-muted)] mt-1">Enter the access token to continue</p>
                    </div>

                    <input
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                        placeholder="Access token"
                        className="w-full px-4 py-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-sm outline-none focus:border-[var(--accent)] transition-colors"
                    />

                    {error && <p className="text-xs text-[var(--error)]">{error}</p>}

                    <button
                        onClick={handleLogin}
                        disabled={!token.trim() || checking}
                        className="w-full py-3 rounded-xl bg-[var(--accent)] text-white font-medium text-sm hover:brightness-110 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                    >
                        {checking && <Loader2 className="w-4 h-4 animate-spin" />}
                        {checking ? "Verifying..." : "Enter"}
                    </button>
                </div>
            </div>
        </div>
    );
}
