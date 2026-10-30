export const MATCH_TEXTS = {
    phases: {
        waiting: 'Esperando para iniciar',
        voting: 'Votación de modo',
        countdown: 'La partida está por comenzar',
        playing: 'Partida en curso',
        results: 'Resultados de la partida'
    },
    modes: {
        classic: 'Clásico',
        everyoneVsOne: 'Todos contra uno',
        rockets: 'Rocket para todos',
        battleRoyale: 'Battle Royale'
    },
    messages: {
        votePrompt: 'Vota por el modo de la siguiente partida.',
        voteRecorded: 'Voto registrado. Puedes cambiarlo mientras la votación siga abierta.',
        needPlayers: 'Se necesitan al menos 2 jugadores para votar.',
        voteFinished: 'Votación finalizada. La partida está por comenzar.',
        hostStarted: 'El anfitrión inició una nueva partida.',
        gameStarted: '¡La partida comenzó!',
        gameFinished: 'Partida finalizada.',
        titanWins: 'El Titan ganó la ronda.',
        huntersWin: 'Los cazadores ganaron la ronda.',
        battleRoyaleWin: '¡Tenemos un ganador de Battle Royale!',
        nextRound: 'Preparando la siguiente ronda.',
        hostStopped: 'El anfitrión detuvo la partida. Esperando a que inicie otra.',
        lateJoin: 'Los jugadores que entran durante una partida quedan como espectadores hasta la siguiente ronda.'
    },
    errors: {
        notMember: 'No perteneces a esta sala.',
        voteClosed: 'La votación no está abierta.',
        voteExpired: 'El tiempo de votación terminó.',
        modeUnavailable: 'Ese modo todavía no está disponible.',
        identityInvalid: 'La identidad de la cuenta no es válida.',
        voteRateLimit: 'Estás votando demasiado rápido. Espera un momento.',
        hostOnlyStart: 'Solo el anfitrión puede iniciar o reiniciar la partida.',
        hostOnlyStop: 'Solo el anfitrión puede detener la partida.'
    },
    controls: {
        voteClassic: 'Votar: Clásico',
        changeVoteClassic: 'Cambiar voto: Clásico',
        hostMenu: '⚙ Anfitrión',
        hostStart: 'Forzar nueva partida',
        hostStop: 'Detener partida',
        spectator: 'ESPECTADOR · Esperando la siguiente partida'
    }
} as const;


export const WEAPON_TEXTS = {
    selected: 'Arma seleccionada.',
    errors: {
        invalidSlot: 'Esa ranura de arma no existe.',
        unavailable: 'No tienes permiso para usar esa arma.',
        modeLocked: 'Esa arma está bloqueada en este modo.',
        rateLimit: 'Espera un momento antes de cambiar de arma.',
        invalidIntent: 'La orden de disparo no es válida.'
    }
} as const;
