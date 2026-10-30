import { describe, expect, it } from 'vitest';
import { AttemptLimiter } from './AttemptLimiter.js';

describe('AttemptLimiter', () => {
    it('allows up to the limit and rejects attempts until the window expires', () => {
        const limiter = new AttemptLimiter();
        for (let index = 0; index < 3; index += 1) {
            expect(limiter.consume('ip', 3, 10_000, 1_000 + index).allowed).toBe(true);
        }
        expect(limiter.isBlocked('ip', 3, 1_004)).toMatchObject({
            allowed: false,
            retryAfterMs: 9_996
        });
        expect(limiter.consume('ip', 3, 10_000, 1_005).allowed).toBe(false);
        expect(limiter.consume('ip', 3, 10_000, 11_001).allowed).toBe(true);
    });

    it('keeps independent counters for each account and IP key', () => {
        const limiter = new AttemptLimiter();
        for (let index = 0; index < 2; index += 1) {
            limiter.consume('ip:alice', 2, 10_000, 1_000 + index);
        }
        expect(limiter.isBlocked('ip:alice', 2, 1_003).allowed).toBe(false);
        expect(limiter.isBlocked('ip:bob', 2, 1_003).allowed).toBe(true);
    });

    it('resets counters after a successful authentication', () => {
        const limiter = new AttemptLimiter();
        limiter.consume('ip', 1, 10_000, 1_000);
        expect(limiter.isBlocked('ip', 1, 1_001).allowed).toBe(false);
        limiter.reset('ip');
        expect(limiter.isBlocked('ip', 1, 1_002).allowed).toBe(true);
    });

    it('prunes expired keys and bounds memory', () => {
        const limiter = new AttemptLimiter(2);
        limiter.consume('a', 1, 100, 1_000);
        limiter.consume('b', 1, 100, 1_000);
        limiter.consume('c', 1, 100, 1_000);
        expect(limiter.isBlocked('a', 1, 1_001).allowed).toBe(true);
        expect(limiter.consume('fresh', 1, 100, 1_101).allowed).toBe(true);
        expect(limiter.isBlocked('b', 1, 1_102).allowed).toBe(true);
    });
});
