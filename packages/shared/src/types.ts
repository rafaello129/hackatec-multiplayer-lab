export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export type ConnectionReadyPayload = {
    message: string;
    socketId: string;
};
