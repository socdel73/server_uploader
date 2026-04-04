# Server Uploader

Desktop app built with Electron to upload files and folders to remote servers over SSH and `rsync`.

It is designed as a practical local utility for people who want a simple UI for recurring uploads without hardcoding server paths into the app itself.

## Features

- Multiple SSH profiles
- Per-profile remote roots
- Remote destination builder
- File uploads
- Folder uploads
- Parallel file uploads
- Upload queue with progress cards
- Connection test
- Session logs with local history
- Optional remote cleanup after cancel

## Requirements

- Node.js 18+
- `ssh` installed on the local machine
- `rsync` installed on the local machine
- Local config file at `~/.config/server_uploader/config.json`

## Install

```bash
npm install
npm start
```

## Configuration

Copy the example config and adapt it to your own servers:

```bash
mkdir -p ~/.config/server_uploader
cp config.example.json ~/.config/server_uploader/config.json
```

The app reads configuration from:

```text
~/.config/server_uploader/config.json
```

## Example config

```json
{
  "version": 1,
  "defaultProfile": "production",
  "remoteRoots": ["/srv/www", "/var/www"],
  "remoteDirDefault": "/srv/www/uploads",
  "profiles": {
    "production": {
      "type": "ssh",
      "host": "your-server.example.com",
      "port": 22,
      "user": "deploy",
      "identityFile": "~/.ssh/id_ed25519",
      "knownHosts": "~/.ssh/known_hosts",
      "remoteRoots": ["/srv/www", "/var/www"],
      "remoteDirDefault": "/srv/www/uploads"
    },
    "staging": {
      "type": "ssh",
      "host": "staging.example.com",
      "port": 22,
      "user": "deploy",
      "identityFile": "~/.ssh/id_ed25519",
      "knownHosts": "~/.ssh/known_hosts",
      "remoteRoots": ["/srv/staging", "/var/www/staging"],
      "remoteDirDefault": "/srv/staging/uploads"
    }
  }
}
```

## Config fields

- `defaultProfile`: profile loaded on startup
- `remoteRoots`: global fallback base directories
- `remoteDirDefault`: optional default remote path
- `profiles`: named SSH profiles

Per profile:

- `host`: server hostname or IP
- `port`: SSH port
- `user`: SSH user
- `identityFile`: local private key path
- `knownHosts`: optional known hosts path
- `remoteRoots`: allowed base directories for that profile
- `remoteDirDefault`: optional default destination path

## Usage

1. Select a profile.
2. Review or edit the destination path.
3. Optionally list remote directories under one of the configured roots.
4. Use `Test connection` to verify SSH access.
5. Upload files or a folder.
6. Review progress cards and logs.

## Notes

- The repo does not include real server credentials.
- All server-specific paths should live in local config, not in the codebase.
- `config.json` is intentionally ignored by Git.
- The current UI follows the shared brand direction used across related local tools.

## License

MIT
