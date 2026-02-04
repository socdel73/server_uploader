const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
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

app.whenReady().then(createWindow);
