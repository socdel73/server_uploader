# Server Uploader

App d’escriptori (Electron) per pujar fitxers i carpetes via SSH/rsync amb perfils configurables.

## Funcions
- Perfils múltiples amb clau SSH.
- Test ràpid de connexió.
- Pujada de fitxers i carpetes amb barra de progrés.
- Selector assistit de destins remots per perfil (`remoteRoots`) amb llistat via SSH.
- Possibilitat d’afegir subcarpeta nova al camí seleccionat.
- Cancel·lar l’upload i, opcionalment, esborrar el destí parcial.

## Requisits
- Node 18+ (Electron 40).
- `ssh` i `rsync` instal·lats al sistema.
- Fitxer de config local a `~/.config/server_uploader/config.json`.

## Configuració
Exemple:
```json
{
  "version": 1,
  "defaultProfile": "nebraska",
  "remoteRoots": ["/srv/storage-media", "/srv/storage-2md"],
  "profiles": {
    "nebraska": {
      "type": "ssh",
      "host": "192.168.1.35",
      "port": 22,
      "user": "d",
      "identityFile": "~/.ssh/id_ed25519",
      "remoteRoots": ["/srv/storage-media", "/srv/storage-2md"]
    },
    "thunder": {
      "type": "ssh",
      "host": "100.117.100.37",
      "port": 22,
      "user": "superhero",
      "identityFile": "~/.ssh/id_ed25519",
      "remoteRoots": ["/srv/ftp", "/srv"]
    }
  }
}
```

## Ús
```bash
npm install
npm start
```
1. Tria perfil.
2. (Opcional) Llista destins amb “Llistar”, tria base/subcarpeta o escriu-ne una de nova.
3. Test de connexió o clica “Upload file(s)” / “Upload folder”.
4. Per cancel·lar, usa “Cancel·la upload” i marca “Esborra remot” si vols borrar el destí parcial.

## Notes
- `config.json` està ignorat al repo (`.gitignore`).
- El llistat de carpetes es limita a les `remoteRoots` del perfil o globals.

## Llicència
MIT
