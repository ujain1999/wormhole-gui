const { app, BrowserWindow, ipcMain, dialog, shell, Notification } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

class WormholeApp {
    constructor() {
        this.mainWindow = null;
        this.activeTransfers = new Map();
        this.wormholePath = this.getWormholePath();
        this.setupApp();
    }

    getWormholePath() {
        const isDev = !app.isPackaged;
        const platform = process.platform;
        const binariesPath = isDev ? path.join(__dirname, 'resources', 'binaries') : path.join(process.resourcesPath, 'binaries');

        switch (platform) {
            case 'win32':
                return path.join(binariesPath, 'wormhole.exe');
            case 'darwin':
                return path.join(binariesPath, 'wormhole');
            case 'linux':
                return path.join(binariesPath, 'wormhole');
            default:
                return path.join(binariesPath, 'wormhole');
        }
    }

    async isWormholeAvailable() {
        return new Promise((resolve) => {
            const testProcess = spawn(this.wormholePath, ['--version'], { stdio: 'pipe' });
            testProcess.on('close', (code) => {
                resolve(code === 0);
            });
            testProcess.on('error', () => resolve(false));
        });
    }

    setupApp() {
        app.whenReady().then(() => {
            this.createWindow();
            this.setupIPC();
        });

        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                this.createWindow();
            }
        });
    }

    createWindow() {
        this.mainWindow = new BrowserWindow({
            width: 480,
            height: 650,
            titleBarStyle: 'hiddenInset',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js')
            },
            resizable: false,
            maximizable: false
        });

        this.mainWindow.loadFile('index.html');

        // Hide menu bar on macOS
        if (process.platform === 'darwin') {
            this.mainWindow.setMenuBarVisibility(false);
        }
    }

    setupIPC() {
        // Check if wormhole is available (now checks bundled version)
        ipcMain.handle('check-wormhole', async () => {
            return await this.isWormholeAvailable();
        });

        // Remove install-wormhole handler since we're bundling it
        // The app should work out of the box now

        // Send files
        ipcMain.handle('send-files', async (event, filePaths) => {
            const transferId = Date.now().toString();

            try {
                console.log('Send files requested for:', filePaths);
                console.log('Using wormhole path:', this.wormholePath);

                // Check if wormhole binary exists
                const fs = require('fs');
                if (!fs.existsSync(this.wormholePath)) {
                    const error = `Wormhole binary not found at: ${this.wormholePath}`;
                    console.error(error);
                    throw new Error(error);
                }
                else {
                    console.log('Wormhole binary found at:', this.wormholePath);
                }

                return new Promise((resolve, reject) => {
                    const args = ['send'];
                    filePaths.forEach(filePath => args.push(filePath));

                    console.log('Spawning wormhole with args:', args);

                    const wormholeProcess = spawn(this.wormholePath, args, { stdio: 'pipe' });
                    this.activeTransfers.set(transferId, wormholeProcess);

                    let output = '';
                    let errorOutput = '';
                    let code = null;

                    wormholeProcess.stdout.on('data', (data) => {
                        const text = data.toString();
                        output += text;
                        console.log('Wormhole stdout:', text);

                        // Extract wormhole code
                        const codeMatch = text.match(/Wormhole code is: (\d+-\w+-\w+)/);
                        if (codeMatch) {
                            code = codeMatch[1];
                            this.mainWindow.webContents.send('transfer-code', { transferId, code });
                        }

                        // Progress updates
                        const progressMatch = text.match(/(\d+)%/);
                        if (progressMatch) {
                            const progress = parseInt(progressMatch[1]);
                            this.mainWindow.webContents.send('transfer-progress', { transferId, progress });
                        }
                    });

                    wormholeProcess.stderr.on('data', (data) => {
                        const text = data.toString();
                        errorOutput += text;
                        console.log('Wormhole stderr:', text);

                        this.mainWindow.webContents.send('transfer-status', {
                            transferId,
                            status: 'info',
                            message: text.trim()
                        });
                    });

                    wormholeProcess.on('close', (exitCode) => {
                        console.log('Wormhole process closed with code:', exitCode);
                        console.log('Final output:', output);
                        console.log('Final error output:', errorOutput);

                        this.activeTransfers.delete(transferId);

                        if (exitCode === 0) {
                            this.mainWindow.webContents.send('transfer-complete', {
                                transferId,
                                success: true,
                                code
                            });

                            // Show system notification
                            new Notification({
                                title: 'Magic Wormhole',
                                body: `Files sent successfully! Code: ${code}`
                            }).show();

                            resolve({ success: true, code, transferId });
                        } else {
                            const errorMessage = errorOutput || output || `Process exited with code ${exitCode}`;
                            this.mainWindow.webContents.send('transfer-complete', {
                                transferId,
                                success: false,
                                error: errorMessage
                            });
                            reject(new Error(errorMessage));
                        }
                    });

                    wormholeProcess.on('error', (error) => {
                        console.error('Wormhole process error:', error);
                        this.activeTransfers.delete(transferId);
                        reject(error);
                    });
                });

            } catch (error) {
                console.error('Send files error:', error);
                throw error;
            }
        });

        // Receive files
        ipcMain.handle('receive-files', async (event, code, saveLocation) => {
            const transferId = Date.now().toString();

            return new Promise((resolve, reject) => {
                const wormholeProcess = spawn(this.wormholePath, ['receive', code], {
                    cwd: saveLocation,
                    stdio: 'pipe'
                });

                this.activeTransfers.set(transferId, wormholeProcess);

                let output = '';
                let hasStarted = false;

                // Send initial status
                this.mainWindow.webContents.send('transfer-status', {
                    transferId,
                    status: 'info',
                    message: 'Connecting to sender...'
                });

                wormholeProcess.stdout.on('data', (data) => {
                    const text = data.toString();
                    output += text;
                    console.log('Receive stdout:', text); // Debug log

                    // Check for connection established
                    if (text.includes('Receiving') || text.includes('file') || text.includes('Sending')) {
                        if (!hasStarted) {
                            hasStarted = true;
                            this.mainWindow.webContents.send('transfer-status', {
                                transferId,
                                status: 'info',
                                message: 'Transfer started...'
                            });
                            this.mainWindow.webContents.send('transfer-progress', { transferId, progress: 25 });
                        }
                    }

                    // Progress updates - look for various progress indicators
                    const progressMatch = text.match(/(\d+)%/) || text.match(/(\d+)\/(\d+)/);
                    if (progressMatch) {
                        let progress;
                        if (progressMatch[2]) {
                            // Format like "1024/2048"
                            progress = Math.round((parseInt(progressMatch[1]) / parseInt(progressMatch[2])) * 100);
                        } else {
                            // Format like "50%"
                            progress = parseInt(progressMatch[1]);
                        }
                        this.mainWindow.webContents.send('transfer-progress', { transferId, progress });
                    }

                    // File info updates
                    if (text.includes('Receiving') || text.includes('bytes')) {
                        this.mainWindow.webContents.send('transfer-status', {
                            transferId,
                            status: 'info',
                            message: text.trim()
                        });
                    }
                });

                wormholeProcess.stderr.on('data', (data) => {
                    const text = data.toString();
                    output += text;
                    console.log('Receive stderr:', text); // Debug log

                    // Many wormhole messages come through stderr, not necessarily errors
                    if (text.includes('Receiving') || text.includes('Connection') || text.includes('Key')) {
                        this.mainWindow.webContents.send('transfer-status', {
                            transferId,
                            status: 'info',
                            message: text.trim()
                        });
                    }
                });

                // Auto-accept file transfers (simulate user confirmation)
                setTimeout(() => {
                    wormholeProcess.stdin.write('y\n');
                }, 1000);

                wormholeProcess.on('close', (exitCode) => {
                    this.activeTransfers.delete(transferId);
                    console.log('Receive process closed with code:', exitCode); // Debug log

                    if (exitCode === 0) {
                        this.mainWindow.webContents.send('transfer-complete', {
                            transferId,
                            success: true
                        });

                        new Notification({
                            title: 'Magic Wormhole',
                            body: 'Files received successfully!'
                        }).show();

                        resolve({ success: true, transferId });
                    } else {
                        this.mainWindow.webContents.send('transfer-complete', {
                            transferId,
                            success: false,
                            error: output || `Process exited with code ${exitCode}`
                        });
                        reject({ success: false, error: output || `Process exited with code ${exitCode}` });
                    }
                });

                wormholeProcess.on('error', (error) => {
                    this.activeTransfers.delete(transferId);
                    console.log('Receive process error:', error); // Debug log
                    reject({ success: false, error: error.message });
                });
            });
        });

        // Send text
        ipcMain.handle('send-text', async (event, text) => {
            console.log('Send text requested:', text);
            const transferId = Date.now().toString();

            return new Promise((resolve, reject) => {
                const wormholeProcess = spawn(this.wormholePath, ['send', '--text', text], { stdio: 'pipe' });
                this.activeTransfers.set(transferId, wormholeProcess);
                let output = '';
                let code = null;

                wormholeProcess.stdout.on('data', (data) => {
                    const text = data.toString();
                    output += text;
                    // console.log(output);
                    const codeMatch = text.match(/Wormhole code is: (\d+-\w+-\w+)/);
                    if (codeMatch) {
                        code = codeMatch[1];
                        this.mainWindow.webContents.send('text-code', { transferId, code });
                    }
                });

                wormholeProcess.on('close', (exitCode) => {
                    this.activeTransfers.delete(transferId);

                    if (exitCode === 0) {
                        new Notification({
                            title: 'Magic Wormhole',
                            body: `Text sent! Code: ${code}`
                        }).show();

                        resolve({ success: true, code, transferId });
                    } else {
                        reject({ success: false, error: output });
                    }
                });
            });
        });

        // Receive text
        ipcMain.handle('receive-text', async (event, code) => {
            const transferId = Date.now().toString();

            return new Promise((resolve, reject) => {
                const wormholeProcess = spawn(this.wormholePath, ['receive', code], { stdio: 'pipe' });
                this.activeTransfers.set(transferId, wormholeProcess);

                let output = '';
                let receivedText = '';

                wormholeProcess.stdout.on('data', (data) => {
                    const text = data.toString();
                    output += text;
                    receivedText += text;
                });

                wormholeProcess.on('close', (exitCode) => {
                    this.activeTransfers.delete(transferId);

                    if (exitCode === 0) {
                        new Notification({
                            title: 'Magic Wormhole',
                            body: 'Text message received!'
                        }).show();

                        resolve({ success: true, text: receivedText.trim(), transferId });
                    } else {
                        reject({ success: false, error: output });
                    }
                });
            });
        });

        // File dialog
        ipcMain.handle('select-files', async () => {
            const result = await dialog.showOpenDialog(this.mainWindow, {
                properties: ['openFile', 'multiSelections'],
                title: 'Select Files to Send'
            });

            if (!result.canceled) {
                const fileInfos = await Promise.all(
                    result.filePaths.map(async (filePath) => {
                        const stats = await fs.stat(filePath);
                        return {
                            path: filePath,
                            name: path.basename(filePath),
                            size: stats.size
                        };
                    })
                );
                return fileInfos;
            }
            return [];
        });

        // Directory dialog
        ipcMain.handle('select-directory', async () => {
            const result = await dialog.showOpenDialog(this.mainWindow, {
                properties: ['openDirectory'],
                title: 'Select Download Location'
            });

            return result.canceled ? null : result.filePaths[0];
        });

        // Get default downloads directory
        ipcMain.handle('get-downloads-dir', () => {
            return path.join(os.homedir(), 'Downloads');
        });

        // Cancel transfer
        ipcMain.handle('cancel-transfer', (event, transferId) => {
            const process = this.activeTransfers.get(transferId);
            if (process) {
                process.kill();
                this.activeTransfers.delete(transferId);
                return true;
            }
            return false;
        });

        // Open file location
        ipcMain.handle('open-location', (event, filePath) => {
            shell.showItemInFolder(filePath);
        });
    }
}

new WormholeApp();