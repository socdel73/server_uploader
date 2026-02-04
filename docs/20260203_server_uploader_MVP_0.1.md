# Server Uploader — MVP 0.1
**Data:** 2026-02-03  
**Projecte:** server_uploader  
**Plataforma:** macOS (Electron + Node.js)

---

## 1. Objectiu del projecte
Crear una aplicació d’escriptori que permeti:
- Connectar-se a servidors via SSH (clau + Keychain)
- Pujar fitxers via SFTP
- Sincronitzar carpetes (rsync, fase posterior)
- Gestionar múltiples perfils de connexió
Tot amb una interfície simple i controlada.

---

## 2. Decisions clau
- **Electron** com a base (UI + Node.js)
- **OpenSSH del sistema** (no llibreries externes)
- **Clau SSH gestionada pel sistema** (Keychain)
- **Config per perfils** via JSON
- **IPC** (Electron modern, sense `remote`)
- **SFTP no interactiu** via `stdin`

Aquestes decisions prioritzen:
- Simplicitat
- Robustesa
- Traçabilitat
- Zero passwords dins l’app

---

## 3. Estructura del projecte

```
server_uploader/
├── main.js
├── renderer.js
├── index.html
├── package.json
├── docs/
│   └── 20260203_server_uploader_MVP_0.1.md
```

---

## 4. Configuració

### Fitxer
```
~/.config/server_uploader/config.json
```

### Exemple real (nebraska)
```json
{
  "version": 1,
  "defaultProfile": "nebraska",
  "remoteDirDefault": "/srv/storage-media/uploads_test",
  "remoteRoots": ["/srv/storage-media", "/srv/storage-2md"],  // opcional fallback per tots els perfils
  "profiles": {
    "nebraska": {
      "type": "ssh",
      "host": "192.168.1.35",
      "port": 22,
      "user": "d",
      "identityFile": "~/.ssh/id_ed25519",
      "remoteRoots": ["/srv/storage-media", "/srv/storage-2md"]  // opcional, prioritza sobre remoteRoots global
    }
  }
}
```

---

## 5. Codi — punts clau

### main.js
- Crea la finestra Electron
- Gestiona IPC
- Obre selector de fitxers (dialog)

```js
ipcMain.handle('pick-file', async () => {
  return dialog.showOpenDialog({ properties: ['openFile'] });
});
```

### renderer.js
Responsabilitats:
- Llegir config
- Seleccionar perfil actiu
- Executar SSH test
- Executar upload SFTP

Upload via SFTP:
```js
spawn('sftp', ['-i', key, '-P', port, `${user}@${host}`]);
```

---

## 6. Validacions reals

### Test SSH
Output:
```
CONNECT_OK
d
nebraska
```

### Upload SFTP
Output:
```
UPLOAD_OK
```

Fitxer pujat correctament a:
```
/srv/storage-media/uploads_test
```

---

## 7. Estat actual (MVP 0.1)
- [x] App Electron funcional
- [x] Config per perfils
- [x] Test SSH
- [x] Upload SFTP (1 fitxer)
- [x] IPC correcte (Electron modern)
- [ ] Selector de perfil (pendent)
- [ ] Ruta remota editable (pendent)
- [ ] Sync carpeta (rsync)

---

## 8. Properes fases
1. Selector de perfil (UI)
2. Remote path editable (amb default)
3. Sync carpeta via rsync
4. UI polish
5. Packaging (.app)

---

## 9. Notes
Aquest document és el **punt canònic** del projecte.
Qualsevol canvi important s’ha de reflectir aquí.
