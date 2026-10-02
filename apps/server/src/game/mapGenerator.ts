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
        wall: 8,
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

function getSpawnSafeZones(): Rectangle[]
{
    return Array.from({ length: MAX_PLAYERS_PER_ROOM }, (_, index) =>
    {
        const spawn = getSpawnPosition(index);

        return {
            x: spawn.x,
            y: spawn.y,
            width: MAP_GENERATION_CONFIG.spawnClearance * 2,
            height: MAP_GENERATION_CONFIG.spawnClearance * 2
        };
    });
}

function isInsidePlayableArea(rectangle: Rectangle): boolean
{
    const halfWidth = rectangle.width / 2;
    const halfHeight = rectangle.height / 2;

    return (
        rectangle.x - halfWidth >= MAP_GENERATION_CONFIG.edgePadding &&
        rectangle.x + halfWidth <= ARENA_WIDTH - MAP_GENERATION_CONFIG.edgePadding &&
        rectangle.y - halfHeight >= MAP_GENERATION_CONFIG.topBoundary &&
        rectangle.y + halfHeight <= MAP_GENERATION_CONFIG.bottomBoundary
    );
}

function blocksReservedCorridor(rectangle: Rectangle): boolean
{
    const verticalCorridor: Rectangle = {
        x: ARENA_WIDTH / 2,
        y: (MAP_GENERATION_CONFIG.topBoundary + MAP_GENERATION_CONFIG.bottomBoundary) / 2,
        width: 90,
        height: MAP_GENERATION_CONFIG.bottomBoundary - MAP_GENERATION_CONFIG.topBoundary
    };

    const horizontalCorridor: Rectangle = {
        x: ARENA_WIDTH / 2,
        y: 438,
        width: ARENA_WIDTH - (MAP_GENERATION_CONFIG.edgePadding * 2),
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
    random: () => number
): MapObstacle
{
    if (type === 'wall')
    {
        const horizontal = random() >= 0.5;
        const width = horizontal
            ? randomBetween(random, 100, 205)
            : randomBetween(random, 24, 34);
        const height = horizontal
            ? randomBetween(random, 24, 34)
            : randomBetween(random, 90, 160);

        return {
            id: 'wall-' + index,
            type,
            x: randomBetween(random, 70, ARENA_WIDTH - 70),
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
            x: randomBetween(random, 75, ARENA_WIDTH - 75),
            y: randomBetween(
                random,
                MAP_GENERATION_CONFIG.topBoundary + 40,
                MAP_GENERATION_CONFIG.bottomBoundary - 40
            ),
            width: randomBetween(random, 54, 76),
            height: randomBetween(random, 54, 76)
        };
    }

    const sizes: CactusSize[] = ['small', 'medium', 'large'];
    const size = sizes[randomBetween(random, 0, sizes.length - 1)];
    const config = CACTUS_CONFIG[size];

    const cactus: CactusObstacle = {
        id: 'cactus-' + index,
        type,
        x: randomBetween(random, 70, ARENA_WIDTH - 70),
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
    spawnSafeZones: Rectangle[]
): boolean
{
    if (!isInsidePlayableArea(obstacle))
    {
        return false;
    }

    if (blocksReservedCorridor(obstacle))
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
    spawnSafeZones: Rectangle[]
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
            const candidate = createCandidate(type, index, random);

            if (canPlace(candidate, target, spawnSafeZones))
            {
                target.push(candidate);
                break;
            }
        }
    }
}

export function generateMap(seed: number): GameMapState
{
    const normalizedSeed = (seed >>> 0) || 1;
    const random = seededRandom(normalizedSeed);
    const obstacles: MapObstacle[] = [];
    const spawnSafeZones = getSpawnSafeZones();

    addObstacles(
        obstacles,
        'wall',
        MAP_GENERATION_CONFIG.counts.wall,
        random,
        spawnSafeZones
    );
    addObstacles(
        obstacles,
        'trap',
        MAP_GENERATION_CONFIG.counts.trap,
        random,
        spawnSafeZones
    );
    addObstacles(
        obstacles,
        'cactus',
        MAP_GENERATION_CONFIG.counts.cactus,
        random,
        spawnSafeZones
    );

    return {
        seed: normalizedSeed,
        width: ARENA_WIDTH,
        height: ARENA_HEIGHT,
        obstacles
    };
}

export function createMapSeed(): number
{
    return Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
}
