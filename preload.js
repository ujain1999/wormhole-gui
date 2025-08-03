const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getDownloadsDir: () => ipcRenderer.invoke('get-downloads-dir'),
  
  // Transfer operations
  sendFiles: (filePaths) => ipcRenderer.invoke('send-files', filePaths),
  receiveFiles: (code, saveLocation) => ipcRenderer.invoke('receive-files', code, saveLocation),
  sendText: (text) => ipcRenderer.invoke('send-text', text),
  receiveText: (code) => ipcRenderer.invoke('receive-text', code),
  cancelTransfer: (transferId) => ipcRenderer.invoke('cancel-transfer', transferId),
  
  // System operations
  openLocation: (filePath) => ipcRenderer.invoke('open-location', filePath),
  
  // Event listeners
  onTransferCode: (callback) => ipcRenderer.on('transfer-code', callback),
  onTransferProgress: (callback) => ipcRenderer.on('transfer-progress', callback),
  onTransferStatus: (callback) => ipcRenderer.on('transfer-status', callback),
  onTransferComplete: (callback) => ipcRenderer.on('transfer-complete', callback),
  onTextCode: (callback) => ipcRenderer.on('text-code', callback),
  
  // Cleanup
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});