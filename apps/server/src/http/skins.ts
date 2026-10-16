import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import sharp, { type OutputInfo } from 'sharp';
import type { Request, RequestHandler, Response } from 'express';

const SKINS_DIRECTORY = path.resolve('storage/skins');
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_DIMENSION = 512;
const formats = new Map([
    ['image/png', 'png'],
    ['image/jpeg', 'jpeg'],
    ['image/webp', 'webp']
]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
    fileFilter: (_request, file, callback) => {
        if (!formats.has(file.mimetype)) {
            callback(new Error('Formato de imagen no permitido. Usa PNG, JPEG o WebP.'));
            return;
        }
        callback(null, true);
    }
}).single('skin');

export const uploadSkin: RequestHandler = (request, response, next) => {
    upload(request, response, (error: unknown) => {
        if (error) {
            const tooLarge = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
            response.status(tooLarge ? 413 : 400).json({
                error: tooLarge ? 'La imagen no puede superar 2 MB.' :
                    error instanceof Error ? error.message : 'Carga de imagen inválida.'
            });
            return;
        }
        next();
    });
};

export async function skinsUploadHandler(request: Request, response: Response)
{
    if (!request.file) {
        response.status(400).json({ error: 'No se recibió ninguna imagen.' });
        return;
    }

    let image: { data: Buffer; info: OutputInfo };
    try {
        const decoder = sharp(request.file.buffer, {
            failOn: 'warning',
            limitInputPixels: MAX_DIMENSION * MAX_DIMENSION
        });
        const metadata = await decoder.metadata();
        if (metadata.format !== formats.get(request.file.mimetype) ||
            !metadata.width || !metadata.height ||
            metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
            response.status(400).json({ error: 'Formato o dimensiones inválidos. Máximo: 512×512 píxeles.' });
            return;
        }
        // Decode the pixels, not only the header. Store a clean PNG without user metadata.
        image = await decoder.png().toBuffer({ resolveWithObject: true });
    } catch {
        response.status(400).json({ error: 'Imagen dañada o inválida. Usa PNG, JPEG o WebP de hasta 512×512 píxeles.' });
        return;
    }

    await fs.mkdir(SKINS_DIRECTORY, { recursive: true });
    const fileName = randomUUID() + '.png';
    await fs.writeFile(path.join(SKINS_DIRECTORY, fileName), image.data);
    response.status(201).json({
        id: fileName,
        url: '/skins/' + fileName,
        width: image.info.width,
        height: image.info.height
    });
}
