/**
 * @ocular/pdf — Configuration
 *
 * Reads environment variables from process.env.
 * The consuming application (e.g., Next.js) is responsible for loading .env files.
 * 
 * For Next.js: put your env vars in apps/web/.env.local
 */

/**
 * Initialize backend configuration.
 * No-op — kept for backward compatibility.
 * Environment loading is now the app's responsibility.
 */
export function initBackendConfig(): void {
    // No-op: env vars should be loaded by the application (Next.js, etc.)
}

/**
 * Get a required config value. Throws if missing.
 */
export function getRequiredConfig(key: string): string {
    initBackendConfig();
    const value = process.env[key];
    if (!value) throw new Error(`Missing required config: ${key}`);
    return value;
}

/**
 * Get an optional config value with a default.
 */
export function getConfig(key: string, defaultValue = ""): string {
    initBackendConfig();
    return process.env[key] || defaultValue;
}
