const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const { ipcRenderer } = require('electron');

const out = document.getElementById('out');
const btn = document.getElementById('btnTest');

const profileSelect = document.getElementById('profileSelect');
const activeProfileLabel = document.getElementById('activeProfileLabel');
const remoteDirInput = document.getElementById('remoteDirInput');
const remoteDirDefaultLabel = document.getElementById('remoteDirDefaultLabel');
const uploadProgressWrap = document.getElementById('uploadProgressWrap');
const uploadFileNameEl = document.getElementById('uploadFileName');
const uploadProgressBar = document.getElementById('uploadProgressBar');
const uploadTransferredEl = document.getElementById('uploadTransferred');
const uploadTotalEl = document.getElementById('uploadTotal');
const uploadPercentEl = document.getElementById('uploadPercent');
const uploadSpeedEl = document.getElementById('uploadSpeed');

const uploadEtaEl = document.getElementById('uploadEta');

let activeProfileName = null;
let activeProfile = null;
let configCache = null;

// Remote dir override per profile (in-memory)
const remoteDirByProfile = {};

function log(line) {
  if (!out) {
    console.log(line);
    return;
  }
  out.textContent += line + '\n';
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

function showProgressUI(show) {
  if (!uploadProgressWrap) return;
  uploadProgressWrap.style.display = show ? 'block' : 'none';
}

function resetProgressUI(filename, totalBytes) {
  showProgressUI(true);
  if (uploadFileNameEl) uploadFileNameEl.textContent = filename || 'Upload';
  if (uploadProgressBar) uploadProgressBar.value = 0;
  if (uploadTransferredEl) uploadTransferredEl.textContent = bytesToHuman(0);
  if (uploadTotalEl) uploadTotalEl.textContent = totalBytes ? bytesToHuman(totalBytes) : '—';
  if (uploadPercentEl) uploadPercentEl.textContent = '0';
  if (uploadSpeedEl) uploadSpeedEl.textContent = '–';
  if (uploadEtaEl) uploadEtaEl.textContent = '–';
}

function updateProgressUI(transferredBytes, totalBytes, speed, eta, pctOverride) {
  const pct = Number.isFinite(pctOverride)
    ? Math.min(100, Math.max(0, Math.round(pctOverride)))
    : (totalBytes > 0 ? Math.min(100, Math.max(0, Math.round((transferredBytes / totalBytes) * 100))) : 0);
  if (uploadProgressBar) uploadProgressBar.value = pct;
  if (uploadTransferredEl) uploadTransferredEl.textContent = bytesToHuman(transferredBytes);
  if (uploadTotalEl) uploadTotalEl.textContent = bytesToHuman(totalBytes);
  if (uploadPercentEl) uploadPercentEl.textContent = String(pct);
  if (uploadSpeedEl) uploadSpeedEl.textContent = speed || '–';
  if (uploadEtaEl) uploadEtaEl.textContent = eta || '–';
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

    const proc = spawn('rsync', args);

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
      if (code === 0) {
        resolve('UPLOAD_OK');
      } else {
        reject(new Error(`rsync exit ${code}\n${stderr.trim()}`));
      }
    });
  });
}
function uploadFolder(profile, localDir, remoteDir, onProgress) {
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
        if (code2 === 0) resolve('UPLOAD_OK');
        else reject(new Error(`rsync exit ${code2}\n${stderr.trim()}`));
      });
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

    log(`Remote dir: ${remoteDir}`);
    log(`Files selected: ${files.length}`);

    // Upload sequentially (simple + robust)
    for (let i = 0; i < files.length; i += 1) {
      const localFile = files[i];
      const filename = path.basename(localFile);
      const totalBytes = fs.statSync(localFile).size;

      // Reset per-file progress UI
      resetProgressUI(`${i + 1}/${files.length} — ${filename}`, totalBytes);

      log('---');
      log(`Uploading (${i + 1}/${files.length}): ${localFile}`);
      log('Uploading via rsync (SSH)...');

      const result = await uploadFile(profile, localFile, remoteDir, ({ transferredBytes, percent, speed, eta }) => {
        updateProgressUI(transferredBytes, totalBytes, speed, eta, percent);
      });

      log(`Result: ${result}`);
      updateProgressUI(totalBytes, totalBytes, '-', '0:00:00', 100);
    }

    log('---');
    log('All uploads finished.');
  } catch (err) {
    showProgressUI(false);
    log('--- ERROR ---');
    log(String(err.message || err));
  }
});

if (btnUploadFolder) {
  btnUploadFolder.addEventListener('click', async () => {
    out.textContent = '';
    try {
      const { profile } = getActiveProfile();

      const remoteDir = remoteDirInput.value.trim();
      if (!remoteDir) {
        throw new Error('Remote dir not set. Enter a server path like /srv/storage-media/uploads_test (per-profile default is shown below).');
      }

      remoteDirByProfile[activeProfileName || profileSelect.value] = remoteDir;

      // Select a local folder
      const res = await ipcRenderer.invoke('pick-folder');
      if (res.canceled || !res.filePaths?.length) {
        log('Upload folder cancelled');
        return;
      }

      const localDir = res.filePaths[0];
      const folderName = path.basename(localDir);

      // Unknown total without scanning; show percent + transferred.
      resetProgressUI(`folder — ${folderName}`, 0);

      log(`Remote dir: ${remoteDir}`);
      log(`Uploading folder: ${localDir}`);
      log('Uploading folder via rsync (SSH)...');

      const result = await uploadFolder(profile, localDir, remoteDir, ({ transferredBytes, percent, speed, eta }) => {
        updateProgressUI(transferredBytes, 0, speed, eta, percent);
      });

      log(`Result: ${result}`);
      updateProgressUI(0, 0, '-', '0:00:00', 100);
      log('---');
      log('Folder upload finished.');
    } catch (err) {
      showProgressUI(false);
      log('--- ERROR ---');
      log(String(err.message || err));
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
});

function bootstrap() {
  try {
    configCache = loadConfig();
    initProfiles(configCache);
    log('Config loaded');
  } catch (err) {
    log('ERROR loading config');
    log(String(err.message || err));
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
