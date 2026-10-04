import { promises as fs } from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import type { Request, Response } from 'express';

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
    response: Response
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

    const fileName = `${crypto.randomUUID()}.${extension}`;

    const filePath = path.join(
        SKINS_DIRECTORY,
        fileName
    );

    await fs.writeFile(
        filePath,
        request.file.buffer
    );

    response.status(201).json({
        id: fileName,
        url: `/skins/${fileName}`,
        width: dimensions.width,
        height: dimensions.height
    });
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

function getImageDimensions(
    buffer: Buffer,
    mimeType: string
): { width: number; height: number } | undefined
{
    if (mimeType === 'image/png')
    {
        if (buffer.length < 24)
        {
            return undefined;
        }

        return {
            width: buffer.readUInt32BE(16),
            height: buffer.readUInt32BE(20)
        };
    }

    if (mimeType === 'image/jpeg')
    {
        return getJpegDimensions(buffer);
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
        buffer.length < 30 ||
        buffer.toString('ascii', 0, 4) !== 'RIFF' ||
        buffer.toString('ascii', 8, 12) !== 'WEBP'
    )
    {
        return undefined;
    }

    const chunk = buffer.toString(
        'ascii',
        12,
        16
    );

    if (chunk === 'VP8X')
    {
        return {
            width:
                1 +
                buffer.readUIntLE(24, 3),

            height:
                1 +
                buffer.readUIntLE(27, 3)
        };
    }

    return undefined;
}