import { describe, expect, it } from 'vitest';
import { getImageDimensions } from './skins.js';

function pngHeader(width: number, height: number, validSignature = true): Buffer {
    const buffer = Buffer.alloc(33);
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (validSignature) signature.forEach((byte, index) => { buffer[index] = byte; });
    buffer.writeUInt32BE(13, 8);
    buffer.write('IHDR', 12, 'ascii');
    buffer.writeUInt32BE(width, 16);
    buffer.writeUInt32BE(height, 20);
    return buffer;
}

describe('skin image metadata validation', () => {
    it('accepts a PNG header with the real signature and positive dimensions', () => {
        expect(getImageDimensions(pngHeader(64, 96), 'image/png')).toEqual({
            width: 64,
            height: 96
        });
    });

    it('rejects files that only imitate PNG dimensions without a PNG signature', () => {
        expect(getImageDimensions(pngHeader(64, 96, false), 'image/png')).toBeUndefined();
    });

    it('rejects truncated PNG headers and zero-sized images', () => {
        expect(getImageDimensions(Buffer.alloc(20), 'image/png')).toBeUndefined();
        expect(getImageDimensions(pngHeader(0, 96), 'image/png')).toBeUndefined();
        expect(getImageDimensions(pngHeader(64, 0), 'image/png')).toBeUndefined();
    });

    it('reads dimensions from VP8X extended WebP headers', () => {
        const buffer = Buffer.alloc(30);
        buffer.write('RIFF', 0, 'ascii');
        buffer.write('WEBP', 8, 'ascii');
        buffer.write('VP8X', 12, 'ascii');
        buffer.writeUIntLE(63, 24, 3);
        buffer.writeUIntLE(95, 27, 3);
        expect(getImageDimensions(buffer, 'image/webp')).toEqual({ width: 64, height: 96 });
    });

    it('reads dimensions from VP8L lossless WebP headers', () => {
        const buffer = Buffer.alloc(25);
        buffer.write('RIFF', 0, 'ascii');
        buffer.write('WEBP', 8, 'ascii');
        buffer.write('VP8L', 12, 'ascii');
        buffer[20] = 0x2f;
        buffer[21] = 63;
        buffer[22] = 0;
        buffer[23] = 95;
        buffer[24] = 0;
        expect(getImageDimensions(buffer, 'image/webp')).toEqual({ width: 64, height: 381 });
    });

    it('reads dimensions from VP8 lossy WebP headers', () => {
        const buffer = Buffer.alloc(30);
        buffer.write('RIFF', 0, 'ascii');
        buffer.write('WEBP', 8, 'ascii');
        buffer.write('VP8 ', 12, 'ascii');
        buffer[23] = 0x9d;
        buffer[24] = 0x01;
        buffer[25] = 0x2a;
        buffer.writeUInt16LE(64, 26);
        buffer.writeUInt16LE(96, 28);
        expect(getImageDimensions(buffer, 'image/webp')).toEqual({ width: 64, height: 96 });
    });

    it('rejects a PNG-sized header under an unrelated MIME type', () => {
        expect(getImageDimensions(pngHeader(64, 96), 'image/jpeg')).toBeUndefined();
    });
});
