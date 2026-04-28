/**
 * @ocular/pdf — Auth & Rate Limiting
 *
 * Server-side utilities for token validation and request rate limiting.
 * Config is loaded from packages/pdf/.env via initBackendConfig().
 */

import { initBackendConfig, getConfig } from "./config.js";

// Ensure backend .env is loaded before any env reads
initBackendConfig();

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Validate an access token against the configured DEMO_ACCESS_TOKEN.
 * Returns true if no token is configured (open access).
 */
export function validateToken(token: string | null | undefined): boolean {
    const expected = getConfig("DEMO_ACCESS_TOKEN", "");
    if (!expected) return true;
    return token === expected;
}

/**
 * Check if a client has exceeded their rate limit.
 * Rate limiting is disabled when ENABLE_RATE_LIMIT !== "true".
 */
export function checkRateLimit(clientId: string): { allowed: boolean; remaining: number } {
    const enabled = getConfig("ENABLE_RATE_LIMIT", "false") === "true";
    if (!enabled) return { allowed: true, remaining: 999 };

    const maxReqs = parseInt(getConfig("RATE_LIMIT_MAX_REQUESTS", "20"), 10);
    const windowMs = parseInt(getConfig("RATE_LIMIT_WINDOW_MS", "3600000"), 10);

    const now = Date.now();
    const entry = rateLimitMap.get(clientId);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(clientId, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: maxReqs - 1 };
    }

    if (entry.count >= maxReqs) {
        return { allowed: false, remaining: 0 };
    }

    entry.count++;
    return { allowed: true, remaining: maxReqs - entry.count };
}

/**
 * Derive a client identifier from a request (IP + token).
 */
export function getClientId(headers: Headers): string {
    const forwarded = headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";
    const token = headers.get("x-auth-token") || "";
    return `${ip}:${token}`;
}
