import './style.css';
import { startGame } from './game/main';
import { serverUrl } from './network/socket';

type AuthResponse = {
    account?: { id: string; username: string };
    error?: string;
};

const app = document.querySelector<HTMLDivElement>('#app')!;

let gameStarted = false;
function launchGame(): void {
    if (gameStarted) return;
    gameStarted = true;
    document.querySelector('#auth-screen')?.remove();
    startGame();
}

function renderAuth(message = ''): void {
    document.querySelector('#auth-screen')?.remove();
    const screen = document.createElement('section');
    screen.id = 'auth-screen';
    screen.className = 'auth-screen';
    screen.innerHTML = `
        <div class="auth-card">
            <div class="auth-kicker">HACKATEC · MULTIPLAYER LAB</div>
            <h1 id="auth-title">Qué bueno verte</h1>
            <p class="auth-description">Inicia sesión para entrar a la arena y guardar tu progreso.</p>
            <form id="auth-form">
                <label for="auth-username">Nombre de usuario</label>
                <input id="auth-username" name="username" type="text" autocomplete="username"
                    minlength="3" maxlength="16" pattern="[A-Za-z][A-Za-z0-9_]{2,15}"
                    placeholder="Ej. Gueta" required />
                <p class="auth-hint">3–16 caracteres. Empieza con una letra; usa letras, números o _.</p>
                <label for="auth-password">Contraseña</label>
                <input id="auth-password" name="password" type="password" autocomplete="current-password"
                    minlength="8" maxlength="128" placeholder="Mínimo 8 caracteres" required />
                <p id="auth-error" class="auth-error" role="alert"></p>
                <button id="auth-submit" class="auth-submit" type="submit">Iniciar sesión</button>
            </form>
            <p class="auth-switch"><span id="auth-switch-copy">¿Aún no tienes cuenta?</span>
                <button id="auth-switch" type="button">Crear cuenta</button>
            </p>
        </div>`;
    app.prepend(screen);

    let mode: 'login' | 'register' = 'login';
    const form = screen.querySelector<HTMLFormElement>('#auth-form')!;
    const title = screen.querySelector<HTMLHeadingElement>('#auth-title')!;
    const submit = screen.querySelector<HTMLButtonElement>('#auth-submit')!;
    const switchButton = screen.querySelector<HTMLButtonElement>('#auth-switch')!;
    const switchCopy = screen.querySelector<HTMLSpanElement>('#auth-switch-copy')!;
    const password = screen.querySelector<HTMLInputElement>('#auth-password')!;
    const error = screen.querySelector<HTMLParagraphElement>('#auth-error')!;

    const setMode = (next: 'login' | 'register') => {
        mode = next;
        const registering = mode === 'register';
        title.textContent = registering ? 'Crea tu cuenta' : 'Qué bueno verte';
        submit.textContent = registering ? 'Crear cuenta' : 'Iniciar sesión';
        switchCopy.textContent = registering ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?';
        switchButton.textContent = registering ? 'Iniciar sesión' : 'Crear cuenta';
        password.autocomplete = registering ? 'new-password' : 'current-password';
        error.textContent = '';
    };

    switchButton.addEventListener('click', () => setMode(mode === 'login' ? 'register' : 'login'));
    if (message) error.textContent = message;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        submit.disabled = true;
        error.textContent = '';
        const data = new FormData(form);
        try {
            const response = await fetch(`${serverUrl}/api/auth/${mode}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: String(data.get('username') ?? ''),
                    password: String(data.get('password') ?? '')
                })
            });
            const result = await response.json() as AuthResponse;
            if (!response.ok || !result.account) {
                error.textContent = result.error || 'No se pudo completar la solicitud.';
                return;
            }
            launchGame();
        } catch {
            error.textContent = 'No se pudo conectar con el servidor.';
        } finally {
            submit.disabled = false;
        }
    });
}

async function initialize(): Promise<void> {
    try {
        const response = await fetch(`${serverUrl}/api/auth/session`, {
            credentials: 'include',
            cache: 'no-store'
        });
        if (response.ok) {
            launchGame();
            return;
        }
    } catch {
        renderAuth('No se pudo conectar con el servidor. Revisa que esté encendido e inténtalo de nuevo.');
        return;
    }
    renderAuth();
}

void initialize();
