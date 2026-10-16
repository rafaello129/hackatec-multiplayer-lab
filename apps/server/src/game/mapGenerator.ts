import type { GameMapState, MapObstacle, CactusSize, MapTrail } from '@hackatec/shared';
import { ARENA_HEIGHT, ARENA_WIDTH } from './constants.js';

export const MAP_GENERATION_CONFIG = {
    counts: { wall: 18, trap: 6, cactus: 30 },
    edgePadding: 42, topBoundary: 42, bottomBoundary: ARENA_HEIGHT - 42,
    obstacleGap: 8, spawnClearance: 48
} as const;

/** Authored combat pockets joined by a central crossing and an outer flanking loop. */
export function generateMap(seed: number): GameMapState {
    const normalizedSeed = (seed >>> 0) || 1;
    const obstacles: MapObstacle[] = [];
    const rocks = [
        [600,480,360,170], [930,375,210,110],
        [1610,420,380,160], [1920,600,160,250],
        [510,1100,330,180], [880,1200,240,110],
        [1550,1100,380,180], [1900,1020,200,130],
        [1010,650,120,65], [1290,650,140,75],
        [970,900,150,80], [1300,940,120,70],
        [720,750,110,60], [1600,760,120,64],
        [380,780,110,60], [2020,800,100,60],
        [1160,430,100,60], [1150,1120,110,60]
    ];
    for (const [index,[x,y,width,height]] of rocks.entries()) {
        obstacles.push({id:`wall-${index}`,type:'wall',x,y,width:width+(index<8 ? normalizedSeed%3*8 : 0),height});
    }
    for (const [index,[x,y]] of [[800,240],[1450,1300],[140,640],[2164,900],[1152,580],[1152,1040]].entries()) {
        obstacles.push({id:`trap-${index}`,type:'trap',x,y,width:68,height:26});
    }
    const sizes: CactusSize[] = ['small','large','medium'];
    const dimension = {small:30,medium:42,large:54}, damage = {small:5,medium:7,large:10};
    const clusters = [
        [[480,300],[540,300],[600,300]], [[1720,285],[1780,285],[1840,285]],
        [[430,1250],[490,1250],[550,1250]], [[1520,1250],[1580,1250],[1640,1250]],
        [[300,950],[245,1000],[300,1060]], [[2050,450],[2080,500],[2050,560]],
        // Interior groups keep vegetation visible along the crossing and its approaches.
        [[870,540],[930,540],[990,540]], [[1410,720],[1470,720],[1470,660]],
        [[780,990],[840,990],[900,1020]], [[1400,970],[1460,970],[1520,970]]
    ];
    for(const [group,points] of clusters.entries()) for(const [i,[x,y]] of points.entries()) {
        const size=sizes[i];
        obstacles.push({id:`cactus-${group*3+i}`,type:'cactus',x,y,size,width:dimension[size],height:dimension[size],damage:damage[size]});
    }
    const trail = (width:number, points:number[][]): MapTrail => ({width,points:points.map(([x,y])=>({x,y}))});
    return {seed:normalizedSeed,width:ARENA_WIDTH,height:ARENA_HEIGHT,obstacles,
        zones:[
            {id:'west',name:'GARGANTA OESTE',x:0,y:360,width:800,height:820},
            {id:'east',name:'CANTERA ESTE',x:1504,y:360,width:800,height:820},
            {id:'north',name:'PASO NORTE',x:0,y:0,width:2304,height:360},
            {id:'south',name:'JARDÍN DE ESPINAS',x:0,y:1180,width:2304,height:356},
            {id:'crossing',name:'CRUCE SECO',x:800,y:360,width:704,height:820}
        ],
        trails:[
            trail(120,[[140,240],[650,230],[1152,240],[1740,230],[2164,260]]),
            trail(120,[[140,1300],[700,1360],[1152,1330],[1750,1330],[2164,1280]]),
            trail(110,[[140,240],[180,600],[140,1000],[140,1300]]),
            trail(110,[[2164,260],[2150,650],[2164,1050],[2164,1280]]),
            trail(130,[[1152,130],[1260,450],[1152,768],[1210,1110],[1152,1406]]),
            trail(115,[[140,830],[650,830],[1152,800],[1700,870],[2164,880]]),
            trail(90,[[720,230],[800,600],[650,830],[730,1040],[700,1360]]),
            trail(90,[[1350,230],[1380,580],[1700,870],[1760,1050],[1750,1330]])
        ]};
}

export function createMapSeed(): number { return Math.floor(Math.random()*0xFFFFFFFF)>>>0; }
