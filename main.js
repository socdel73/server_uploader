const { app, BrowserWindow, ipcMain, dialog, screen, shell } = require('electron');
const path = require('path');

const fs = require('fs');
const os = require('os');

function createWindow() {
  // Target content width: 670px (excluding body padding/margins). With current body padding (18px each side)
  // we start around 670 + 36 = 706px and then auto-fit to actual layout after load.
  const win = new BrowserWindow({
    width: 720,
    height: 900, // temporary; will be auto-fit after load
    minWidth: 720,
    minHeight: 760,
    useContentSize: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));

  win.webContents.on('did-finish-load', async () => {
    try {
      const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

      const { w, h } = await win.webContents.executeJavaScript(`
        ({
          w: Math.ceil(document.documentElement.scrollWidth),
          h: Math.ceil(document.documentElement.scrollHeight)
        })
      `);

      // Add a small margin; cap to available screen size
      const targetW = Math.min(w + 24, screenW);
      const targetH = Math.min(h + 24, screenH);

      win.setContentSize(targetW, targetH);
    } catch (_) {
      // ignore sizing errors
    }
  });
}

ipcMain.handle('pick-file', async () => {
  const res = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections']
  });
  return res;
});

ipcMain.handle('pick-folder', async () => {
  const res = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return res;
});

// Backward-compatible alias (some renderer code may still call this)
ipcMain.handle('pick-directory', async () => {
  const res = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return res;
});

ipcMain.handle('open-logs-folder', async () => {
  const logsDir = path.join(os.homedir(), '.config', 'server_uploader', 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  await shell.openPath(logsDir);
  return logsDir;
});

app.whenReady().then(createWindow);
