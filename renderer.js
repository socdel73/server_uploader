const fs = require('fs');
const os = require('os');
const path = require('path');

const { spawn } = require('child_process');
// --- RSYNC RESOLUTION (robust binary selection) ---
function resolveRsyncBinary() {
  const candidates = [
    '/opt/homebrew/bin/rsync',
    '/usr/local/bin/rsync',
    '/usr/bin/rsync'
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (_) {}
  }
  return 'rsync'; // fallback to PATH
}

function logRsyncInfo() {
  try {
    const bin = resolveRsyncBinary();
    log(`Rsync bin: ${bin}`);
    const v = spawn(bin, ['--version']);
    let outBuf = '';
    v.stdout.on('data', (d) => (outBuf += d.toString()));
    v.on('close', () => {
      const firstLine = outBuf.split('\n')[0] || '';
      if (firstLine) log(`Rsync version: ${firstLine}`);
    });
  } catch (err) {
    log(`ERROR checking rsync version: ${String(err.message || err)}`);
  }
}
// --- END RSYNC RESOLUTION ---

const { ipcRenderer } = require('electron');

const out = document.getElementById('out');
const selLogs = document.getElementById('selLogs');
const btnRefreshLogs = document.getElementById('btnRefreshLogs');
const btnOpenLogsFolder = document.getElementById('btnOpenLogsFolder');
const btnViewLogRaw = document.getElementById('btnViewLogRaw');
const btn = document.getElementById('btnTest');

const profileSelect = document.getElementById('profileSelect');
const activeProfileLabel = document.getElementById('activeProfileLabel');
const remoteDirInput = document.getElementById('remoteDirInput');
const remoteDirDefaultLabel = document.getElementById('remoteDirDefaultLabel');
const remoteRootSelect = document.getElementById('remoteRootSelect');
const btnFetchRemoteDirs = document.getElementById('btnFetchRemoteDirs');
const remoteDirList = document.getElementById('remoteDirList');
const btnUseRemoteDir = document.getElementById('btnUseRemoteDir');
const remoteDirHint = document.getElementById('remoteDirHint');
const newSubfolderInput = document.getElementById('newSubfolderInput');
const btnComposeRemote = document.getElementById('btnComposeRemote');
const uploadsList = document.getElementById('uploadsList');
const btnCancelUpload = document.getElementById('btnCancelUpload');
const chkDeleteOnCancel = document.getElementById('chkDeleteOnCancel');

let activeProfileName = null;
let activeProfile = null;
let configCache = null;

// Remote dir override per profile (in-memory)
const remoteDirByProfile = {};
const remoteRootsByProfile = {};
// Track active uploads (supports parallel uploads)
const activeUploads = new Map(); // uploadId -> { proc, remoteTarget, profile }
let colorIndex = 0;
const COLOR_COUNT = 6;

// Session log file (one per user action)
let currentLogFile = null;

function ensureLogsDir() {
  const dir = path.join(os.homedir(), '.config', 'server_uploader', 'logs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function listLocalLogs() {
  const dir = ensureLogsDir();
  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.log'))
    .map((f) => ({
      name: f,
      full: path.join(dir, f),
      mtime: fs.statSync(path.join(dir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime); // newest first
  return files;
}

function refreshLogsSelect() {
  if (!selLogs) return;
  const logs = listLocalLogs();
  selLogs.innerHTML = '';

  if (!logs.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '(no logs)';
    selLogs.appendChild(opt);
    return;
  }

  for (const l of logs) {
    const opt = document.createElement('option');
    opt.value = l.full;
    opt.textContent = l.name;
    selLogs.appendChild(opt);
  }

  // Keep current selection if possible
  if (currentLogFile && logs.some((l) => l.full === currentLogFile)) {
    selLogs.value = currentLogFile;
  }
}

function viewSelectedLogRaw() {
  if (!selLogs || !out) return;
  const p = selLogs.value;
  if (!p) {
    log('No log selected');
    return;
  }
  try {
    const raw = fs.readFileSync(p, 'utf8');
    out.textContent = raw;
  } catch (err) {
    log(`ERROR reading log: ${String(err.message || err)}`);
  }
}

function tsForFilename(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function startLogSession(kind) {
  const dir = ensureLogsDir();
  currentLogFile = path.join(dir, `${tsForFilename()}_${kind}.log`);
  fs.writeFileSync(currentLogFile, `# server_uploader log\n# kind: ${kind}\n# started: ${new Date().toISOString()}\n\n`, 'utf8');
  refreshLogsSelect();
  return currentLogFile;
}

function log(line) {
  if (!out) {
    console.log(line);
    return;
  }
  out.textContent += line + '\n';
  if (currentLogFile) {
    try {
      fs.appendFileSync(currentLogFile, line + '\n', 'utf8');
    } catch (_) {
      // ignore log write errors
    }
  }
}

function bytesToHuman(bytes) {
  if (!Number.isFinite(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const decimals = i === 0 ? 0 : (i === 1 ? 1 : 2);
  return `${v.toFixed(decimals)} ${units[i]}`;
}

function humanToBytes(token) {
  // Accept formats like: "12345", "12,345,678", "412.34M", "412.34MB", "11.2KB", "1.1GB"
  if (!token) return 0;
  const t = token.trim();
  const plain = t.replace(/,/g, '');
  const m = plain.match(/^(\d+(?:\.\d+)?)([KMGTP]?)(B)?$/i);
  if (!m) return 0;
  const num = Number(m[1]);
  const unit = (m[2] || '').toUpperCase();
  const mult = unit === 'K' ? 1024 : unit === 'M' ? 1024 ** 2 : unit === 'G' ? 1024 ** 3 : unit === 'T' ? 1024 ** 4 : 1;
  return Math.round(num * mult);
}


function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function makeUploadId(prefix = 'u') {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createUploadRow({ uploadId, title, totalBytes, remoteDir }) {
  if (!uploadsList) return null;

  const row = document.createElement('div');
  row.className = 'upload-row';
  row.dataset.uploadId = uploadId;
  row.dataset.color = String(colorIndex % COLOR_COUNT);
  colorIndex += 1;

  const totalText = totalBytes > 0 ? bytesToHuman(totalBytes) : '—';

  row.innerHTML = `
    <div class="upload-grid">
      <div class="upload-label" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
      <div class="mono" data-role="xfer">0 B / ${escapeHtml(totalText)}</div>
      <div class="mono" title="${escapeHtml(remoteDir || '')}">${escapeHtml(remoteDir || '')}</div>
      <div><span class="badge" data-role="status">queued</span></div>
    </div>

    <div class="progress-wrap">
      <div class="progress-bar" data-role="bar" style="width:0%"></div>
    </div>

    <div class="mono" style="margin-top:8px; opacity:.85;" data-role="meta">0% • – • –</div>
  `;

  uploadsList.appendChild(row);
  return row;
}

function updateUploadRow(uploadId, { transferredBytes, totalBytes, percent, speed, eta, status }) {
  if (!uploadsList) return;
  const row = uploadsList.querySelector(`.upload-row[data-upload-id="${uploadId}"]`);
  if (!row) return;

  const bar = row.querySelector('[data-role="bar"]');
  const xfer = row.querySelector('[data-role="xfer"]');
  const meta = row.querySelector('[data-role="meta"]');
  const st = row.querySelector('[data-role="status"]');

  const pct = Number.isFinite(percent)
    ? Math.min(100, Math.max(0, Math.round(percent)))
    : (totalBytes > 0 && Number.isFinite(transferredBytes)
      ? Math.min(100, Math.max(0, Math.round((transferredBytes / totalBytes) * 100)))
      : 0);

  if (bar) bar.style.width = `${pct}%`;

  const totalText = totalBytes > 0 ? bytesToHuman(totalBytes) : '—';
  const xferText = Number.isFinite(transferredBytes) ? bytesToHuman(transferredBytes) : '0 B';
  if (xfer) xfer.textContent = `${xferText} / ${totalText}`;

  const sp = speed || '–';
  const et = eta || '–';
  if (meta) meta.textContent = `${pct}% • ${sp} • ${et}`;

  if (status && st) st.textContent = status;
}

function expandHome(p) {
  if (!p) return p;
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function loadConfig() {
  const configPath = path.join(os.homedir(), '.config', 'server_uploader', 'config.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(raw);
}

function getActiveProfile() {
  const name = activeProfileName || profileSelect.value;
  const profile = activeProfile || (configCache?.profiles ? configCache.profiles[name] : null);
  if (!name || !profile) throw new Error(`Profile not found: ${name || '(none)'}`);
  return { name, profile };
}

function initProfiles(cfg) {
  profileSelect.innerHTML = '';

  Object.keys(cfg.profiles).forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    profileSelect.appendChild(opt);
  });

  const defaultName = cfg.defaultProfile;
  profileSelect.value = defaultName;

  activeProfileName = defaultName;
  activeProfile = cfg.profiles[defaultName];
  activeProfileLabel.textContent = `using: ${defaultName}`;

  remoteDirInput.readOnly = false;

  const profileDefault = (cfg.profiles[defaultName] && cfg.profiles[defaultName].remoteDirDefault) || '';
  const globalDefault = cfg.remoteDirDefault || '';

  // Default shown in UI: per-profile default, falling back to global default.
  remoteDirDefaultLabel.textContent = profileDefault || globalDefault || '(not set)';

  // Current value: in-memory override for this profile, otherwise the defaults.
  remoteDirByProfile[defaultName] = remoteDirByProfile[defaultName] || profileDefault || globalDefault || '';
  remoteDirInput.value = remoteDirByProfile[defaultName];

  // Remote roots per profile (if defined)
  const roots = cfg.profiles[defaultName].remoteRoots || cfg.remoteRoots || ['/srv/storage-media', '/srv/storage-2md'];
  remoteRootsByProfile[defaultName] = roots;
  syncRemoteRootsSelect(roots);
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

// Ensure remoteDir exists and is a directory, or create it. If not a dir, reject.
function ensureRemoteDir(profile, remoteDir) {
  return new Promise((resolve, reject) => {
    const host = profile.host;
    const port = String(profile.port ?? 22);
    const user = profile.user;
    const key = expandHome(profile.identityFile);

    // Resolve symlinks (important: rsync can fail if the dest path is a symlink).
    // Return the resolved path so callers can use it.
    const cmd = `REAL=\"${remoteDir}\"; `
      + `R2=$(readlink -f \"${remoteDir}\" 2>/dev/null); `
      + `if [ -n \"$R2\" ]; then REAL=\"$R2\"; fi; `
      + `if [ -d \"$REAL\" ]; then echo \"$REAL\"; exit 0; fi; `
      + `if [ -e \"$REAL\" ]; then echo \"NOT_A_DIR:$REAL\"; exit 2; fi; `
      + `mkdir -p \"$REAL\" && echo \"$REAL\"`;

    const args = ['-i', key, '-p', port, `${user}@${host}`, cmd];
    const proc = spawn('ssh', args);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => {
      const out = stdout.trim();
      if (code === 0) return resolve(out || remoteDir);
      if (code === 2 || out.startsWith('NOT_A_DIR:')) {
        const p = out.replace(/^NOT_A_DIR:/, '') || remoteDir;
        return reject(new Error(`Remote path exists but is not a directory: ${p}`));
      }
      return reject(new Error(`ssh ensureRemoteDir exit ${code}\n${stderr.trim()}`));
    });
  });
}

function uploadFile(profile, localFile, remoteDir, uploadId, onProgress) {
  return new Promise((resolve, reject) => {
    const host = profile.host;
    const port = String(profile.port ?? 22);
    const user = profile.user;
    const key = expandHome(profile.identityFile);

    const args = [
      '-a',
      '--human-readable',
      '--info=progress2',
      '--exclude=.DS_Store',
      '--exclude=._*',
      '-e',
      `ssh -i ${key} -p ${port}`,
      localFile,
      `${user}@${host}:${remoteDir}/`
    ];

    const rsyncBin = resolveRsyncBinary();
    logRsyncInfo();
    const proc = spawn(rsyncBin, args);
    const remoteTarget = `${remoteDir.replace(/\/+$/, '')}/${path.basename(localFile)}`;
    activeUploads.set(uploadId, { proc, remoteTarget, profile });

    let stdoutBuf = '';
    let stderr = '';

    proc.stdout.on('data', (d) => {
      // rsync updates progress on the same line using carriage returns (\r).
      // Normalize \r to \n so we can parse progress incrementally.
      stdoutBuf += d.toString().replace(/\r/g, '\n');
      const lines = stdoutBuf.split(/\n/);
      stdoutBuf = lines.pop() || '';

      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;

        // Parse rsync progress lines and update UI live WITHOUT spamming the log.
        const pm = line.match(/^([\d.,]+[KMGTP]?B?)\s+(\d+)%\s+(\S+\/s)\s+(\d+:\d+(?::\d+)?)/);
        if (pm && typeof onProgress === 'function') {
          const transferredToken = pm[1];
          const percent = Number(pm[2]);
          const speed = pm[3];
          const eta = pm[4];

          const transferredBytes = humanToBytes(transferredToken);
          onProgress({ transferredBytes, percent, speed, eta });
          continue; // don't append progress lines to the log
        }

        // Keep only non-progress lines (rare) for context/debug
        log(line);
      }
    });

    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      activeUploads.delete(uploadId);
      if (code === 0) {
        resolve('UPLOAD_OK');
      } else {
        reject(new Error(`rsync exit ${code}\n${stderr.trim()}`));
      }
    });
  });
}
function uploadFolder(profile, localDir, remoteDir, uploadId, onProgress) {
  return new Promise((resolve, reject) => {
    const host = profile.host;
    const port = String(profile.port ?? 22);
    const user = profile.user;
    const key = expandHome(profile.identityFile);

    // Always create a subfolder on the server named after the selected folder:
    // remoteDir/<folderName>/...
    const folderName = path.basename(localDir);
    const remoteTarget = `${remoteDir.replace(/\/+$/, '')}/${folderName}`;

    // Ensure the target folder exists on the server
    const mkdirArgs = [
      '-i', key,
      '-p', port,
      `${user}@${host}`,
      `mkdir -p "${remoteTarget}"`
    ];
    const mkdirProc = spawn('ssh', mkdirArgs);

    let mkdirStderr = '';
    mkdirProc.stderr.on('data', (d) => (mkdirStderr += d.toString()));

    mkdirProc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ssh mkdir exit ${code}\n${mkdirStderr.trim()}`));
        return;
      }

      // Copy the CONTENTS of the folder into remoteTarget/ (note the trailing slash on localDir)
      const args = [
        '-a',
        '--human-readable',
        '--info=progress2',
        '--exclude=.DS_Store',
        '--exclude=._*',
        '-e',
        `ssh -i ${key} -p ${port}`,
        `${localDir.replace(/\/+$/, '')}/`,
        `${user}@${host}:${remoteTarget}/`
      ];

      const rsyncBin = resolveRsyncBinary();
      logRsyncInfo();
      const proc = spawn(rsyncBin, args);
      activeUploads.set(uploadId, { proc, remoteTarget, profile });

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

            const transferredBytes = humanToBytes(transferredToken);
            onProgress({ transferredBytes, percent, speed, eta });
            continue; // don't append progress lines to the log
          }

          // Folder sync can print tons of filenames; keep the log clean.
          // If you want verbose filenames later, we can add a "Verbose log" toggle.
          // For now: ignore non-progress stdout lines.
        }
      });

      proc.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      proc.on('close', (code2) => {
        activeUploads.delete(uploadId);
        if (code2 === 0) resolve('UPLOAD_OK');
        else reject(new Error(`rsync exit ${code2}\n${stderr.trim()}`));
      });
    });
  });
}

function listRemoteDirs(profile, rootPath) {
  return new Promise((resolve, reject) => {
    const allowed = profile.remoteRoots || configCache?.remoteRoots || ['/srv/storage-media', '/srv/storage-2md'];
    if (!allowed.includes(rootPath)) {
      reject(new Error('Root path not permès'));
      return;
    }
    const host = profile.host;
    const port = String(profile.port ?? 22);
    const user = profile.user;
    const key = expandHome(profile.identityFile);
    const findCmd = `find ${rootPath} -maxdepth 2 -type d -not -path '*/.*' -print`;
    const args = ['-i', key, '-p', port, `${user}@${host}`, findCmd];
    const proc = spawn('ssh', args);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => {
      if (code === 0) {
        const lines = stdout.split('\n').map((s) => s.trim()).filter(Boolean);
        resolve(lines);
      } else {
        reject(new Error(`ssh find exit ${code}\n${stderr.trim()}`));
      }
    });
  });
}

function deleteRemotePath(profile, remotePath) {
  return new Promise((resolve, reject) => {
    const host = profile.host;
    const port = String(profile.port ?? 22);
    const user = profile.user;
    const key = expandHome(profile.identityFile);
    const cmd = `rm -rf -- \"${remotePath}\"`;
    const args = ['-i', key, '-p', port, `${user}@${host}`, cmd];
    const proc = spawn('ssh', args);
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => {
      if (code === 0) resolve('DELETE_OK');
      else reject(new Error(`ssh rm exit ${code}\n${stderr.trim()}`));
    });
  });
}

btn.addEventListener('click', async () => {
  out.textContent = '';
  try {
    log('Loading config...');
    const cfg = loadConfig();

    const { name, profile } = getActiveProfile();
    log(`Active profile: ${name}`);
    log(`Host: ${profile.user}@${profile.host}:${profile.port ?? 22}`);
    log('Running SSH test...');

    const res = await testSSH(profile);
    log('--- RESULT ---');
    log(res);
  } catch (err) {
    log('--- ERROR ---');
    log(String(err.message || err));
  }
});
const btnUpload = document.getElementById('btnUpload');
const btnUploadFolder = document.getElementById('btnUploadFolder');

btnUpload.addEventListener('click', async () => {
  out.textContent = '';
  if (uploadsList) uploadsList.innerHTML = '';
  startLogSession('upload_files');
  try {
    const { profile } = getActiveProfile();

    // Selecció de fitxer(s)
    const res = await ipcRenderer.invoke('pick-file');

    if (res.canceled || !res.filePaths?.length) {
      log('Upload cancelled');
      return;
    }

    const files = res.filePaths.filter((p) => {
      const base = path.basename(p);
      if (base === '.DS_Store') return false;
      if (base.startsWith('._')) return false;
      return true;
    });

    if (!files.length) {
      log('No valid files selected (macOS metadata files were filtered out).');
      return;
    }

    const remoteDir = remoteDirInput.value.trim();
    if (!remoteDir) {
      throw new Error('Remote dir not set. Enter a server path like /srv/storage-media/uploads_test (per-profile default is shown below).');
    }

    // Remember per-profile override (in-memory)
    remoteDirByProfile[activeProfileName || profileSelect.value] = remoteDir;

    log('Ensuring remote dir exists...');
    const remoteDirResolved = await ensureRemoteDir(profile, remoteDir);

    log(`Remote dir: ${remoteDirResolved}`);
    log(`Files selected: ${files.length}`);

    // Upload in parallel with a small concurrency limit (robust + fast)
    const MAX_PARALLEL = 3;

    async function runPool(items, limit, worker) {
      const executing = new Set();
      const results = [];

      for (const item of items) {
        const p = Promise.resolve().then(() => worker(item));
        results.push(p);
        executing.add(p);

        const clean = () => executing.delete(p);
        p.then(clean).catch(clean);

        if (executing.size >= limit) {
          await Promise.race(executing);
        }
      }

      return Promise.allSettled(results);
    }

    const settled = await runPool(files.map((localFile, idx) => ({ localFile, idx })), MAX_PARALLEL, async ({ localFile, idx }) => {
      const filename = path.basename(localFile);
      const totalBytes = fs.statSync(localFile).size;
      const uploadId = makeUploadId('file');

      createUploadRow({
        uploadId,
        title: `${idx + 1}/${files.length} — ${filename}`,
        totalBytes,
        remoteDir: remoteDirResolved,
      });

      updateUploadRow(uploadId, { status: 'uploading', transferredBytes: 0, totalBytes, percent: 0, speed: '–', eta: '–' });

      log('---');
      log(`Uploading (${idx + 1}/${files.length}): ${localFile}`);

      try {
        const result = await uploadFile(profile, localFile, remoteDirResolved, uploadId, ({ transferredBytes, percent, speed, eta }) => {
          updateUploadRow(uploadId, { transferredBytes, totalBytes, percent, speed, eta, status: 'uploading' });
        });

        updateUploadRow(uploadId, { transferredBytes: totalBytes, totalBytes, percent: 100, speed: '-', eta: '0:00:00', status: 'done' });
        log(`Result: ${result}`);
      } catch (err) {
        updateUploadRow(uploadId, { status: 'error', speed: '–', eta: '–' });
        log(`ERROR (${idx + 1}/${files.length}): ${String(err.message || err)}`);
        throw err;
      }
    });

    const failed = settled.filter((r) => r.status === 'rejected');
    if (failed.length) {
      log('---');
      log(`Finished with errors: ${failed.length}/${files.length}`);
      failed.forEach((r) => log(String(r.reason?.message || r.reason || r)));
    } else {
      log('---');
      log('All uploads finished.');
      if (currentLogFile) log(`Log saved: ${currentLogFile}`);
    }
  } catch (err) {
    log('--- ERROR ---');
    log(String(err.message || err));
    if (currentLogFile) log(`Log saved: ${currentLogFile}`);
  }
});

if (btnUploadFolder) {
  btnUploadFolder.addEventListener('click', async () => {
    out.textContent = '';
    if (uploadsList) uploadsList.innerHTML = '';
    startLogSession('upload_folder');
    try {
      const { profile } = getActiveProfile();

      const remoteDir = remoteDirInput.value.trim();
      if (!remoteDir) {
        throw new Error('Remote dir not set. Enter a server path like /srv/storage-media/uploads_test (per-profile default is shown below).');
      }

      remoteDirByProfile[activeProfileName || profileSelect.value] = remoteDir;

      log('Ensuring remote dir exists...');
      const remoteDirResolved = await ensureRemoteDir(profile, remoteDir);

      // Select a local folder
      const res = await ipcRenderer.invoke('pick-folder');
      if (res.canceled || !res.filePaths?.length) {
        log('Upload folder cancelled');
        return;
      }

      const localDir = res.filePaths[0];
      const folderName = path.basename(localDir);

      // Unknown total without scanning; show percent + transferred.
      const uploadId = makeUploadId('folder');
      createUploadRow({ uploadId, title: `folder — ${folderName}`, totalBytes: 0, remoteDir: remoteDirResolved });
      updateUploadRow(uploadId, { status: 'uploading', transferredBytes: 0, totalBytes: 0, percent: 0, speed: '–', eta: '–' });

      log(`Remote dir: ${remoteDirResolved}`);
      log(`Uploading folder: ${localDir}`);
      log('Uploading folder via rsync (SSH)...');

      try {
        const result = await uploadFolder(profile, localDir, remoteDirResolved, uploadId, ({ transferredBytes, percent, speed, eta }) => {
          updateUploadRow(uploadId, { transferredBytes, totalBytes: 0, percent, speed, eta, status: 'uploading' });
        });

        log(`Result: ${result}`);
        updateUploadRow(uploadId, { transferredBytes: 0, totalBytes: 0, percent: 100, speed: '-', eta: '0:00:00', status: 'done' });
        log('---');
        log('Folder upload finished.');
        if (currentLogFile) log(`Log saved: ${currentLogFile}`);
      } catch (err) {
        updateUploadRow(uploadId, { status: 'error', speed: '–', eta: '–' });
        log(`ERROR folder: ${String(err.message || err)}`);
        throw err;
      }
    } catch (err) {
      log('--- ERROR ---');
      log(String(err.message || err));
      if (currentLogFile) log(`Log saved: ${currentLogFile}`);
    }
  });
}

profileSelect.addEventListener('change', () => {
  const name = profileSelect.value;
  activeProfileName = name;
  activeProfile = configCache.profiles[name];
  activeProfileLabel.textContent = `using: ${name}`;
  log(`Profile changed to: ${name}`);

  const profileDefault = (configCache.profiles[name] && configCache.profiles[name].remoteDirDefault) || '';
  const globalDefault = configCache.remoteDirDefault || '';

  remoteDirDefaultLabel.textContent = profileDefault || globalDefault || '(not set)';

  remoteDirByProfile[name] = remoteDirByProfile[name] || profileDefault || globalDefault || '';
  remoteDirInput.value = remoteDirByProfile[name];

  const roots = configCache.profiles[name].remoteRoots || configCache.remoteRoots || ['/srv/storage-media', '/srv/storage-2md'];
  remoteRootsByProfile[name] = roots;
  syncRemoteRootsSelect(roots);
});

function syncRemoteRootsSelect(roots) {
  if (!remoteRootSelect) return;
  remoteRootSelect.innerHTML = '';
  roots.forEach((r) => {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r;
    remoteRootSelect.appendChild(opt);
  });
}

if (btnFetchRemoteDirs && remoteDirList) {
  btnFetchRemoteDirs.addEventListener('click', async () => {
    try {
      const root = remoteRootSelect.value;
      const { profile } = getActiveProfile();
      remoteDirList.innerHTML = '<option value=\"\">(carregant...)</option>';
      const dirs = await listRemoteDirs(profile, root);
      remoteDirList.innerHTML = '';
      dirs.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        remoteDirList.appendChild(opt);
      });
      if (!dirs.length) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '(sense resultats)';
        remoteDirList.appendChild(opt);
      }
      remoteDirHint.textContent = `Llistat ${dirs.length} directoris sota ${root}`;
    } catch (err) {
      remoteDirHint.textContent = `ERROR: ${String(err.message || err)}`;
    }
  });
}

if (btnUseRemoteDir && remoteDirList) {
  btnUseRemoteDir.addEventListener('click', () => {
    const val = remoteDirList.value;
    if (val) {
      remoteDirInput.value = val;
      log(`Remote dir seleccionat: ${val}`);
    }
  });
}

function joinRemotePath(base, sub) {
  const cleanBase = (base || '').replace(/\/+$/, '');
  const cleanSub = (sub || '').replace(/^\/+/, '');
  return cleanSub ? `${cleanBase}/${cleanSub}` : cleanBase;
}

if (btnComposeRemote && newSubfolderInput) {
  btnComposeRemote.addEventListener('click', () => {
    const baseFromList = remoteDirList.value || remoteRootSelect?.value || '';
    const sub = newSubfolderInput.value.trim();
    if (!baseFromList) {
      remoteDirHint.textContent = 'Selecciona una base o carpeta llistada primer.';
      return;
    }
    const composed = joinRemotePath(baseFromList, sub);
    remoteDirInput.value = composed;
    log(`Remote dir establert: ${composed}`);
  });
}

if (btnCancelUpload) {
  btnCancelUpload.addEventListener('click', async () => {
    if (activeUploads.size === 0) {
      log('No hi ha cap upload en curs');
      return;
    }

    log(`Cancel·lant ${activeUploads.size} upload(s) en curs...`);

    const entries = Array.from(activeUploads.entries());

    // First, signal all rsync processes
    for (const [uploadId, info] of entries) {
      try {
        info.proc.kill('SIGINT');
        updateUploadRow(uploadId, { status: 'cancelling' });
      } catch (_) {
        // ignore
      }
    }

    // Optionally delete remote targets
    if (chkDeleteOnCancel?.checked) {
      for (const [uploadId, info] of entries) {
        if (!info.remoteTarget || !info.profile) continue;
        try {
          const res = await deleteRemotePath(info.profile, info.remoteTarget);
          log(`Remote esborrat (${uploadId}): ${res}`);
        } catch (err) {
          log(`ERROR esborrant remot (${uploadId}): ${String(err.message || err)}`);
        }
      }
    }
  });
}

function bootstrap() {
  try {
    configCache = loadConfig();
    initProfiles(configCache);
    log('Config loaded');
    refreshLogsSelect();
  } catch (err) {
    log('ERROR loading config');
    log(String(err.message || err));
  }
}

// --- Log UI (raw viewer) ---
if (btnRefreshLogs) {
  btnRefreshLogs.addEventListener('click', () => {
    try {
      refreshLogsSelect();
      log('Logs refreshed');
    } catch (err) {
      log(`ERROR refreshing logs: ${String(err.message || err)}`);
    }
  });
}

if (btnViewLogRaw) {
  btnViewLogRaw.addEventListener('click', () => {
    viewSelectedLogRaw();
  });
}

if (selLogs) {
  selLogs.addEventListener('change', () => {
    // lightweight: don't auto-load on change; keep it manual unless you prefer auto.
    // If you want auto-load, uncomment next line:
    // viewSelectedLogRaw();
  });
}

if (btnOpenLogsFolder) {
  btnOpenLogsFolder.addEventListener('click', async () => {
    try {
      const dir = await ipcRenderer.invoke('open-logs-folder');
      log(`Opened logs folder: ${dir}`);
    } catch (err) {
      log(`ERROR opening logs folder: ${String(err.message || err)}`);
    }
  });
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
