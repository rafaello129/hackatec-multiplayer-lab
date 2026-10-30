import type {
    CactusObstacle,
    CactusSize,
    GameMapState,
    MapObstacle,
    MapObstacleType
} from '@hackatec/shared';
import {
    ARENA_HEIGHT,
    ARENA_WIDTH,
    MAX_PLAYERS_PER_ROOM
} from './constants.js';
import { getSpawnPosition } from './spawn.js';

type Rectangle = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export const MAP_GENERATION_CONFIG = {
    counts: {
        fence: 8,
        rock: 10,
        lake: 2,
        trap: 4,
        cactus: 6
    },
    edgePadding: 42,
    topBoundary: 155,
    bottomBoundary: 715,
    obstacleGap: 18,
    spawnClearance: 58,
    maxPlacementAttempts: 120
} as const;

const CACTUS_CONFIG: Record<CactusSize, { size: number; damage: number }> = {
    small: { size: 30, damage: 5 },
    medium: { size: 42, damage: 7 },
    large: { size: 54, damage: 10 }
};

function seededRandom(seed: number): () => number
{
    let state = seed >>> 0;

    return () =>
    {
        state += 0x6D2B79F5;
        let value = state;

        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function randomBetween(
    random: () => number,
    minimum: number,
    maximum: number
): number
{
    return minimum + Math.floor(random() * ((maximum - minimum) + 1));
}

function intersects(
    first: Rectangle,
    second: Rectangle,
    padding = 0
): boolean
{
    return (
        Math.abs(first.x - second.x) * 2 <
            first.width + second.width + (padding * 2) &&
        Math.abs(first.y - second.y) * 2 <
            first.height + second.height + (padding * 2)
    );
}

function getSpawnSafeZones(width: number): Rectangle[]
{
    return Array.from({ length: MAX_PLAYERS_PER_ROOM }, (_, index) =>
    {
        const spawn = getSpawnPosition(index, width);

        return {
            x: spawn.x,
            y: spawn.y,
            width: MAP_GENERATION_CONFIG.spawnClearance * 2,
            height: MAP_GENERATION_CONFIG.spawnClearance * 2
        };
    });
}

function isInsidePlayableArea(rectangle: Rectangle, width: number): boolean
{
    const halfWidth = rectangle.width / 2;
    const halfHeight = rectangle.height / 2;

    return (
        rectangle.x - halfWidth >= MAP_GENERATION_CONFIG.edgePadding &&
        rectangle.x + halfWidth <= width - MAP_GENERATION_CONFIG.edgePadding &&
        rectangle.y - halfHeight >= MAP_GENERATION_CONFIG.topBoundary &&
        rectangle.y + halfHeight <= MAP_GENERATION_CONFIG.bottomBoundary
    );
}

function blocksReservedCorridor(rectangle: Rectangle, width: number): boolean
{
    const verticalCorridor: Rectangle = {
        x: width / 2,
        y: (MAP_GENERATION_CONFIG.topBoundary + MAP_GENERATION_CONFIG.bottomBoundary) / 2,
        width: 90,
        height: MAP_GENERATION_CONFIG.bottomBoundary - MAP_GENERATION_CONFIG.topBoundary
    };

    const horizontalCorridor: Rectangle = {
        x: width / 2,
        y: 438,
        width: width - (MAP_GENERATION_CONFIG.edgePadding * 2),
        height: 74
    };

    return (
        intersects(rectangle, verticalCorridor) ||
        intersects(rectangle, horizontalCorridor)
    );
}

function createCandidate(
    type: MapObstacleType,
    index: number,
    random: () => number,
    width: number
): MapObstacle
{
    if (type === 'wall' || type === 'fence')
    {
        const horizontal = random() >= 0.5;
        const width = horizontal
            ? randomBetween(random, 100, 205)
            : randomBetween(random, 24, 34);
        const height = horizontal
            ? randomBetween(random, 24, 34)
            : randomBetween(random, 90, 160);

        return {
            id: 'fence-' + index,
            type: 'fence',
            x: randomBetween(random, 70, width - 70),
            y: randomBetween(
                random,
                MAP_GENERATION_CONFIG.topBoundary + 30,
                MAP_GENERATION_CONFIG.bottomBoundary - 30
            ),
            width,
            height
        };
    }

    if (type === 'trap')
    {
        return {
            id: 'trap-' + index,
            type,
            x: randomBetween(random, 75, width - 75),
            y: randomBetween(
                random,
                MAP_GENERATION_CONFIG.topBoundary + 40,
                MAP_GENERATION_CONFIG.bottomBoundary - 40
            ),
            width: randomBetween(random, 54, 76),
            height: randomBetween(random, 54, 76)
        };
    }

    if (type === 'rock' || type === 'lake') {
        const lake = type === 'lake';
        return {
            id: type + '-' + index,
            type,
            x: randomBetween(random, 70, width - 70),
            y: randomBetween(random, MAP_GENERATION_CONFIG.topBoundary + 45, MAP_GENERATION_CONFIG.bottomBoundary - 45),
            width: lake ? randomBetween(random, 130, 220) : randomBetween(random, 58, 104),
            height: lake ? randomBetween(random, 90, 160) : randomBetween(random, 48, 86)
        };
    }

    const sizes: CactusSize[] = ['small', 'medium', 'large'];
    const size = sizes[randomBetween(random, 0, sizes.length - 1)];
    const config = CACTUS_CONFIG[size];

    const cactus: CactusObstacle = {
        id: 'cactus-' + index,
        type,
        x: randomBetween(random, 70, width - 70),
        y: randomBetween(
            random,
            MAP_GENERATION_CONFIG.topBoundary + 35,
            MAP_GENERATION_CONFIG.bottomBoundary - 35
        ),
        width: config.size,
        height: config.size,
        size,
        damage: config.damage
    };

    return cactus;
}

function canPlace(
    obstacle: MapObstacle,
    existing: MapObstacle[],
    spawnSafeZones: Rectangle[],
    width: number
): boolean
{
    if (!isInsidePlayableArea(obstacle, width))
    {
        return false;
    }

    if (blocksReservedCorridor(obstacle, width))
    {
        return false;
    }

    if (
        existing.some((item) =>
            intersects(item, obstacle, MAP_GENERATION_CONFIG.obstacleGap)
        )
    )
    {
        return false;
    }

    return !spawnSafeZones.some((zone) => intersects(zone, obstacle));
}

function addObstacles(
    target: MapObstacle[],
    type: MapObstacleType,
    count: number,
    random: () => number,
    spawnSafeZones: Rectangle[],
    width: number
)
{
    for (let index = 0; index < count; index += 1)
    {
        for (
            let attempt = 0;
            attempt < MAP_GENERATION_CONFIG.maxPlacementAttempts;
            attempt += 1
        )
        {
            const candidate = createCandidate(type, index, random, width);

            if (canPlace(candidate, target, spawnSafeZones, width))
            {
                target.push(candidate);
                break;
            }
        }
    }
}

export function generateMap(seed: number, playerCount = 2, mode: string | null = 'classic'): GameMapState
{
    const normalizedSeed = (seed >>> 0) || 1;
    const random = seededRandom(normalizedSeed);
    const obstacles: MapObstacle[] = [];
    const width = Math.min(2_560, 1_024 + Math.max(0, playerCount - 2) * 48 + (mode === 'battleRoyale' ? 512 : 0));
    const spawnSafeZones = getSpawnSafeZones(width);

    addObstacles(
        obstacles,
        'fence',
        MAP_GENERATION_CONFIG.counts.fence,
        random,
        spawnSafeZones,
        width
    );
    addObstacles(obstacles, 'rock', MAP_GENERATION_CONFIG.counts.rock, random, spawnSafeZones, width);
    addObstacles(obstacles, 'lake', MAP_GENERATION_CONFIG.counts.lake, random, spawnSafeZones, width);
    addObstacles(
        obstacles,
        'trap',
        MAP_GENERATION_CONFIG.counts.trap,
        random,
        spawnSafeZones,
        width
    );
    addObstacles(
        obstacles,
        'cactus',
        MAP_GENERATION_CONFIG.counts.cactus,
        random,
        spawnSafeZones,
        width
    );

    return {
        seed: normalizedSeed,
        width,
        height: ARENA_HEIGHT,
        obstacles
    };
}

export function createMapSeed(): number
{
    return Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
}
