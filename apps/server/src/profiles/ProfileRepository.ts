import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { PlayerAppearance } from '@hackatec/shared';

export type PlayerProfile = {
    username?: string;
    usernameChangedAt?: number;
    appearance: PlayerAppearance;
};

const DEFAULT_APPEARANCE: PlayerAppearance = {
    mode: 'color',
    colorHex: '#FFFFFF'
};

export class ProfileRepository
{
    private readonly filePath: string;

    constructor(filePath = path.resolve('storage/profiles.json'))
    {
        this.filePath = filePath;
    }

    async get(profileId: string): Promise<PlayerProfile | undefined>
    {
        const profiles = await this.readProfiles();

        return profiles[profileId];
    }
    
    async getAll(): Promise<Record<string, PlayerProfile>>
    {
        return this.readProfiles();
    }

    async save(profileId: string, profile: PlayerProfile): Promise<void>
    {
        const profiles = await this.readProfiles();

        profiles[profileId] = profile;

        await this.writeProfiles(profiles);
    }

    async getOrCreate(profileId: string): Promise<PlayerProfile>
    {
        const existingProfile = await this.get(profileId);

        if (existingProfile)
        {
            return existingProfile;
        }

        const profile: PlayerProfile = {
            appearance: { ...DEFAULT_APPEARANCE }
        };

        await this.save(profileId, profile);

        return profile;
    }

    private async readProfiles(): Promise<Record<string, PlayerProfile>>
    {
        try
        {
            const content = await fs.readFile(this.filePath, 'utf8');
            return JSON.parse(content) as Record<string, PlayerProfile>;
        }
        catch (error)
        {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT')
            {
                return {};
            }

            throw error;
        }
    }

    private async writeProfiles(
        profiles: Record<string, PlayerProfile>
    ): Promise<void>
    {
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });

        await fs.writeFile(
            this.filePath,
            JSON.stringify(profiles, null, 2),
            'utf8'
        );
    }
}