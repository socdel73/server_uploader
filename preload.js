const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const CONFIG_PATH = path.join(os.homedir(), '.config', 'server_uploader', 'config.json');

function shellQuote(str) {
  // Safe for remote shell: wrap in single quotes and escape existing ones
  return `'${String(str).replace(/'/g, `'"'"'`)}'`;
}

function expandHome(p) {
  if (!p) return p;
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function sanitizeRemotePath(p) {
  if (typeof p !== 'string' || !p.trim()) {
    throw new Error('Remote dir not set');
  }
  // Prevent newlines or control chars that could break remote shell
  if (/[\\r\\n\\t]/.test(p)) {
    throw new Error('Remote dir contains invalid characters');
  }
  return p.replace(/\/+/g, '/');
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const cfg = JSON.parse(raw);
    if (!cfg.profiles || typeof cfg.profiles !== 'object') {
      throw new Error('Config missing "profiles"');
    }
    return { ok: true, config: cfg };
  } catch (err) {
    return { ok: false, error: err.message, path: CONFIG_PATH };
  }
}

function testSSH(profile) {
  return new Promise((resolve, reject) => {
    const host = profile.host;
    const port = String(profile.port ?? 22);
    const user = profile.user;
    const key = expandHome(profile.identityFile);

    const args = [
      '-i', key,
      '-p', port,
      `${user}@${host}`,
      'echo CONNECT_OK && whoami && hostname'
    ];

    const proc = spawn('ssh', args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));

    proc.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`ssh exit ${code}\n${stderr.trim()}`));
    });
  });
}

function uploadFile(profile, localFile, remoteDir, onProgress) {
  return new Promise((resolve, reject) => {
    const host = profile.host;
    const port = String(profile.port ?? 22);
    const user = profile.user;
    const key = expandHome(profile.identityFile);

    const safeRemote = sanitizeRemotePath(remoteDir).replace(/\/+$/, '');
    const remoteSpec = `${user}@${host}:${safeRemote}/`;
    const sshCmd = ['ssh', '-i', key, '-p', port].join(' ');

    const args = [
      '-a',
      '-s', // protect-args: keep spaces/backslashes intact
      '--human-readable',
      '--info=progress2',
      '--exclude=.DS_Store',
      '--exclude=._*',
      '-e',
      sshCmd,
      localFile,
      remoteSpec
    ];

    const proc = spawn('rsync', args);

    let stdoutBuf = '';
    let stderr = '';

    proc.stdout.on('data', (d) => {
      stdoutBuf += d.toString().replace(/\r/g, '\n');
      const lines = stdoutBuf.split(/\n/);
      stdoutBuf = lines.pop() || '';

      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        const pm = line.match(/^([\d.,]+[KMGTP]?B?)\s+(\d+)%\s+(\S+\/s)\s+(\d+:\d+(?::\d+)?)/);
        if (pm && typeof onProgress === 'function') {
          const transferredToken = pm[1];
          const percent = Number(pm[2]);
          const speed = pm[3];
          const eta = pm[4];
          onProgress({ transferredToken, percent, speed, eta });
          continue;
        }
      }
    });

    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) resolve('UPLOAD_OK');
      else reject(new Error(`rsync exit ${code}\n${stderr.trim()}`));
    });
  });
}

function uploadFolder(profile, localDir, remoteDir, onProgress) {
  return new Promise((resolve, reject) => {
    const host = profile.host;
    const port = String(profile.port ?? 22);
    const user = profile.user;
    const key = expandHome(profile.identityFile);

    const safeRemoteDir = sanitizeRemotePath(remoteDir).replace(/\/+$/, '');
    const folderName = path.basename(localDir);
    const remoteTarget = `${safeRemoteDir}/${folderName}`;

    const mkdirCmd = `mkdir -p -- ${shellQuote(remoteTarget)}`;
    const mkdirArgs = ['-i', key, '-p', port, `${user}@${host}`, mkdirCmd];
    const mkdirProc = spawn('ssh', mkdirArgs);

    let mkdirStderr = '';
    mkdirProc.stderr.on('data', (d) => (mkdirStderr += d.toString()));

    mkdirProc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ssh mkdir exit ${code}\n${mkdirStderr.trim()}`));
        return;
      }

      const remoteSpec = `${user}@${host}:${remoteTarget}/`;
      const sshCmd = ['ssh', '-i', key, '-p', port].join(' ');
      const args = [
        '-a',
        '-s', // protect-args: keep spaces/backslashes intact
        '--human-readable',
        '--info=progress2',
        '--exclude=.DS_Store',
        '--exclude=._*',
        '-e',
        sshCmd,
        `${localDir.replace(/\/+$/, '')}/`,
        remoteSpec
      ];

      const proc = spawn('rsync', args);
      let stdoutBuf = '';
      let stderr = '';

      proc.stdout.on('data', (d) => {
        stdoutBuf += d.toString().replace(/\r/g, '\n');
        const lines = stdoutBuf.split(/\n/);
        stdoutBuf = lines.pop() || '';

        for (const raw of lines) {
          const line = raw.trim();
          if (!line) continue;
          const pm = line.match(/^([\d.,]+[KMGTP]?B?)\s+(\d+)%\s+(\S+\/s)\s+(\d+:\d+(?::\d+)?)/);
          if (pm && typeof onProgress === 'function') {
            const transferredToken = pm[1];
            const percent = Number(pm[2]);
            const speed = pm[3];
            const eta = pm[4];
            onProgress({ transferredToken, percent, speed, eta });
            continue;
          }
        }
      });

      proc.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      proc.on('close', (code2) => {
        if (code2 === 0) resolve('UPLOAD_OK');
        else reject(new Error(`rsync exit ${code2}\n${stderr.trim()}`));
      });
    });
  });
}

contextBridge.exposeInMainWorld('api', {
  pickFiles: () => ipcRenderer.invoke('pick-file'),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  loadConfig,
  testSSH,
  uploadFile,
  uploadFolder,
  pathBasename: (p) => path.basename(p),
  fileSize: (p) => fs.statSync(p).size,
});
