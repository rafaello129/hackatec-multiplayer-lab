import {
    COMBAT_BALANCE,
    STORM_BALANCE,
    type GameMapState,
    type PlayerState,
    type StormStatePayload
} from '@hackatec/shared';

type StormRuntime = {
    seed: number;
    phase: number;
    phaseStartedAt: number;
    closingAt: number;
    phaseEndsAt: number;
    centerX: number;
    centerY: number;
    radius: number;
    startCenterX: number;
    startCenterY: number;
    startRadius: number;
    targetCenterX: number;
    targetCenterY: number;
    targetRadius: number;
    completed: boolean;
};

export type StormStepResult = {
    state: StormStatePayload;
    damage: Array<{ playerId: string; amount: number }>;
};

const TARGET_RADII = [220, 180, 140, 105, STORM_BALANCE.minimumRadius] as const;

function randomFor(seed: number): () => number {
    let value = seed >>> 0;
    return () => {
        value = (value + 0x6D2B79F5) >>> 0;
        let t = value;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
    };
}

function lerp(from: number, to: number, amount: number): number {
    return from + (to - from) * amount;
}

export class StormManager {
    private readonly rooms = new Map<string, StormRuntime>();

    start(roomId: string, map: GameMapState, now: number): StormStatePayload {
        const centerX = map.width / 2;
        const centerY = (COMBAT_BALANCE.playableTop + COMBAT_BALANCE.playableBottom) / 2;
        const radius = Math.min(map.width / 2 - 40, (COMBAT_BALANCE.playableBottom - COMBAT_BALANCE.playableTop) / 2 - 20);
        const runtime: StormRuntime = {
            seed: map.seed >>> 0,
            phase: 1,
            phaseStartedAt: now,
            closingAt: now + STORM_BALANCE.waitMs,
            phaseEndsAt: now + STORM_BALANCE.waitMs + STORM_BALANCE.closeMs,
            centerX,
            centerY,
            radius,
            startCenterX: centerX,
            startCenterY: centerY,
            startRadius: radius,
            targetCenterX: centerX,
            targetCenterY: centerY,
            targetRadius: TARGET_RADII[0],
            completed: false
        };
        this.rooms.set(roomId, runtime);
        this.prepareTarget(runtime, map);
        return this.getState(roomId, now)!;
    }

    getState(roomId: string, now: number): StormStatePayload | undefined {
        const storm = this.rooms.get(roomId);
        if (!storm) return undefined;
        this.advancePhases(storm, now);
        const progress = storm.completed || now < storm.closingAt
            ? 0
            : Math.max(0, Math.min(1, (now - storm.closingAt) / STORM_BALANCE.closeMs));
        const centerX = lerp(storm.startCenterX, storm.targetCenterX, progress);
        const centerY = lerp(storm.startCenterY, storm.targetCenterY, progress);
        const radius = lerp(storm.startRadius, storm.targetRadius, progress);
        const dps = STORM_BALANCE.damagePerSecond[Math.min(storm.phase - 1, STORM_BALANCE.phases - 1)] ?? 20;
        return {
            roomId,
            phase: storm.phase,
            phaseCount: STORM_BALANCE.phases,
            centerX,
            centerY,
            radius,
            closesAt: storm.closingAt,
            nextPhaseAt: storm.phaseEndsAt,
            damagePerSecond: dps,
            closing: !storm.completed && now >= storm.closingAt,
            completed: storm.completed
        };
    }

    step(roomId: string, players: PlayerState[], map: GameMapState, dtMs: number, now: number): StormStepResult | undefined {
        const state = this.getState(roomId, now);
        if (!state) return undefined;
        const elapsed = Math.max(0, Math.min(dtMs, COMBAT_BALANCE.serverTickMs)) / 1_000;
        const damage = players
            .filter(player => player.alive !== false && !player.spectator)
            .filter(player => Math.hypot(player.x - state.centerX, player.y - state.centerY) > state.radius)
            .map(player => ({ playerId: player.id, amount: state.damagePerSecond * elapsed }));
        return { state, damage };
    }

    removeRoom(roomId: string): void {
        this.rooms.delete(roomId);
    }

    private advancePhases(storm: StormRuntime, now: number): void {
        while (!storm.completed && now >= storm.phaseEndsAt) {
            storm.centerX = storm.targetCenterX;
            storm.centerY = storm.targetCenterY;
            storm.radius = storm.targetRadius;
            if (storm.phase >= STORM_BALANCE.phases) {
                storm.completed = true;
                storm.startCenterX = storm.centerX;
                storm.startCenterY = storm.centerY;
                storm.startRadius = storm.radius;
                storm.targetCenterX = storm.centerX;
                storm.targetCenterY = storm.centerY;
                storm.targetRadius = storm.radius;
                storm.closingAt = storm.phaseEndsAt;
                return;
            }

            storm.phase += 1;
            storm.phaseStartedAt = storm.phaseEndsAt;
            storm.closingAt = storm.phaseStartedAt + STORM_BALANCE.waitMs;
            storm.phaseEndsAt = storm.closingAt + STORM_BALANCE.closeMs;
            storm.startCenterX = storm.centerX;
            storm.startCenterY = storm.centerY;
            storm.startRadius = storm.radius;
            this.chooseTarget(storm);
        }
    }

    private prepareTarget(storm: StormRuntime, map: GameMapState): void {
        this.chooseTarget(storm);
        const nextRadius = storm.targetRadius;
        const limitX = Math.max(nextRadius + 10, map.width - nextRadius - 10);
        const limitY = Math.max(nextRadius + COMBAT_BALANCE.playableTop,
            COMBAT_BALANCE.playableBottom - nextRadius);
        storm.targetCenterX = Math.max(nextRadius + 10, Math.min(limitX, storm.targetCenterX));
        storm.targetCenterY = Math.max(
            nextRadius + COMBAT_BALANCE.playableTop,
            Math.min(limitY, storm.targetCenterY)
        );
    }

    private chooseTarget(storm: StormRuntime): void {
        const nextRadius = TARGET_RADII[Math.min(storm.phase - 1, TARGET_RADII.length - 1)] ?? STORM_BALANCE.minimumRadius;
        const random = randomFor(storm.seed ^ Math.imul(storm.phase, 0x45d9f3b));
        const angle = random() * Math.PI * 2;
        const maximumShift = Math.max(0, storm.radius - nextRadius - 8);
        // Keep the next safe circle fully inside the current one.
        const distance = maximumShift * Math.sqrt(random()) * 0.8;
        storm.targetRadius = nextRadius;
        storm.targetCenterX = storm.centerX + Math.cos(angle) * distance;
        storm.targetCenterY = storm.centerY + Math.sin(angle) * distance;
    }
}
