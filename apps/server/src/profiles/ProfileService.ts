import type { PlayerAppearance } from '@hackatec/shared';

import {
    ProfileRepository,
    type PlayerProfile
} from './ProfileRepository.js';

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

const DEFAULT_APPEARANCE: PlayerAppearance = {
    mode: 'color',
    colorHex: '#FFFFFF'
};

export class ProfileService
{
    constructor(
        private readonly repository = new ProfileRepository()
    )
    {
    }

    async getProfile(profileId: string): Promise<PlayerProfile>
    {
        return this.repository.getOrCreate(profileId);
    }

    async setAppearance(
        profileId: string,
        appearance: PlayerAppearance
    ): Promise<PlayerProfile>
    {
        const normalizedAppearance = this.validateAppearance(appearance);
        const profile = await this.repository.getOrCreate(profileId);

        profile.appearance = normalizedAppearance;

        await this.repository.save(profileId, profile);

        return profile;
    }

    private validateAppearance(
        appearance: PlayerAppearance
    ): PlayerAppearance
    {
        const colorHex = appearance.colorHex.trim().toUpperCase();

        if (!HEX_COLOR_REGEX.test(colorHex))
        {
            throw new Error('Invalid color format. Expected #RRGGBB.');
        }

        return {
            ...DEFAULT_APPEARANCE,
            ...appearance,
            colorHex
        };
    }
}