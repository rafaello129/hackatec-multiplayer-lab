import { describe, expect, it } from 'vitest';
import { getImageDimensions } from './skins.js';

function pngHeader(width: number, height: number, validSignature = true): Buffer {
    const buffer = Buffer.alloc(24);
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (validSignature) signature.forEach((byte, index) => { buffer[index] = byte; });
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

    it('rejects a PNG-sized header under an unrelated MIME type', () => {
        expect(getImageDimensions(pngHeader(64, 96), 'image/jpeg')).toBeUndefined();
    });
});
