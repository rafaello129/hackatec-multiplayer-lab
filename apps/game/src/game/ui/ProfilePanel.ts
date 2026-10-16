import type { PlayerAppearance } from '@hackatec/shared';
import { serverUrl } from '../../network/socket';

export class ProfilePanel {
    readonly element: HTMLDivElement;
    private readonly status: HTMLSpanElement;
    private readonly save: HTMLButtonElement;
    private pending = false;
    private readonly dialog: HTMLDialogElement;
    private readonly toggle: HTMLButtonElement;
    constructor(
        onSave: (username: string, appearance: PlayerAppearance) => void,
        onFocusChange: (focused: boolean) => void
    ) {
        const div = document.createElement('div');
        this.element = div;
        div.className = 'profile-controls';
        const toggle = document.createElement('button');
        toggle.className = 'profile-toggle'; toggle.textContent = 'Personalizar nave';
        toggle.setAttribute('aria-haspopup', 'dialog'); toggle.setAttribute('aria-expanded', 'false');
        this.toggle = toggle;
        const dialog = document.createElement('dialog'); dialog.className = 'profile-dialog';
        dialog.setAttribute('aria-labelledby', 'profile-title');
        this.dialog = dialog;
        const heading = document.createElement('h2'); heading.id = 'profile-title'; heading.textContent = 'Tu nave. Tu identidad.';
        const intro = document.createElement('p'); intro.textContent = 'Elige cómo te ve tu equipo en la arena.';
        const close = document.createElement('button'); close.className = 'dialog-close'; close.textContent = '×'; close.setAttribute('aria-label','Cerrar personalización');
        close.onclick = () => dialog.close();
        toggle.onclick = () => { dialog.showModal(); toggle.setAttribute('aria-expanded','true'); onFocusChange(true); };
        dialog.addEventListener('close', () => { toggle.setAttribute('aria-expanded','false'); onFocusChange(false); toggle.focus(); });
        dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
        const username = document.createElement('input'); username.placeholder = 'Username (3-16)'; username.maxLength = 16;
        const color = document.createElement('input'); color.type = 'color'; color.value = '#60a5fa';
        const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/png,image/jpeg,image/webp';
        const mode = document.createElement('select');
        for (const value of ['color','skin']) { const option = document.createElement('option'); option.value = value; option.textContent = value === 'color' ? 'Color' : 'Skin'; mode.append(option); }
        const save = document.createElement('button'); save.textContent = 'Guardar perfil';
        const status = document.createElement('span'); status.setAttribute('role','status');
        this.save = save;
        this.status = status;
        let skin: PlayerAppearance['skin'];
        file.addEventListener('change', async () => {
            if (!file.files?.[0]) return;
            status.textContent = 'Subiendo skin...';
            const form = new FormData(); form.append('skin',file.files[0]);
            try {
                const response = await fetch(serverUrl + '/api/skins', {method:'POST',body:form});
                if (!response.ok) {
                    const result = await response.json() as { error?: string };
                    throw new Error(result.error ?? 'No se pudo subir');
                }
                skin = await response.json() as NonNullable<PlayerAppearance['skin']>;
                mode.value = 'skin'; status.textContent = 'Skin cargada';
            } catch (error) { status.textContent = error instanceof Error ? error.message : 'Error al subir skin'; }
        });
        save.onclick = () => {
            const appearance: PlayerAppearance = { mode: mode.value as 'color' | 'skin',colorHex:color.value.toUpperCase(),...((skin ?? this.savedSkin)?{skin:skin ?? this.savedSkin}:{}) };
            this.pending = true;
            save.disabled = true;
            status.textContent = 'Enviando cambios...';
            onSave(username.value.trim(), appearance);
        };
        const field = (text: string, control: HTMLElement) => {
            const label = document.createElement('label'); label.textContent = text; label.append(control); return label;
        };
        const note = document.createElement('p'); note.className = 'profile-note'; note.textContent = 'La partida continúa mientras personalizas. Esc para volver.';
        dialog.append(close, heading, intro, field('Nombre de piloto', username), field('Color de identificación', color), field('Apariencia', mode), field('Subir skin · PNG, JPG o WebP', file), save, status, note);
        div.append(toggle, dialog);
        document.body.appendChild(div);
        document.querySelector('.room-tools')?.append(toggle);
    }
    setProfile(usernameValue: string, appearance: PlayerAppearance) {
        const controls = this.element.querySelectorAll('input, select');
        const name = controls[0] as HTMLInputElement;
        const color = controls[1] as HTMLInputElement;
        const mode = controls[2] as HTMLSelectElement;
        name.value = usernameValue;
        color.value = appearance.colorHex;
        mode.value = appearance.mode;
        this.savedSkin = appearance.skin;
    }
    private savedSkin?: PlayerAppearance['skin'];
    setResult(message: string) {
        this.pending = false;
        this.save.disabled = false;
        this.status.textContent = message;
    }
    setConnected(connected: boolean) {
        if (!connected && this.pending) this.setResult('Conexión perdida. Vuelve a guardar al reconectar.');
        this.save.disabled = !connected || this.pending;
    }
    destroy(){ if (this.dialog.open) this.dialog.close(); this.toggle.remove(); this.element.remove(); }
}
