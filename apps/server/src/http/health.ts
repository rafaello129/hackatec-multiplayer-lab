import type { Request, Response } from 'express';

export const healthPayload = {
    ok: true,
    service: 'hackatec-multiplayer-server'
} as const;

export function healthHandler(_request: Request, response: Response)
{
    response.status(200).json(healthPayload);
}
