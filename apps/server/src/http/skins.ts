import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import type { Request, Response } from 'express';
import type { AccountStore } from '../auth/AccountStore.js';

const SKINS_DIRECTORY = path.resolve('storage/skins');

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_WIDTH = 512;
const MAX_HEIGHT = 512;

const ALLOWED_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/webp'
]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_FILE_SIZE
    },
    fileFilter: (_request, file, callback) =>
    {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype))
        {
            callback(new Error('Formato de imagen no permitido.'));
            return;
        }

        callback(null, true);
    }
});

export const uploadSkin = upload.single('skin');

export async function skinsUploadHandler(
    request: Request,
    response: Response,
    accounts: AccountStore
)
{
    if (!request.file)
    {
        response.status(400).json({
            error: 'No se recibió ninguna imagen.'
        });

        return;
    }

    const dimensions = getImageDimensions(
        request.file.buffer,
        request.file.mimetype
    );

    if (!dimensions)
    {
        response.status(400).json({
            error: 'No se pudo leer la imagen.'
        });

        return;
    }

    if (
        dimensions.width > MAX_WIDTH ||
        dimensions.height > MAX_HEIGHT
    )
    {
        response.status(400).json({
            error: 'La imagen no puede superar 512x512 píxeles.'
        });

        return;
    }

    await fs.mkdir(SKINS_DIRECTORY, {
        recursive: true
    });

    const extension = getExtension(
        request.file.mimetype
    );

    const fileName = `${randomUUID()}.${extension}`;

    const filePath = path.join(
        SKINS_DIRECTORY,
        fileName
    );

    const accountId = response.locals.accountId;
    if (typeof accountId !== 'string' || !accountId) {
        response.status(401).json({ error: 'La sesión ya no es válida.' });
        return;
    }

    const skin = {
        id: fileName,
        url: `/skins/${fileName}`,
        width: dimensions.width,
        height: dimensions.height
    };

    try {
        await fs.writeFile(filePath, request.file.buffer);
        accounts.saveSkin(accountId, skin);
    } catch (error) {
        await fs.unlink(filePath).catch(() => undefined);
        console.error('[skins] could not persist skin ownership:', error instanceof Error ? error.message : 'unknown error');
        response.status(500).json({ error: 'No se pudo guardar la skin.' });
        return;
    }

    response.status(201).json(skin);
}

function getExtension(
    mimeType: string
): string
{
    switch (mimeType)
    {
        case 'image/png':
            return 'png';

        case 'image/jpeg':
            return 'jpg';

        case 'image/webp':
            return 'webp';

        default:
            return 'bin';
    }
}

export function getImageDimensions(
    buffer: Buffer,
    mimeType: string
): { width: number; height: number } | undefined
{
    if (mimeType === 'image/png')
    {
        const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
        if (buffer.length < 33 ||
            !signature.every((byte, index) => buffer[index] === byte) ||
            buffer.readUInt32BE(8) !== 13 ||
            buffer.toString('ascii', 12, 16) !== 'IHDR')
        {
            return undefined;
        }

        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        if (width < 1 || height < 1) return undefined;
        return { width, height };
    }

    if (mimeType === 'image/jpeg')
    {
        const dimensions = getJpegDimensions(buffer);
        return dimensions && dimensions.width > 0 && dimensions.height > 0 ? dimensions : undefined;
    }

    if (mimeType === 'image/webp')
    {
        return getWebpDimensions(buffer);
    }

    return undefined;
}

function getJpegDimensions(
    buffer: Buffer
): { width: number; height: number } | undefined
{
    if (
        buffer.length < 4 ||
        buffer[0] !== 0xff ||
        buffer[1] !== 0xd8
    )
    {
        return undefined;
    }

    let offset = 2;

    while (offset + 9 < buffer.length)
    {
        if (buffer[offset] !== 0xff)
        {
            offset += 1;
            continue;
        }

        const marker = buffer[offset + 1];

        offset += 2;

        if (
            marker === 0xd8 ||
            marker === 0xd9
        )
        {
            continue;
        }

        if (offset + 2 > buffer.length)
        {
            return undefined;
        }

        const segmentLength =
            buffer.readUInt16BE(offset);

        if (segmentLength < 2)
        {
            return undefined;
        }

        const isSizeMarker =
            (marker >= 0xc0 && marker <= 0xc3) ||
            (marker >= 0xc5 && marker <= 0xc7) ||
            (marker >= 0xc9 && marker <= 0xcb) ||
            (marker >= 0xcd && marker <= 0xcf);

        if (isSizeMarker)
        {
            if (offset + 7 > buffer.length)
            {
                return undefined;
            }

            return {
                height: buffer.readUInt16BE(offset + 3),
                width: buffer.readUInt16BE(offset + 5)
            };
        }

        offset += segmentLength;
    }

    return undefined;
}

function getWebpDimensions(
    buffer: Buffer
): { width: number; height: number } | undefined
{
    if (
        buffer.length < 21 ||
        buffer.toString('ascii', 0, 4) !== 'RIFF' ||
        buffer.toString('ascii', 8, 12) !== 'WEBP'
    )
    {
        return undefined;
    }

    const chunk = buffer.toString('ascii', 12, 16);
    let width = 0;
    let height = 0;

    if (chunk === 'VP8X')
    {
        if (buffer.length < 30) return undefined;
        width = 1 + buffer.readUIntLE(24, 3);
        height = 1 + buffer.readUIntLE(27, 3);
    }
    else if (chunk === 'VP8L')
    {
        if (buffer.length < 25 || buffer[20] !== 0x2f) return undefined;
        const b1 = buffer[21]!;
        const b2 = buffer[22]!;
        const b3 = buffer[23]!;
        const b4 = buffer[24]!;
        width = 1 + (((b2 & 0x3f) << 8) | b1);
        height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
    }
    else if (chunk === 'VP8 ')
    {
        if (buffer.length < 30 ||
            buffer[23] !== 0x9d || buffer[24] !== 0x01 || buffer[25] !== 0x2a) return undefined;
        width = buffer.readUInt16LE(26) & 0x3fff;
        height = buffer.readUInt16LE(28) & 0x3fff;
    }
    else
    {
        return undefined;
    }

    if (width < 1 || height < 1) return undefined;
    return { width, height };
}