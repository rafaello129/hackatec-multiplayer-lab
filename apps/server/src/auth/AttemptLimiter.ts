export type AttemptLimitResult = {
    allowed: boolean;
    retryAfterMs: number;
};

type AttemptWindow = {
    count: number;
    resetAt: number;
};

export class AttemptLimiter {
    private readonly windows = new Map<string, AttemptWindow>();

    constructor(private readonly maximumKeys = 10_000) {}

    isBlocked(key: string, limit: number, now: number): AttemptLimitResult {
        const current = this.windows.get(key);
        if (!current || current.resetAt <= now) {
            return { allowed: true, retryAfterMs: 0 };
        }
        return {
            allowed: current.count < limit,
            retryAfterMs: current.count < limit ? 0 : Math.max(0, current.resetAt - now)
        };
    }

    consume(key: string, limit: number, windowMs: number, now: number): AttemptLimitResult {
        const current = this.windows.get(key);
        if (!current || current.resetAt <= now) {
            this.windows.set(key, { count: 1, resetAt: now + windowMs });
            this.prune(now);
            return { allowed: true, retryAfterMs: 0 };
        }
        if (current.count >= limit) {
            return { allowed: false, retryAfterMs: Math.max(0, current.resetAt - now) };
        }
        current.count += 1;
        this.windows.set(key, current);
        this.prune(now);
        return { allowed: true, retryAfterMs: 0 };
    }

    reset(key: string): void {
        this.windows.delete(key);
    }

    private prune(now: number): void {
        for (const [key, window] of this.windows) {
            if (window.resetAt <= now) this.windows.delete(key);
        }
        while (this.windows.size > this.maximumKeys) {
            const oldest = this.windows.keys().next().value as string | undefined;
            if (oldest === undefined) break;
            this.windows.delete(oldest);
        }
    }
}
