import type {
    GameMapState,
    MapObstacle
} from '@hackatec/shared';
import { GameObjects, Scene } from 'phaser';

const ARENA = { x: 32, y: 128, width: 960, height: 600 } as const;
const GROUND_TEXTURE = 'hackatec-desert-ground';

function seededRandom(seed: number): () => number
{
    let state = seed >>> 0;

    return () =>
    {
        state = (state + 0x6D2B79F5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

export class MapView
{
    private readonly ground: GameObjects.TileSprite;
    private readonly graphics: GameObjects.Graphics;
    private mapWidth = 1_024;

    constructor(private readonly scene: Scene)
    {
        this.createGroundTexture();

        this.ground = scene.add.tileSprite(
            ARENA.x + ARENA.width / 2,
            ARENA.y + ARENA.height / 2,
            mapWidth - ARENA.x * 2,
            ARENA.height,
            GROUND_TEXTURE
        ).setDepth(-2);

        this.graphics = scene.add.graphics().setDepth(0);
    }

    render(map: GameMapState): void
    {
        this.graphics.clear();
        this.mapWidth = map.width;
        this.ground.setPosition(ARENA.x + (map.width - ARENA.x * 2) / 2, ARENA.y + ARENA.height / 2)
            .setSize(map.width - ARENA.x * 2, ARENA.height);
        this.drawGroundDetails(map.seed, map.obstacles, map.width);

        for (const obstacle of map.obstacles)
        {
            this.drawObstacle(obstacle);
        }

        this.drawArenaEdge(map.width);
    }

    clear(): void
    {
        this.graphics.clear();
    }

    destroy(): void
    {
        this.ground.destroy();
        this.graphics.destroy();
    }

    private createGroundTexture(): void
    {
        if (this.scene.textures.exists(GROUND_TEXTURE))
        {
            return;
        }

        const tile = this.scene.make.graphics({ x: 0, y: 0 });
        tile.fillStyle(0xc99a59, 1);
        tile.fillRect(0, 0, 128, 128);

        const random = seededRandom(0xD35E47);
        for (let index = 0; index < 190; index += 1)
        {
            const x = random() * 128;
            const y = random() * 128;
            const radius = 0.7 + random() * 2.1;
            const color = random() > 0.52 ? 0xe4bd7d : 0xa97843;
            tile.fillStyle(color, 0.22 + random() * 0.28);
            tile.fillCircle(x, y, radius);
        }

        for (let index = 0; index < 11; index += 1)
        {
            const x = random() * 128;
            const y = random() * 128;
            tile.lineStyle(1, 0x8e633b, 0.2);
            tile.lineBetween(x, y, x + 3 + random() * 8, y + 1 + random() * 4);
        }

        tile.generateTexture(GROUND_TEXTURE, 128, 128);
        tile.destroy();
    }

    private drawArenaEdge(mapWidth: number): void
    {
        this.graphics.lineStyle(5, 0x8a5a32, 0.9);
        this.graphics.strokeRoundedRect(
            ARENA.x,
            ARENA.y,
            ARENA.width,
            ARENA.height,
            10
        );
        this.graphics.lineStyle(2, 0xf1d19a, 0.72);
        this.graphics.strokeRoundedRect(
            ARENA.x + 5,
            ARENA.y + 5,
            mapWidth - ARENA.x * 2 - 10,
            ARENA.height - 10,
            8
        );
    }

    private drawGroundDetails(seed: number, obstacles: MapObstacle[], mapWidth: number): void
    {
        const random = seededRandom(seed ^ 0x51A7D00D);
        let placed = 0;
        let attempts = 0;

        // Small stones and dry scrub make the sand feel like a continuous terrain.
        while (placed < 34 && attempts < 180)
        {
            attempts += 1;
            const x = ARENA.x + 24 + random() * (mapWidth - ARENA.x * 2 - 48);
            const y = ARENA.y + 24 + random() * (ARENA.height - 48);
            const radius = 3 + random() * 5;

            const overlapsObstacle = obstacles.some((obstacle) =>
            {
                const halfWidth = obstacle.width / 2 + radius + 10;
                const halfHeight = obstacle.height / 2 + radius + 10;
                return Math.abs(x - obstacle.x) < halfWidth &&
                    Math.abs(y - obstacle.y) < halfHeight;
            });

            if (overlapsObstacle)
            {
                continue;
            }

            this.drawRock(x, y, radius);
            placed += 1;
        }

        // Sparse dry grass tufts, kept subtle so they do not compete with players.
        for (let index = 0; index < 22; index += 1)
        {
            const x = ARENA.x + 20 + random() * (mapWidth - ARENA.x * 2 - 40);
            const y = ARENA.y + 20 + random() * (ARENA.height - 40);
            const nearObstacle = obstacles.some((obstacle) =>
                Math.abs(x - obstacle.x) < obstacle.width / 2 + 18 &&
                Math.abs(y - obstacle.y) < obstacle.height / 2 + 18
            );

            if (nearObstacle) continue;

            this.graphics.lineStyle(2, 0x7b713b, 0.78);
            this.graphics.lineBetween(x, y + 5, x - 3, y - 3);
            this.graphics.lineBetween(x, y + 5, x + 2, y - 5);
            this.graphics.lineBetween(x, y + 5, x + 6, y - 1);
        }
    }

    private drawRock(x: number, y: number, radius: number): void
    {
        this.graphics.fillStyle(0x805b3d, 0.3);
        this.graphics.fillEllipse(x + 2, y + 4, radius * 2.8, radius * 1.8);
        this.graphics.fillStyle(0x8f8878, 1);
        this.graphics.fillCircle(x, y, radius);
        this.graphics.fillStyle(0xb8aa91, 0.9);
        this.graphics.fillCircle(x - radius * 0.28, y - radius * 0.28, radius * 0.48);
        this.graphics.fillStyle(0x625d53, 0.72);
        this.graphics.fillCircle(x + radius * 0.35, y + radius * 0.24, radius * 0.38);
    }

    private drawObstacle(obstacle: MapObstacle): void
    {
        if (obstacle.type === 'wall' || obstacle.type === 'fence')
        {
            this.drawFence(obstacle);
            return;
        }

        if (obstacle.type === 'rock') {
            this.drawLargeRock(obstacle);
            return;
        }
        if (obstacle.type === 'lake') {
            this.drawLake(obstacle);
            return;
        }

        if (obstacle.type === 'trap')
        {
            this.drawTrap(obstacle);
            return;
        }

        this.drawCactus(obstacle);
    }

    private drawFence(obstacle: MapObstacle): void
    {
        const horizontal = obstacle.width >= obstacle.height;
        const length = horizontal ? obstacle.width : obstacle.height;
        const thickness = horizontal ? obstacle.height : obstacle.width;
        const start = (horizontal ? obstacle.x : obstacle.y) - length / 2;
        const cross = (horizontal ? obstacle.y : obstacle.x);
        const postCount = Math.max(2, Math.floor(length / 42) + 1);

        // Shadow and two weathered timber rails.
        this.graphics.fillStyle(0x654326, 0.25);
        this.graphics.fillRoundedRect(
            obstacle.x - obstacle.width / 2 + 3,
            obstacle.y - obstacle.height / 2 + 5,
            obstacle.width,
            obstacle.height,
            4
        );

        for (let rail = -1; rail <= 1; rail += 2)
        {
            const railOffset = rail * Math.max(3, thickness * 0.23);
            const railStart = start + 2;
            const railEnd = start + length - 2;
            this.graphics.lineStyle(Math.max(4, thickness * 0.2), 0x81532e, 1);
            if (horizontal)
            {
                this.graphics.lineBetween(railStart, cross + railOffset, railEnd, cross + railOffset);
            }
            else
            {
                this.graphics.lineBetween(cross + railOffset, railStart, cross + railOffset, railEnd);
            }
        }

        for (let index = 0; index < postCount; index += 1)
        {
            const position = start + (length * index) / (postCount - 1);
            const postWidth = Math.max(7, thickness * 0.34);
            this.graphics.fillStyle(0x57371f, 1);
            if (horizontal)
            {
                this.graphics.fillRoundedRect(position - postWidth / 2, cross - thickness / 2, postWidth, thickness, 2);
                this.graphics.fillStyle(0xb17a47, 1);
                this.graphics.fillRect(position - postWidth / 2 + 2, cross - thickness / 2 + 2, 2, thickness - 4);
            }
            else
            {
                this.graphics.fillRoundedRect(cross - thickness / 2, position - postWidth / 2, thickness, postWidth, 2);
                this.graphics.fillStyle(0xb17a47, 1);
                this.graphics.fillRect(cross - thickness / 2 + 2, position - postWidth / 2 + 2, thickness - 4, 2);
            }
        }
    }

    private drawLargeRock(obstacle: MapObstacle): void
    {
        this.graphics.fillStyle(0x4b3b2b, 0.3).fillEllipse(obstacle.x + 4, obstacle.y + 9, obstacle.width * 1.05, obstacle.height * 0.9);
        this.graphics.fillStyle(0x77766f, 1).fillRoundedRect(obstacle.x - obstacle.width / 2, obstacle.y - obstacle.height / 2, obstacle.width, obstacle.height, 22);
        this.graphics.fillStyle(0xb0aa99, 0.85).fillEllipse(obstacle.x - obstacle.width * 0.12, obstacle.y - obstacle.height * 0.2, obstacle.width * 0.48, obstacle.height * 0.3);
        this.graphics.lineStyle(3, 0x4d4c46, 0.85).strokeRoundedRect(obstacle.x - obstacle.width / 2, obstacle.y - obstacle.height / 2, obstacle.width, obstacle.height, 22);
    }

    private drawLake(obstacle: MapObstacle): void
    {
        this.graphics.fillStyle(0x59462f, 0.35).fillEllipse(obstacle.x, obstacle.y + 5, obstacle.width + 18, obstacle.height + 18);
        this.graphics.fillStyle(0x155e75, 1).fillEllipse(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        this.graphics.fillStyle(0x38bdf8, 0.42).fillEllipse(obstacle.x - obstacle.width * 0.12, obstacle.y - obstacle.height * 0.12, obstacle.width * 0.62, obstacle.height * 0.38);
        this.graphics.lineStyle(4, 0x0e7490, 0.95).strokeEllipse(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        this.graphics.lineStyle(2, 0xbae6fd, 0.55).strokeEllipse(obstacle.x, obstacle.y, obstacle.width * 0.82, obstacle.height * 0.76);
    }

    private drawTrap(obstacle: MapObstacle): void
    {
        const radius = Math.min(obstacle.width, obstacle.height) * 0.43;
        this.graphics.fillStyle(0x80502e, 0.24);
        this.graphics.fillCircle(obstacle.x + 2, obstacle.y + 4, radius + 4);
        this.graphics.fillStyle(0x9b713e, 0.9);
        this.graphics.fillCircle(obstacle.x, obstacle.y, radius);
        this.graphics.lineStyle(2, 0x5c442d, 0.9);
        this.graphics.strokeCircle(obstacle.x, obstacle.y, radius);
        this.graphics.lineStyle(2, 0xead09a, 0.9);
        for (let index = 0; index < 8; index += 1)
        {
            const angle = (Math.PI * 2 * index) / 8;
            const inner = radius * 0.55;
            const outer = radius * 0.95;
            this.graphics.lineBetween(
                obstacle.x + Math.cos(angle) * inner,
                obstacle.y + Math.sin(angle) * inner,
                obstacle.x + Math.cos(angle) * outer,
                obstacle.y + Math.sin(angle) * outer
            );
        }
    }

    private drawCactus(obstacle: MapObstacle): void
    {
        const radius = Math.max(obstacle.width, obstacle.height) / 2;
        const trunkWidth = Math.max(9, radius * 0.42);
        const trunkHeight = radius * 2;

        this.graphics.fillStyle(0x64452a, 0.25);
        this.graphics.fillEllipse(obstacle.x + 3, obstacle.y + radius * 0.78, radius * 1.8, radius * 0.55);

        // Main trunk with rounded cap and shaded side.
        this.graphics.fillStyle(0x17643c, 1);
        this.graphics.fillRoundedRect(
            obstacle.x - trunkWidth / 2,
            obstacle.y - trunkHeight / 2,
            trunkWidth,
            trunkHeight,
            trunkWidth / 2
        );
        this.graphics.fillStyle(0x2d9a58, 1);
        this.graphics.fillRoundedRect(
            obstacle.x - trunkWidth / 2 + 2,
            obstacle.y - trunkHeight / 2 + 4,
            trunkWidth * 0.42,
            trunkHeight - 8,
            trunkWidth / 3
        );

        // Two raised arms, like a saguaro cactus.
        const armWidth = Math.max(7, trunkWidth * 0.72);
        this.graphics.fillStyle(0x17643c, 1);
        this.graphics.fillRoundedRect(
            obstacle.x - radius * 0.72,
            obstacle.y - radius * 0.05,
            armWidth,
            radius * 0.8,
            armWidth / 2
        );
        this.graphics.fillRoundedRect(
            obstacle.x - radius * 0.72,
            obstacle.y - radius * 0.05,
            radius * 0.48,
            armWidth,
            armWidth / 2
        );
        this.graphics.fillRoundedRect(
            obstacle.x + radius * 0.28,
            obstacle.y - radius * 0.42,
            armWidth,
            radius * 0.75,
            armWidth / 2
        );
        this.graphics.fillRoundedRect(
            obstacle.x - radius * 0.02,
            obstacle.y - radius * 0.42,
            radius * 0.48,
            armWidth,
            armWidth / 2
        );

        this.graphics.lineStyle(1, 0x9de3a7, 0.72);
        this.graphics.lineBetween(obstacle.x - 1, obstacle.y - radius * 0.75, obstacle.x - 1, obstacle.y + radius * 0.72);
        this.graphics.lineStyle(2, 0x0d472e, 0.75);
        this.graphics.strokeRoundedRect(
            obstacle.x - trunkWidth / 2,
            obstacle.y - trunkHeight / 2,
            trunkWidth,
            trunkHeight,
            trunkWidth / 2
        );
    }
}
