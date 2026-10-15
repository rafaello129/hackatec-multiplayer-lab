import type { PlayerAppearance } from '@hackatec/shared';
import { serverUrl } from '../../network/socket';

export class ProfilePanel {
    readonly element: HTMLDivElement;
    constructor(onSave: (username: string, appearance: PlayerAppearance) => void) {
        const div = document.createElement('div');
        this.element = div;
        div.style.cssText = 'position:absolute;right:12px;top:125px;z-index:20;background:#0f172aee;color:white;border:1px solid #334155;padding:12px;border-radius:10px;font:13px Arial;display:grid;gap:7px;width:210px';
        const heading = document.createElement('strong'); heading.textContent = 'Personalización';
        const username = document.createElement('input'); username.placeholder = 'Username (3-16)'; username.maxLength = 16;
        const color = document.createElement('input'); color.type = 'color'; color.value = '#60a5fa';
        const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/png,image/jpeg,image/webp';
        file.style.width = '195px';
        const mode = document.createElement('select');
        for (const value of ['color','skin']) { const option = document.createElement('option'); option.value = value; option.textContent = value === 'color' ? 'Color' : 'Skin'; mode.append(option); }
        const save = document.createElement('button'); save.textContent = 'Guardar perfil';
        const status = document.createElement('span'); status.setAttribute('role','status');
        let skin: PlayerAppearance['skin'];
        file.addEventListener('change', async () => {
            if (!file.files?.[0]) return;
            status.textContent = 'Subiendo skin...';
            const form = new FormData(); form.append('skin',file.files[0]);
            try {
                const response = await fetch(serverUrl + '/api/skins', {method:'POST',body:form});
                if (!response.ok) throw new Error('No se pudo subir');
                skin = await response.json() as NonNullable<PlayerAppearance['skin']>;
                mode.value = 'skin'; status.textContent = 'Skin cargada';
            } catch { status.textContent = 'Error al subir skin'; }
        });
        save.onclick = () => {
            const appearance: PlayerAppearance = { mode: mode.value as 'color' | 'skin',colorHex:color.value.toUpperCase(),...((skin ?? this.savedSkin)?{skin:skin ?? this.savedSkin}:{}) };
            onSave(username.value.trim(), appearance);
            status.textContent = 'Enviando cambios...';
        };
        for (const control of [username,color,mode,file,save]) (control as HTMLElement).style.minHeight = '28px';
        div.append(heading,username,color,mode,file,save,status);
        document.body.appendChild(div);
    }
    setProfile(usernameValue: string, appearance: PlayerAppearance) {
        const controls = this.element.querySelectorAll('input, select');
        const name = controls[0] as HTMLInputElement;
        const color = controls[1] as HTMLInputElement;
        const mode = controls[3] as HTMLSelectElement;
        name.value = usernameValue;
        color.value = appearance.colorHex;
        mode.value = appearance.mode;
        this.savedSkin = appearance.skin;
    }
    private savedSkin?: PlayerAppearance['skin'];
    destroy(){this.element.remove();}
}
