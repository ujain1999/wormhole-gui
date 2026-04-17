const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode');

let mainWindow;

const WORMHOLE_BINARY = (() => {
  const platform = os.platform();
  const ext = platform === 'win32' ? '.exe' : '';

  const isDev = !app.isPackaged;
  const basePath = isDev ? __dirname : path.join(process.resourcesPath);

  const localPath = path.join(basePath, 'bin', `wormhole-william${ext}`);
  if (fs.existsSync(localPath)) {
    return localPath;
  }

  const devPath = path.join(__dirname, 'bin', `wormhole-william${ext}`);
  if (fs.existsSync(devPath)) {
    return devPath;
  }

  return `wormhole-william${ext}`;
})();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 720,
    minWidth: 400,
    minHeight: 600,
    frame: true,
    resizable: true,
    backgroundColor: '#FAFAFA',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('get-default-download-path', () => {
  return app.getPath('downloads');
});

ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections']
  });
  return result.canceled ? null : result.filePaths;
});

let pendingReceive = null;

ipcMain.handle('receive-file', async (event, { code, outputPath }) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wormhole-'));

  return new Promise((resolve, reject) => {
    const args = ['receive', code];

    const options = {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: tempDir
    };

    console.log('[wormhole] Temp dir:', tempDir);
    console.log('[wormhole] Output dir:', outputPath);

    let fileName = '';
    let fileSize = 0;
    let confirmed = false;

    const sendProgress = (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('receive-progress', data);
      }
    };

    const wormhole = spawn(WORMHOLE_BINARY, args, options);

    sendProgress({ stage: 'connecting', message: 'Connecting...' });

    wormhole.stdout.on('data', (data) => {
      const text = data.toString();
      console.log('[wormhole stdout]', text);

      if (!confirmed) {
        const sizeMatch = text.match(/\((\d+(?:\.\d+)?)\s*([KMGT]?B)\)/i);
        if (sizeMatch) {
          const num = parseFloat(sizeMatch[1]);
          const unit = sizeMatch[2].toUpperCase();
          const multipliers = { 'B': 1, 'KB': 1024, 'MB': 1024**2, 'GB': 1024**3, 'TB': 1024**4 };
          fileSize = Math.round(num * (multipliers[unit] || 1));
        }

        const nameMatch = text.match(/into:\s*(.+?)(?:\n|$)/i);
        if (nameMatch) {
          fileName = nameMatch[1].trim();
        }

        if (text.includes('ok? (y/N):') || text.includes('ok? (y/n):')) {
          console.log('[wormhole] Awaiting confirmation for:', fileName);
          sendProgress({
            stage: 'confirm',
            message: 'Confirm transfer?',
            fileName,
            fileSize
          });

          pendingReceive = {
            accept: () => {
              confirmed = true;
              pendingReceive = null;
              console.log('[wormhole] User accepted');
              sendProgress({ stage: 'accepted', message: 'Accepted, transferring...' });
              wormhole.stdin.write('y\n');
            },
            reject: () => {
              confirmed = true;
              pendingReceive = null;
              console.log('[wormhole] User rejected');
              sendProgress({ stage: 'rejected', message: 'Transfer rejected' });
              wormhole.stdin.write('n\n');
            }
          };
        }
      }

      if (confirmed) {
        if (text.includes('%')) {
          const percentMatch = text.match(/(\d+)%/);
          if (percentMatch) {
            const percent = parseInt(percentMatch[1]);
            sendProgress({
              stage: 'progress',
              message: `${percent}%`,
              percent,
              fileName,
              fileSize
            });
          }
        }

        if (text.includes('Sent') || text.includes('complete') || text.includes('received')) {
          sendProgress({ stage: 'complete', message: 'Transfer complete!', fileName });
        }
      }
    });

    wormhole.stderr.on('data', (data) => {
      const text = data.toString();
      console.log('[wormhole stderr]', text);

      if (text.includes('transfer rejected') || text.includes('declined')) {
        sendProgress({ stage: 'rejected', message: 'Transfer rejected by sender' });
      }
    });

    wormhole.on('close', (code) => {
      console.log('[wormhole close]', code);

      pendingReceive = null;

      if (code === 0 && confirmed) {
        try {
          const files = fs.readdirSync(tempDir);
          console.log('[wormhole] Files in temp dir:', files);

          if (files.length > 0 && outputPath) {
            for (const file of files) {
              const src = path.join(tempDir, file);

              if (fs.statSync(src).isFile()) {
                let dest = path.join(outputPath, file);
                const ext = path.extname(file);
                const base = path.basename(file, ext);

                if (fs.existsSync(dest)) {
                  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                  const newFileName = `${base}-${timestamp}${ext}`;
                  dest = path.join(outputPath, newFileName);
                  console.log('[wormhole] File exists, renaming to:', newFileName);
                }

                fs.copyFileSync(src, dest);
                console.log('[wormhole] Moved', file, 'to', dest);
              }
            }
          }
        } catch (err) {
          console.error('[wormhole] Error moving file:', err);
        }

        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {}

        sendProgress({ stage: 'complete', message: 'Transfer complete!', fileName });
        resolve({ success: true, fileName, fileSize });
      } else if (!confirmed) {
        resolve({ success: false, error: 'Transfer cancelled' });
      } else {
        sendProgress({ stage: 'error', message: 'Transfer failed' });
        resolve({ success: false, error: 'Transfer failed' });
      }
    });

    wormhole.on('error', (err) => {
      console.error('[wormhole error]', err);
      pendingReceive = null;
      sendProgress({ stage: 'error', message: err.message });
      resolve({ success: false, error: err.message });
    });
  });
});

ipcMain.handle('confirm-receive', (event, accepted) => {
  if (pendingReceive) {
    if (accepted) {
      pendingReceive.accept();
    } else {
      pendingReceive.reject();
    }
  }
});

ipcMain.handle('send-file', async (event, { filePaths }) => {
  return new Promise((resolve, reject) => {
    const args = ['send', ...filePaths];

    const options = {
      stdio: ['ignore', 'pipe', 'pipe']
    };

    console.log('[wormhole send] Args:', args);

    let code = '';
    let fileName = '';
    let fileSize = 0;

    const sendProgress = async (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (data.code && !data.qrCode) {
          try {
            const qrText = `wormhole-transfer:${data.code}`;
            const qrDataUrl = await QRCode.toDataURL(qrText, {
              width: 180,
              margin: 2,
              color: { dark: '#000000', light: '#FFFFFF' }
            });
            data.qrCode = qrDataUrl;
          } catch (err) {
            console.error('QR generation error:', err);
          }
        }
        mainWindow.webContents.send('send-progress', data);
      }
    };

    const wormhole = spawn(WORMHOLE_BINARY, args, options);

    sendProgress({ stage: 'preparing', message: 'Preparing...' });

    wormhole.stdout.on('data', (data) => {
      const text = data.toString();
      console.log('[wormhole send stdout]', text);

      const codeMatch = text.match(/wormhole code is:\s*(\S+)/i) || text.match(/(\d+-[a-z]+-[a-z]+)/i);
      if (codeMatch) {
        code = codeMatch[1].toLowerCase();
        console.log('[wormhole send] Got code:', code);
        sendProgress({ stage: 'waiting', message: 'Waiting for receiver...', code });
      }

      if (text.includes('%')) {
        const percentMatch = text.match(/(\d+)%/);
        if (percentMatch) {
          const percent = parseInt(percentMatch[1]);
          sendProgress({
            stage: 'progress',
            message: `${percent}%`,
            percent,
            code
          });
        }
      }

      if (text.toLowerCase().includes('sent') || text.toLowerCase().includes('complete') || text.toLowerCase().includes('transferred')) {
        sendProgress({ stage: 'complete', message: 'Sent!', code });
      }
    });

    wormhole.stderr.on('data', (data) => {
      const text = data.toString();
      console.log('[wormhole send stderr]', text);
    });

    wormhole.on('close', (code) => {
      console.log('[wormhole send close]', code);
      if (code === 0) {
        resolve({ success: true, code });
      } else {
        sendProgress({ stage: 'error', message: 'Send failed' });
        resolve({ success: false, error: 'Send failed' });
      }
    });

    wormhole.on('error', (err) => {
      console.error('[wormhole send error]', err);
      sendProgress({ stage: 'error', message: err.message });
      resolve({ success: false, error: err.message });
    });
  });
});
