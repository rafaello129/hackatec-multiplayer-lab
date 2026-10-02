export type ServerConfig = {
    host: string;
    port: number;
    corsOrigin: string;
};

const DEFAULT_PORT = 3001;

export function getServerConfig(
    env: NodeJS.ProcessEnv = process.env
): ServerConfig
{
    const parsedPort = Number.parseInt(env.PORT ?? String(DEFAULT_PORT), 10);

    return {
        host: env.HOST?.trim() || '0.0.0.0',
        port: Number.isFinite(parsedPort) ? parsedPort : DEFAULT_PORT,
        corsOrigin: env.CORS_ORIGIN?.trim() || '*'
    };
}

export function getAllowedOrigins(corsOrigin: string): string | string[]
{
    if (corsOrigin === '*')
    {
        return '*';
    }

    return corsOrigin
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
}
