import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { PlayerAppearance } from '@hackatec/shared';

export type Profile = { username?: string; appearance: PlayerAppearance };
const file = path.resolve('storage/profiles.json');
const defaultAppearance: PlayerAppearance = { mode: 'color', colorHex: '#60A5FA' };
export class ProfileStore {
    private queue: Promise<unknown> = Promise.resolve();
    private async all(): Promise<Record<string, Profile>> {
        try { return JSON.parse(await fs.readFile(file, 'utf8')) as Record<string, Profile>; }
        catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw e; }
    }
    async get(id: string): Promise<Profile> {
        const data = await this.all();
        return data[id] ?? { appearance: { ...defaultAppearance } };
    }
    async update(id: string, change: { username?: string; appearance?: PlayerAppearance }): Promise<Profile> {
        const job = this.queue.then(async () => {
            const all = await this.all();
            const old = all[id] ?? { appearance: { ...defaultAppearance } };
            if (change.username !== undefined && Object.entries(all).some(([key, profile]) => key !== id && profile.username?.toLowerCase() === change.username?.toLowerCase())) throw new Error('Username en uso');
            const next: Profile = { ...old, ...change };
            all[id] = next;
            await fs.mkdir(path.dirname(file), { recursive: true });
            await fs.writeFile(file + '.tmp', JSON.stringify(all, null, 2));
            await fs.rename(file + '.tmp', file);
            return next;
        });
        this.queue = job.catch(() => undefined);
        return job;
    }
}
