import { ARENA_HEIGHT, ARENA_WIDTH } from './constants.js';

export type SpawnPosition = {
    x: number;
    y: number;
};

const COLUMNS = 8;
const HORIZONTAL_MARGIN = 100;
const TOP_MARGIN = 190;
const BOTTOM_MARGIN = 90;

export function getSpawnPosition(index: number): SpawnPosition
{
    const safeIndex = Math.max(0, Math.floor(index));
    const column = safeIndex % COLUMNS;
    const row = Math.floor(safeIndex / COLUMNS);

    const usableWidth = ARENA_WIDTH - (HORIZONTAL_MARGIN * 2);
    const usableHeight = ARENA_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN;

    const columnGap = usableWidth / Math.max(1, COLUMNS - 1);
    const rowCount = 4;
    const rowGap = usableHeight / Math.max(1, rowCount - 1);

    return {
        x: Math.round(HORIZONTAL_MARGIN + (column * columnGap)),
        y: Math.round(TOP_MARGIN + (Math.min(row, rowCount - 1) * rowGap))
    };
}
