import { ARENA_HEIGHT, ARENA_WIDTH } from './constants.js';

export type SpawnPosition = {
    x: number;
    y: number;
};

const COLUMNS = 8;
const HORIZONTAL_MARGIN = 100;
const TOP_MARGIN = 190;
const BOTTOM_MARGIN = 90;

const ROW_COUNT = 4;

function createSpawnOrder(arenaWidth: number, arenaHeight: number): number[]
{
    const usableWidth = arenaWidth - (HORIZONTAL_MARGIN * 2);
    const usableHeight = arenaHeight - TOP_MARGIN - BOTTOM_MARGIN;
    const columnGap = usableWidth / Math.max(1, COLUMNS - 1);
    const rowGap = usableHeight / Math.max(1, ROW_COUNT - 1);
    const positions = Array.from({ length: COLUMNS * ROW_COUNT }, (_, index) => ({
        index,
        x: HORIZONTAL_MARGIN + (index % COLUMNS) * columnGap,
        y: TOP_MARGIN + Math.floor(index / COLUMNS) * rowGap
    }));
    const order: number[] = [];
    const selected = new Set<number>();

    // Farthest-point sampling spreads the first arrivals across the whole arena
    // instead of placing consecutive players next to each other in one row.
    while (order.length < positions.length)
    {
        let bestIndex = -1;
        let bestDistance = -1;

        for (const candidate of positions)
        {
            if (selected.has(candidate.index)) continue;
            const nearestDistance = order.length === 0
                ? (candidate.index === 0 ? Number.POSITIVE_INFINITY : -1)
                : Math.min(...order.map(selectedIndex => {
                    const selectedPosition = positions[selectedIndex]!;
                    return Math.hypot(candidate.x - selectedPosition.x, candidate.y - selectedPosition.y);
                }));

            if (nearestDistance > bestDistance)
            {
                bestDistance = nearestDistance;
                bestIndex = candidate.index;
            }
        }

        if (bestIndex < 0) break;
        selected.add(bestIndex);
        order.push(bestIndex);
    }

    return order;
}

export function getSpawnPosition(index: number, arenaWidth = ARENA_WIDTH, arenaHeight = ARENA_HEIGHT): SpawnPosition
{
    const safeIndex = Math.max(0, Math.floor(index));
    const spawnOrder = createSpawnOrder(arenaWidth, arenaHeight);
    const gridIndex = spawnOrder[Math.min(safeIndex, spawnOrder.length - 1)] ?? 0;
    const column = gridIndex % COLUMNS;
    const row = Math.floor(gridIndex / COLUMNS);
    const usableWidth = arenaWidth - (HORIZONTAL_MARGIN * 2);
    const usableHeight = arenaHeight - TOP_MARGIN - BOTTOM_MARGIN;
    const columnGap = usableWidth / Math.max(1, COLUMNS - 1);
    const rowGap = usableHeight / Math.max(1, ROW_COUNT - 1);

    return {
        x: Math.round(HORIZONTAL_MARGIN + (column * columnGap)),
        y: Math.round(TOP_MARGIN + (row * rowGap))
    };
}
