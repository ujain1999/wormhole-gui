const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFiles: () => ipcRenderer.invoke('select-files'),
  getDefaultDownloadPath: () => ipcRenderer.invoke('get-default-download-path'),
  receiveFile: (code, outputPath) => ipcRenderer.invoke('receive-file', { code, outputPath }),
  confirmReceive: (accepted) => ipcRenderer.invoke('confirm-receive', accepted),
  sendFile: (filePaths) => ipcRenderer.invoke('send-file', { filePaths }),
  onReceiveProgress: (callback) => {
    ipcRenderer.on('receive-progress', (_, data) => callback(data));
  },
  onSendProgress: (callback) => {
    ipcRenderer.on('send-progress', (_, data) => callback(data));
  }
});
