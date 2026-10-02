import type { PlayerState } from '@hackatec/shared';

export class PlayerRegistry
{
    private readonly players = new Map<string, PlayerState>();

    replaceAll(players: PlayerState[])
    {
        this.players.clear();

        for (const player of players)
        {
            this.players.set(player.id, player);
        }
    }

    add(player: PlayerState)
    {
        this.players.set(player.id, player);
    }

    remove(playerId: string): boolean
    {
        return this.players.delete(playerId);
    }

    get(playerId: string): PlayerState | undefined
    {
        return this.players.get(playerId);
    }

    getAll(): PlayerState[]
    {
        return [...this.players.values()];
    }

    get size(): number
    {
        return this.players.size;
    }
}
