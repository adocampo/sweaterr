import { FlareSolverrClient } from './flaresolverr-client';
import { logger } from '../logger';

/**
 * Session info stored in memory
 */
interface SessionInfo {
    sessionId: string;
    forumId: string;
    host: string;
    createdAt: number;
    lastUsedAt: number;
    ttlMs: number; // TTL for this specific session
}

/**
 * Global FlareSolverr session manager
 * Maintains persistent sessions per forum that can be reused across multiple operations
 */
class FlareSolverrSessionManager {
    private sessions: Map<string, SessionInfo> = new Map(); // Key: forumId
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor() {
        // Start cleanup task every 5 minutes
        this.startCleanupTask();
    }

    /**
     * Get or create a session for a forum
     * @param forumId The forum ID
     * @param host The hostname
     * @param ttlMs TTL in milliseconds for this forum
     * @param fsClient FlareSolverr client instance
     * @returns Session ID to use
     */
    async getSession(
        forumId: string,
        host: string,
        ttlMs: number,
        fsClient: FlareSolverrClient
    ): Promise<string> {
        const now = Date.now();
        const existing = this.sessions.get(forumId);

        // Check if we have a valid session
        if (existing) {
            const age = now - existing.createdAt;
            if (age < ttlMs) {
                // Session still valid, update last used
                existing.lastUsedAt = now;
                existing.ttlMs = ttlMs; // Update TTL in case it changed
                logger.info('cloudflare', `[SessionMgr] Reusing session for ${host} (age: ${Math.round(age / 1000)}s / TTL: ${Math.round(ttlMs / 60000)}m)`);
                return existing.sessionId;
            } else {
                // Session expired, destroy it
                logger.info('cloudflare', `[SessionMgr] Session expired for ${host}, destroying...`);
                await this.destroySession(forumId, fsClient);
            }
        }

        // Create new session
        try {
            const sessionId = await fsClient.createSession();
            const now = Date.now();
            this.sessions.set(forumId, {
                sessionId,
                forumId,
                host,
                createdAt: now,
                lastUsedAt: now,
                ttlMs,
            });
            logger.info('cloudflare', `[SessionMgr] Created session for ${host} (TTL: ${Math.round(ttlMs / 60000)}m)`);
            return sessionId;
        } catch (err) {
            logger.error('cloudflare', `[SessionMgr] Failed to create session for ${host}: ${err}`);
            throw err;
        }
    }

    /**
     * Try to use existing session, fallback to creating new one if it fails
     * @param forumId The forum ID
     * @param host The hostname
     * @param ttlMs TTL in milliseconds
     * @param fsClient FlareSolverr client instance
     * @param operation Function that uses the session ID
     * @returns Result of the operation
     */
    async withSession<T>(
        forumId: string,
        host: string,
        ttlMs: number,
        fsClient: FlareSolverrClient,
        operation: (sessionId: string) => Promise<T>
    ): Promise<T> {
        let sessionId = await this.getSession(forumId, host, ttlMs, fsClient);

        try {
            return await operation(sessionId);
        } catch (err: any) {
            const errMsg = String(err?.message || '');
            const isSessionError = errMsg.includes('session') || errMsg.includes('Session');

            if (isSessionError) {
                // Session might be invalid, try recreating
                logger.warn('cloudflare', `[SessionMgr] Session error for ${host}, recreating...`);
                this.sessions.delete(forumId);
                sessionId = await this.getSession(forumId, host, ttlMs, fsClient);
                return await operation(sessionId);
            }

            // Not a session error, rethrow
            throw err;
        }
    }

    /**
     * Destroy session for a specific forum
     */
    async destroySession(forumId: string, fsClient: FlareSolverrClient): Promise<void> {
        const session = this.sessions.get(forumId);
        if (session) {
            try {
                await fsClient.destroySession(session.sessionId);
                logger.info('cloudflare', `[SessionMgr] Destroyed session for ${session.host}`);
            } catch (err) {
                logger.warn('cloudflare', `[SessionMgr] Failed to destroy session for ${session.host}: ${err}`);
            }
            this.sessions.delete(forumId);
        }
    }

    /**
     * Get session info for a specific forum (null if no active session)
     */
    getSessionInfo(forumId: string): {
        host: string;
        sessionId: string;
        ageMs: number;
        ttlMs: number;
        expiresInMs: number;
        isExpired: boolean;
    } | null {
        const session = this.sessions.get(forumId);
        if (!session) return null;

        const now = Date.now();
        const ageMs = now - session.createdAt;
        const expiresInMs = session.ttlMs - ageMs;

        return {
            host: session.host,
            sessionId: session.sessionId,
            ageMs,
            ttlMs: session.ttlMs,
            expiresInMs: Math.max(0, expiresInMs),
            isExpired: expiresInMs <= 0,
        };
    }

    /**
     * Get all active sessions info
     */
    getActiveSessions(): Array<{
        forumId: string;
        host: string;
        sessionId: string;
        ageMs: number;
        ttlMs: number;
        expiresInMs: number;
        isExpired: boolean;
    }> {
        const now = Date.now();
        return Array.from(this.sessions.values()).map((s) => {
            const ageMs = now - s.createdAt;
            const expiresInMs = s.ttlMs - ageMs;
            return {
                forumId: s.forumId,
                host: s.host,
                sessionId: s.sessionId,
                ageMs,
                ttlMs: s.ttlMs,
                expiresInMs: Math.max(0, expiresInMs),
                isExpired: expiresInMs <= 0,
            };
        });
    }

    /**
     * Start background cleanup task
     */
    private startCleanupTask() {
        if (this.cleanupInterval) return;

        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            const toDelete: string[] = [];

            for (const [forumId, session] of this.sessions.entries()) {
                const age = now - session.createdAt;
                if (age > session.ttlMs) {
                    toDelete.push(forumId);
                }
            }

            if (toDelete.length > 0) {
                logger.info('cloudflare', `[SessionMgr] Cleanup: removing ${toDelete.length} expired sessions`);
                for (const forumId of toDelete) {
                    this.sessions.delete(forumId);
                }
            }
        }, 5 * 60 * 1000); // Every 5 minutes
    }

    /**
     * Stop cleanup task
     */
    stopCleanupTask() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}

// Global singleton instance
export const sessionManager = new FlareSolverrSessionManager();
