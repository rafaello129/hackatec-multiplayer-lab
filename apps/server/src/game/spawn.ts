import { ARENA_HEIGHT, ARENA_WIDTH } from './constants.js';
export type SpawnPosition = { x:number; y:number };

/** Alternate distant edges; each pad has two exits into the outer trail. */
export function getSpawnPosition(index:number): SpawnPosition {
    const safeIndex=Math.min(31,Math.max(0,Math.floor(index)));
    const slot=Math.floor(safeIndex/4), edge=safeIndex%4;
    if(edge===0) return {x:220+slot*260,y:130};
    if(edge===1) return {x:ARENA_WIDTH-220-slot*260,y:ARENA_HEIGHT-130};
    return {x:edge===2 ? 140 : ARENA_WIDTH-140,y:edge===2 ? 300+slot*134 : ARENA_HEIGHT-300-slot*134};
}
