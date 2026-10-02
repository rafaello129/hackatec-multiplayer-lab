import type {
    GameMapState,
    MapObstacle
} from '@hackatec/shared';
import { GameObjects, Scene } from 'phaser';

export class MapView
{
    private readonly graphics: GameObjects.Graphics;

    constructor(private readonly scene: Scene)
    {
        this.graphics = scene.add.graphics();
        this.graphics.setDepth(1);
    }

    render(map: GameMapState)
    {
        this.clear();

        for (const obstacle of map.obstacles)
        {
            this.drawObstacle(obstacle);
        }
    }

    clear()
    {
        this.graphics.clear();
    }

    destroy()
    {
        this.graphics.destroy();
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
        const left = obstacle.x - (obstacle.width / 2);
        const top = obstacle.y - (obstacle.height / 2);

        this.graphics.fillStyle(0x475569, 1);
        this.graphics.fillRect(left, top, obstacle.width, obstacle.height);
        this.graphics.lineStyle(2, 0x94a3b8, 0.9);
        this.graphics.strokeRect(left, top, obstacle.width, obstacle.height);
    }

    private drawTrap(obstacle: MapObstacle)
    {
        const left = obstacle.x - (obstacle.width / 2);
        const top = obstacle.y - (obstacle.height / 2);
        const right = left + obstacle.width;
        const bottom = top + obstacle.height;

        this.graphics.fillStyle(0x7c3aed, 0.26);
        this.graphics.fillRect(left, top, obstacle.width, obstacle.height);
        this.graphics.lineStyle(2, 0xa78bfa, 0.9);
        this.graphics.strokeRect(left, top, obstacle.width, obstacle.height);
        this.graphics.lineBetween(left, top, right, bottom);
        this.graphics.lineBetween(right, top, left, bottom);
    }

    private drawCactus(obstacle: MapObstacle)
    {
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
}
