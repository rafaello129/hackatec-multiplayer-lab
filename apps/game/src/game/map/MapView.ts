import type {
    GameMapState,
    MapObstacle
} from '@hackatec/shared';
import { GameObjects, Scene } from 'phaser';
import { SPRITE_ATLAS, CANYON_TEXTURE } from '../assets';

export class MapView
{
    readonly container: GameObjects.Container;
    private readonly graphics: GameObjects.Graphics;
    private readonly terrain: GameObjects.Graphics;
    private readonly sprites: GameObjects.Image[] = [];

    constructor(private readonly scene: Scene)
    {
        this.graphics = scene.add.graphics();
        this.graphics.setDepth(0);
        this.terrain = scene.add.graphics().setDepth(-2);
        this.container = scene.add.container(0,0,[this.terrain,this.graphics]);
    }

    render(map: GameMapState)
    {
        this.clear();
        this.drawTerrain(map);

        for (const obstacle of map.obstacles)
        {
            this.drawObstacle(obstacle);
        }
    }

    clear()
    {
        this.sprites.splice(0).forEach(sprite => sprite.destroy());
        this.graphics.clear();
        this.terrain.clear();
    }

    destroy()
    {
        this.clear();
        this.graphics.destroy();
        this.terrain.destroy();
        this.container.destroy();
    }

    private drawObstacle(obstacle: MapObstacle)
    {
        if (obstacle.type === 'wall')
        {
            this.drawWall(obstacle);
            return;
        }

        if (obstacle.type === 'trap')
        {
            this.drawTrap(obstacle);
            return;
        }

        this.drawCactus(obstacle);
    }

    private drawWall(obstacle: MapObstacle)
    {
        if (this.scene.textures.exists(CANYON_TEXTURE) && this.scene.textures.get(CANYON_TEXTURE).has('rock')) {
            const rock = this.scene.add.image(obstacle.x, obstacle.y, CANYON_TEXTURE, 'rock')
                .setDisplaySize(obstacle.width, obstacle.height).setDepth(0);
            rock.setFlipX(Number(obstacle.id.split('-').at(-1)) % 2 === 0);
            this.sprites.push(rock);
            this.container.add(rock);
            return;
        }
        const left = obstacle.x - (obstacle.width / 2);
        const top = obstacle.y - (obstacle.height / 2);
        // Rock faces fill the authoritative wall bounds; strata describe their height.
        this.graphics.fillStyle(0x684438, 0.3);
        this.graphics.fillRect(left + 7, top + 8, obstacle.width, obstacle.height);
        this.graphics.fillStyle(0x754532, 1);
        this.graphics.fillRect(left, top, obstacle.width, obstacle.height);
        this.graphics.fillStyle(0xa65f3d).fillRect(left, top, obstacle.width, obstacle.height - 10);
        this.graphics.fillStyle(0xc17c4b).fillRect(left + 4, top + 3, obstacle.width - 8, obstacle.height - 24);
        this.graphics.fillStyle(0xd59860).fillRect(left + 10, top + 6, obstacle.width - 20, Math.max(8, obstacle.height - 36));
        this.graphics.lineStyle(2, 0xe4ae73, 0.7).lineBetween(left + 8, top + 5, left + obstacle.width - 9, top + 5);
        this.graphics.lineStyle(2, 0x87472f, 0.6);
        for (let x = left + 24; x < left + obstacle.width - 12; x += 40) {
            this.graphics.lineBetween(x, top + obstacle.height - 10, x + 5, top + obstacle.height - 19);
        }
    }

    private drawTrap(obstacle: MapObstacle)
    {
        const left = obstacle.x - (obstacle.width / 2);
        const top = obstacle.y - (obstacle.height / 2);
        const right = left + obstacle.width;
        const bottom = top + obstacle.height;

        this.graphics.fillStyle(0x8c5030, 0.12);
        this.graphics.fillRect(left, top, obstacle.width, obstacle.height);
        this.graphics.lineStyle(1, 0x805333, 0.55);
        this.graphics.strokeRect(left, top, obstacle.width, obstacle.height);
        if (this.drawSprite(obstacle, 'rope-fence')) return;
        this.graphics.lineBetween(left, top, right, bottom);
        this.graphics.lineBetween(right, top, left, bottom);
    }

    private drawCactus(obstacle: MapObstacle)
    {
        if (this.drawSprite(obstacle, 'cactus', true)) return;
        const radius = Math.max(obstacle.width, obstacle.height) / 2;

        this.graphics.fillStyle(0x15803d, 0.92);
        this.graphics.fillCircle(obstacle.x, obstacle.y, radius * 0.62);
        this.graphics.fillRect(
            obstacle.x - (radius * 0.19),
            obstacle.y - radius,
            radius * 0.38,
            radius * 2
        );
        this.graphics.fillRect(
            obstacle.x - (radius * 0.72),
            obstacle.y - (radius * 0.18),
            radius * 1.44,
            radius * 0.36
        );
        this.graphics.lineStyle(2, 0x86efac, 0.85);
        this.graphics.strokeCircle(obstacle.x, obstacle.y, radius * 0.62);
    }

    private drawSprite(obstacle: MapObstacle, frame: string, contain = false): boolean {
        if (!this.scene.textures.exists(SPRITE_ATLAS) || !this.scene.textures.get(SPRITE_ATLAS).has(frame)) return false;
        const sprite = this.scene.add.image(obstacle.x, obstacle.y, SPRITE_ATLAS, frame).setDepth(0);
        if (contain) {
            const scale = Math.min(obstacle.width / sprite.width, obstacle.height / sprite.height);
            sprite.setScale(scale);
            // Keep the authoritative damaging area visible around narrow cactus art.
            this.graphics.fillStyle(0x425339, 0.17);
            this.graphics.fillEllipse(obstacle.x, obstacle.y + obstacle.height * 0.3, obstacle.width, obstacle.height * 0.45);
        } else if (obstacle.type === 'wall' && obstacle.height > obstacle.width) {
            sprite.setDisplaySize(obstacle.height, obstacle.width).setAngle(90);
        } else sprite.setDisplaySize(obstacle.width, obstacle.height);
        this.sprites.push(sprite);
        this.container.add(sprite);
        return true;
    }

    private drawTerrain(map: GameMapState): void {
        const g=this.terrain;
        g.fillStyle(0xb88958).fillRect(0,0,map.width,map.height);
        for(const trail of map.trails ?? []) {
            // Two soft shoulders keep trails legible without looking like corridors.
            for(const [extra,alpha] of [[30,0.2],[14,0.35],[0,1]]) {
                g.lineStyle(trail.width+extra,0xd3b47e,alpha);
                g.beginPath();
                trail.points.forEach((point,index)=>index===0 ? g.moveTo(point.x,point.y) : g.lineTo(point.x,point.y));
                g.strokePath();
                for(const point of trail.points) g.fillStyle(0xd3b47e,alpha).fillCircle(point.x,point.y,(trail.width+extra)/2);
            }
        }
        for(let i=0;i<6500;i++) {
            const x=(i*137+i*i*3+map.seed%97)%map.width;
            const y=(i*79+i*i*7)%map.height;
            g.fillStyle(i%3===0 ? 0x795132 : 0xf3d69b,0.18).fillRect(x,y,i%4+1,2);
        }
        g.lineStyle(1,0xf3d69b,0.22);
        for(let i=0;i<240;i++) {
            const x=24+(i*173)%(map.width-48),y=24+(i*67)%(map.height-48);
            g.lineBetween(x,y,x+12+i%14,y);
        }
        g.lineStyle(6,0x845b3f,0.7).strokeRect(3,3,map.width-6,map.height-6);
    }
}
