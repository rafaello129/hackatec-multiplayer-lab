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


export const ARENA_UI_TEXTS = {
    brand: 'HACKATEC',
    subtitle: 'MULTIPLAYER ARENA',
    roomPrefix: 'SALA',
    playerCountSuffix: 'JUGADORES',
    sharedArena: 'ARENA COMPARTIDA · ESTADO AUTORITATIVO',
    movementHelp: 'WASD / FLECHAS  ·  SHIFT DASH',
    connection: {
        connecting: '● CONECTANDO',
        connected: '● CONECTADO',
        disconnected: '● DESCONECTADO'
    }
} as const;

export const CHAT_TEXTS = {
    panelTitle: 'CHAT · ENTER para escribir',
    inputIdle: 'ENTER · Escribir mensaje',
    inputPrompt: '> Escribe y pulsa ENTER',
    inputPrefix: '> ',
    spectatorPrefix: '[ESPECTADORES] ',
    systemPrefix: 'Sistema: +',
    systemSuffix: ' XP por la partida',
    errors: {
        invalidChannel: 'Canal de chat inválido.',
        spectatorOnly: 'Solo los espectadores pueden usar ese canal.',
        activeOnly: 'Los espectadores deben usar el canal de espectadores.',
        invalidText: 'El mensaje debe ser texto.',
        empty: 'Escribe un mensaje antes de enviarlo.',
        tooLong: 'El mensaje supera los 120 caracteres.',
        rateLimit: 'Estás enviando mensajes demasiado rápido.'
    }
} as const;

export const PROFILE_TEXTS = {
    toggle: 'Personalizar',
    close: 'Cerrar perfil',
    heading: 'Tu perfil',
    username: 'Nombre de usuario',
    usernameHint: '3–16 caracteres',
    color: 'Color del jugador',
    appearance: 'Apariencia',
    colorOption: 'Color sólido',
    skinOption: 'Skin',
    uploadSkin: 'Subir skin',
    uploading: 'Subiendo skin…',
    skinUploaded: 'Skin cargada correctamente.',
    skinUploadError: 'No se pudo subir la skin.',
    save: 'Guardar cambios',
    saving: 'Guardando cambios…',
    saved: 'Perfil guardado.',
    skinRequired: 'Primero selecciona y sube una skin.',
    errors: {
        reservedOwnerName: 'El nombre Gueta está reservado para esta cuenta.',
        invalidUsername: 'Username inválido (3-16 caracteres)',
        invalidAppearance: 'Apariencia inválida',
        usernameTaken: 'Ese nombre de usuario ya está en uso.',
        saveFailed: 'No se pudo guardar el perfil.',
        uploadUnauthorized: 'Inicia sesión para subir una skin.',
        noUploadFile: 'No se recibió ninguna imagen.',
        unreadableImage: 'No se pudo leer la imagen.',
        imageTooLarge: 'La imagen no puede superar 512x512 píxeles.',
        uploadFailed: 'No se pudo guardar la skin.',
        sessionExpired: 'La sesión ya no es válida.',
        unsupportedFormat: 'Formato de imagen no permitido.'
    }
} as const;
