import type { PlayerAppearance } from '@hackatec/shared';
import { serverUrl } from '../../network/socket';

export class ProfilePanel {
    readonly element: HTMLDivElement;
    private readonly content: HTMLDivElement;
    private readonly status: HTMLSpanElement;
    private savedSkin?: PlayerAppearance['skin'];

    constructor(onSave: (username: string, appearance: PlayerAppearance) => void) {
        const root = document.createElement('section');
        root.className = 'profile-panel';
        root.setAttribute('aria-label', 'Personalización del perfil');
        this.element = root;

        const toggle = document.createElement('button');
        toggle.className = 'profile-panel__toggle';
        toggle.type = 'button';
        toggle.textContent = 'Personalizar';
        toggle.setAttribute('aria-expanded', 'false');

        const content = document.createElement('div');
        content.className = 'profile-panel__content';
        content.hidden = true;
        this.content = content;

        const heading = document.createElement('div');
        heading.className = 'profile-panel__heading';
        heading.textContent = 'Tu perfil';

        const usernameLabel = document.createElement('label');
        usernameLabel.htmlFor = 'profile-username';
        usernameLabel.textContent = 'Nombre de usuario';
        const username = document.createElement('input');
        username.id = 'profile-username';
        username.name = 'username';
        username.type = 'text';
        username.autocomplete = 'nickname';
        username.placeholder = '3–16 caracteres';
        username.maxLength = 16;
        username.pattern = '[A-Za-z][A-Za-z0-9_]{2,15}';

        const colorLabel = document.createElement('label');
        colorLabel.htmlFor = 'profile-color';
        colorLabel.textContent = 'Color del jugador';
        const color = document.createElement('input');
        color.id = 'profile-color';
        color.name = 'color';
        color.type = 'color';
        color.value = '#60a5fa';

        const modeLabel = document.createElement('label');
        modeLabel.htmlFor = 'profile-mode';
        modeLabel.textContent = 'Apariencia';
        const mode = document.createElement('select');
        mode.id = 'profile-mode';
        mode.name = 'mode';
        for (const value of ['color', 'skin'] as const) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value === 'color' ? 'Color sólido' : 'Skin';
            mode.append(option);
        }

        const fileLabel = document.createElement('label');
        fileLabel.htmlFor = 'profile-skin';
        fileLabel.textContent = 'Subir skin';
        const file = document.createElement('input');
        file.id = 'profile-skin';
        file.name = 'skin';
        file.type = 'file';
        file.accept = 'image/png,image/jpeg,image/webp';

        const save = document.createElement('button');
        save.className = 'profile-panel__save';
        save.type = 'button';
        save.textContent = 'Guardar cambios';
        this.status = document.createElement('span');
        this.status.className = 'profile-panel__status';
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');

        toggle.addEventListener('click', () => {
            const willOpen = content.hidden;
            content.hidden = !willOpen;
            toggle.setAttribute('aria-expanded', String(willOpen));
            toggle.textContent = willOpen ? 'Cerrar perfil' : 'Personalizar';
            if (willOpen) username.focus();
        });

        file.addEventListener('change', async () => {
            if (!file.files?.[0]) return;
            this.setStatus('Subiendo skin…');
            const form = new FormData();
            form.append('skin', file.files[0]);
            try {
                const response = await fetch(serverUrl + '/api/skins', {
                    method: 'POST',
                    body: form,
                    credentials: 'include'
                });
                const result = await response.json() as {
                    id?: string; url?: string; width?: number; height?: number; error?: string
                };
                if (!response.ok || !result.url || !result.id || !result.width || !result.height) {
                    throw new Error(result.error || 'No se pudo subir la skin.');
                }
                this.savedSkin = { id: result.id, url: result.url, width: result.width, height: result.height };
                mode.value = 'skin';
                this.setStatus('Skin cargada correctamente.');
            } catch (error) {
                this.setStatus(error instanceof Error ? error.message : 'Error al subir la skin.', true);
            }
        });

        save.addEventListener('click', () => {
            const appearance: PlayerAppearance = {
                mode: mode.value as 'color' | 'skin',
                colorHex: color.value.toUpperCase(),
                ...((this.savedSkin) ? { skin: this.savedSkin } : {})
            };
            if (appearance.mode === 'skin' && !appearance.skin) {
                this.setStatus('Primero selecciona y sube una skin.', true);
                return;
            }
            onSave(username.value.trim(), appearance);
            this.setStatus('Guardando cambios…');
        });

        content.append(
            heading,
            usernameLabel, username,
            colorLabel, color,
            modeLabel, mode,
            fileLabel, file,
            save, this.status
        );
        root.append(toggle, content);
        document.body.append(root);
    }

    setProfile(usernameValue: string, appearance: PlayerAppearance): void {
        const username = this.element.querySelector<HTMLInputElement>('#profile-username');
        const color = this.element.querySelector<HTMLInputElement>('#profile-color');
        const mode = this.element.querySelector<HTMLSelectElement>('#profile-mode');
        if (username) username.value = usernameValue;
        if (color) color.value = appearance.colorHex;
        if (mode) mode.value = appearance.mode;
        this.savedSkin = appearance.skin;
    }

    setStatus(message: string, isError = false): void {
        this.status.textContent = message;
        this.status.classList.toggle('is-error', isError);
    }

    destroy(): void {
        this.element.remove();
    }
}
