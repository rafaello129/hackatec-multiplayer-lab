import { Scene, Textures } from 'phaser';

export const SPRITE_ATLAS = 'arena-sprites';
export const SHIP_TEXTURE = 'player-ship';
export const CANYON_TEXTURE = 'canyon-rock';
const frames = ['ship', 'potted-cactus', 'cactus', 'rope-fence', 'wood-fence', 'stone-wall'] as const;

export function loadArenaSprites(scene: Scene): void {
    if (!scene.textures.exists(CANYON_TEXTURE)) scene.load.image(CANYON_TEXTURE, `${import.meta.env.BASE_URL}assets/sprites/canyon-rock.png`);
    if (!scene.textures.exists(SHIP_TEXTURE)) {
        scene.load.image(SHIP_TEXTURE, `${import.meta.env.BASE_URL}assets/sprites/source/ship.png`);
    }
    if (!scene.textures.exists(SPRITE_ATLAS)) {
        scene.load.image(SPRITE_ATLAS, `${import.meta.env.BASE_URL}assets/sprites/arena.png`);
    }
}

/** Trim transparent padding in each of the six cells without resampling the art. */
export function prepareArenaSprites(scene: Scene): void {
    if (scene.textures.exists(SHIP_TEXTURE)) scene.textures.get(SHIP_TEXTURE).setFilter(Textures.FilterMode.NEAREST);
    prepareFrames(scene, SPRITE_ATLAS, frames, 3, 2);
    prepareFrames(scene, CANYON_TEXTURE, ['rock'], 1, 1);
}

function prepareFrames(scene: Scene, key: string, names: readonly string[], columns: number, rows: number): void {
    if (!scene.textures.exists(key)) return;
    const texture = scene.textures.get(key);
    texture.setFilter(Textures.FilterMode.NEAREST);
    const source = texture.getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    names.forEach((name, index) => {
        if (texture.has(name)) return;
        const left = Math.floor((index % columns) * canvas.width / columns);
        const right = Math.floor(((index % columns) + 1) * canvas.width / columns);
        const top = Math.floor(Math.floor(index / columns) * canvas.height / rows);
        const bottom = Math.floor((Math.floor(index / columns) + 1) * canvas.height / rows);
        let minX = right, minY = bottom, maxX = left, maxY = top;
        for (let y = top; y < bottom; y++) {
            for (let x = left; x < right; x++) {
                if (pixels[(y * canvas.width + x) * 4 + 3] < 32) continue;
                minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            }
        }
        if (minX <= maxX && minY <= maxY) texture.add(name, 0, minX, minY, maxX - minX + 1, maxY - minY + 1);
    });
}
