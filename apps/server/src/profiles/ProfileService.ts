import type {
    PlayerAppearance,
    SkinAsset
} from '@hackatec/shared';

import {
    ProfileRepository,
    type PlayerProfile
} from './ProfileRepository.js';

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const USERNAME_REGEX = /^[A-Za-z][A-Za-z0-9_]{2,15}$/;

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

    async getProfile(
        profileId: string
    ): Promise<PlayerProfile>
    {
        return this.repository.getOrCreate(profileId);
    }

    async setAppearance(
        profileId: string,
        appearance: PlayerAppearance
    ): Promise<PlayerProfile>
    {
        const profile =
            await this.repository.getOrCreate(profileId);

        const normalizedAppearance =
            this.validateAppearance(
                appearance,
                profile.appearance
            );

        profile.appearance =
            normalizedAppearance;

        await this.repository.save(
            profileId,
            profile
        );

        return profile;
    }

    async setUsername(
        profileId: string,
        username: string
    ): Promise<PlayerProfile>
    {
        const normalizedUsername =
            username.trim();

        if (!USERNAME_REGEX.test(normalizedUsername))
        {
            throw new Error(
                'Invalid username.'
            );
        }

        const profiles =
            await this.repository.getAll();

        const usernameTaken =
            Object.entries(profiles).some(
                ([otherProfileId, profile]) =>
                    otherProfileId !== profileId &&
                    profile.username?.toLowerCase() ===
                    normalizedUsername.toLowerCase()
            );

        if (usernameTaken)
        {
            throw new Error(
                'Username is already taken.'
            );
        }

        const profile =
            await this.repository.getOrCreate(profileId);

        profile.username =
            normalizedUsername;

        profile.usernameChangedAt =
            Date.now();

        await this.repository.save(
            profileId,
            profile
        );

        return profile;
    }

    private validateAppearance(
        appearance: PlayerAppearance,
        currentAppearance: PlayerAppearance =
            DEFAULT_APPEARANCE
    ): PlayerAppearance
    {
        const colorHex =
            appearance.colorHex
                .trim()
                .toUpperCase();

        if (!HEX_COLOR_REGEX.test(colorHex))
        {
            throw new Error(
                'Invalid color format. Expected #RRGGBB.'
            );
        }

        let skin: SkinAsset | undefined;

        if (appearance.skin)
        {
            skin =
                this.validateSkin(
                    appearance.skin
                );
        }
        else if (currentAppearance.skin)
        {
            skin =
                currentAppearance.skin;
        }

        if (
            appearance.mode === 'skin' &&
            !skin
        )
        {
            throw new Error(
                'A skin is required when appearance mode is skin.'
            );
        }

        return {
            mode: appearance.mode,
            colorHex,
            ...(skin ? { skin } : {})
        };
    }

    private validateSkin(
        skin: SkinAsset
    ): SkinAsset
    {
        if (
            typeof skin.id !== 'string' ||
            typeof skin.url !== 'string'
        )
        {
            throw new Error(
                'Invalid skin.'
            );
        }

        if (
            !Number.isInteger(skin.width) ||
            !Number.isInteger(skin.height) ||
            skin.width <= 0 ||
            skin.height <= 0 ||
            skin.width > 512 ||
            skin.height > 512
        )
        {
            throw new Error(
                'Invalid skin dimensions.'
            );
        }

        return {
            id: skin.id,
            url: skin.url,
            width: skin.width,
            height: skin.height
        };
    }
}