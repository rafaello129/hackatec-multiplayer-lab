import { describe, expect, it } from 'vitest';
import { generateMap } from './mapGenerator.js';
import { advanceMovement, createMovementRuntime, acceptMovementInput } from './movement.js';
import { CombatManager } from './CombatManager.js';
import type { PlayerState } from '@hackatec/shared';

const pilot = (x:number,y:number): PlayerState => ({id:'pilot',name:'Pilot',x,y,color:0xffffff,hp:100,alive:true});
describe('world dimensions independent of the HUD',()=>{
    it('allows movement beyond the old viewport and stops at the actual world edges',()=>{
        const map=generateMap(1); map.obstacles=[];
        const player=pilot(1800,1200), runtime=createMovementRuntime();
        acceptMovementInput(runtime,{up:false,down:true,left:false,right:true,dash:false},100,player);
        advanceMovement(player,runtime,map,50,100);
        expect(player.x).toBeGreaterThan(1800); expect(player.y).toBeGreaterThan(1200);
        player.x=map.width-21;player.y=map.height-21;
        advanceMovement(player,runtime,map,50,100);
        expect(player.x).toBe(map.width-21);expect(player.y).toBe(map.height-21);
        player.x=21;player.y=21;
        acceptMovementInput(runtime,{up:true,down:false,left:true,right:false,dash:false},150,player);
        advanceMovement(player,runtime,map,50,150);
        expect(player.x).toBe(21);expect(player.y).toBe(21);
    });
    it('keeps shots active below the old screen edge and removes them at world bounds',()=>{
        const map=generateMap(1);map.obstacles=[];
        const combat=new CombatManager(), player=pilot(1800,1200);
        combat.shoot('world',player,{weapon:'pistol',angle:Math.PI/2},0);
        const shots=combat.step('world',[player],map,50,50);
        expect(shots).toHaveLength(1);expect(shots[0].y).toBeGreaterThan(1200);
        for(let t=100;t<=1000;t+=50) combat.step('world',[player],map,50,t);
        expect(combat.step('world',[player],map,50,1050)).toHaveLength(0);
    });
});
