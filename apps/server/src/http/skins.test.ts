import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import type { AddressInfo } from 'node:net';
import express from 'express';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { skinsUploadHandler, uploadSkin } from './skins.js';

vi.mock('node:fs', () => ({ promises: { mkdir: vi.fn(), writeFile: vi.fn() } }));

describe('skin upload HTTP validation', () => {
    const app = express();
    app.post('/api/skins', uploadSkin, skinsUploadHandler);
    const server = createServer(app);
    let url: string;
    beforeAll(async () => {
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
        url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/skins`;
    });
    beforeEach(() => vi.clearAllMocks());
    afterAll(async () => {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    });
    async function post(bytes: Buffer, mime = 'image/png') {
        const form = new FormData();
        form.append('skin', new Blob([new Uint8Array(bytes)], { type: mime }), 'skin');
        return fetch(url, { method: 'POST', body: form });
    }
    const picture = (width = 16, height = 16) => sharp({
        create: { width, height, channels: 4, background: '#60a5fa' }
    });

    it.each(['png', 'jpeg', 'webp'] as const)('decodes valid %s and stores a PNG', async format => {
        const response = await post(await picture().toFormat(format).toBuffer(), `image/${format}`);
        expect(response.status).toBe(201);
        expect(await response.json()).toMatchObject({ width: 16, height: 16, url: expect.stringMatching(/\.png$/) });
        expect(fs.writeFile).toHaveBeenCalledTimes(1);
        const stored = vi.mocked(fs.writeFile).mock.calls[0][1] as Buffer;
        expect(await sharp(stored).metadata()).toMatchObject({ format: 'png', width: 16, height: 16 });
    });
    it('rejects fake PNG headers and truncated pixel data without writing files', async () => {
        const valid = await picture().png().toBuffer();
        for (const bytes of [Buffer.alloc(24), valid.subarray(0, 40)]) {
            const response = await post(bytes);
            expect(response.status).toBe(400);
            expect(await response.json()).toHaveProperty('error');
        }
        expect(fs.writeFile).not.toHaveBeenCalled();
    });
    it('rejects MIME/content mismatches', async () => {
        expect((await post(await picture().jpeg().toBuffer())).status).toBe(400);
        expect(fs.writeFile).not.toHaveBeenCalled();
    });
    it('rejects dimensions outside the limit', async () => {
        expect((await post(await picture(513, 1).png().toBuffer())).status).toBe(400);
        expect(fs.writeFile).not.toHaveBeenCalled();
    });
    it('returns JSON 400 for unsupported MIME instead of HTML 500', async () => {
        const response = await post(Buffer.from('not an image'), 'text/plain');
        expect(response.status).toBe(400);
        expect(response.headers.get('content-type')).toContain('application/json');
        expect(await response.json()).toEqual({ error: expect.stringContaining('Formato') });
        expect(fs.writeFile).not.toHaveBeenCalled();
    });
    it('returns JSON 413 for files exceeding 2 MB', async () => {
        const response = await post(Buffer.alloc(2 * 1024 * 1024 + 1));
        expect(response.status).toBe(413);
        expect(await response.json()).toEqual({ error: expect.stringContaining('2 MB') });
        expect(fs.writeFile).not.toHaveBeenCalled();
    });
});
