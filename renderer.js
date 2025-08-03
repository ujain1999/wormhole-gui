class WormholeGUI {
    constructor() {
        this.selectedFiles = [];
        this.currentTransfers = new Map();
        this.saveLocation = '';
        this.transferHistory = [];

        this.initializeApp();
    }

    async initializeApp() {
        this.initializeElements();
        this.setupEventListeners();
        this.setupIPCListeners();
        await this.loadDefaultLocation();
        this.loadSettings();
        this.loadHistory();
    }

    initializeElements() {
        // Tab elements
        this.tabs = document.querySelectorAll('.tab[data-tab]');
        this.tabContents = document.querySelectorAll('.tab-content');
        this.textSubTabs = document.querySelectorAll('.tab[data-subtab]');

        // Send elements
        this.fileDropZone = document.getElementById('file-drop-zone');
        this.sendButton = document.getElementById('send-button');
        this.clearFilesButton = document.getElementById('clear-files');
        this.cancelSendButton = document.getElementById('cancel-send');

        // Receive elements
        this.receiveCodeInput = document.getElementById('receive-code');
        this.saveLocationInput = document.getElementById('save-location');
        this.chooseLocationButton = document.getElementById('choose-location');
        this.receiveButton = document.getElementById('receive-button');
        this.cancelReceiveButton = document.getElementById('cancel-receive');

        // Text elements
        this.textContentTextarea = document.getElementById('text-content');
        this.sendTextButton = document.getElementById('send-text-button');
        this.textReceiveCodeInput = document.getElementById('text-receive-code');
        this.receiveTextButton = document.getElementById('receive-text-button');
        this.copyTextButton = document.getElementById('copy-text');
    }

    setupEventListeners() {
        // Tab switching
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // Text sub-tab switching
        this.textSubTabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTextSubTab(tab.dataset.subtab));
        });

        // File selection
        this.fileDropZone.addEventListener('click', async () => {
            const files = await window.electronAPI.selectFiles();
            this.addFiles(files);
        });

        // File operations
        this.clearFilesButton.addEventListener('click', () => this.clearFiles());
        this.sendButton.addEventListener('click', () => this.sendFiles());
        this.cancelSendButton.addEventListener('click', () => this.cancelTransfer('send'));

        // Receive operations
        this.chooseLocationButton.addEventListener('click', async () => {
            const location = await window.electronAPI.selectDirectory();
            if (location) {
                this.saveLocation = location;
                this.saveLocationInput.value = location;
                this.validateReceiveForm();
            }
        });
        this.receiveButton.addEventListener('click', () => this.receiveFiles());
        this.cancelReceiveButton.addEventListener('click', () => this.cancelTransfer('receive'));

        // Text operations
        this.sendTextButton.addEventListener('click', () => this.sendText());
        this.receiveTextButton.addEventListener('click', () => this.receiveText());
        this.copyTextButton.addEventListener('click', () => this.copyReceivedText());

        // Input validation
        this.receiveCodeInput.addEventListener('input', () => this.validateReceiveForm());
        this.textContentTextarea.addEventListener('input', () => this.validateTextForm());
        this.textReceiveCodeInput.addEventListener('input', () => this.validateTextReceiveForm());

        // Settings
        document.getElementById('clear-history').addEventListener('click', () => this.clearHistory());

        // Auto-save settings
        document.addEventListener('change', (e) => {
            if (e.target.closest('#settings-tab')) {
                this.saveSettings();
            }
        });
    }

    setupIPCListeners() {
        // Transfer code received
        window.electronAPI.onTransferCode((event, { transferId, code }) => {
            console.log("HERE");
            console.log("CODE !!!!");
            document.getElementById('wormhole-code').textContent = code;
            document.getElementById('wormhole-code-display').classList.remove('hidden');
            this.currentTransfers.set('send', transferId);
        });

        // Transfer progress
        window.electronAPI.onTransferProgress((event, { transferId, progress }) => {
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab.id === 'send-tab') {
                this.updateProgress('send-progress-fill', 'send-progress-text', progress, `Transferring... ${progress}%`);
            } else if (activeTab.id === 'receive-tab') {
                this.updateProgress('receive-progress-fill', 'receive-progress-text', progress, `Receiving... ${progress}%`);
            }
        });

        // Transfer status updates
        window.electronAPI.onTransferStatus((event, { transferId, status, message }) => {
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab.id === 'send-tab') {
                this.showStatus('send-status', status, message);
            } else if (activeTab.id === 'receive-tab') {
                this.showStatus('receive-status', status, message);
            }
        });

        // Transfer complete
        window.electronAPI.onTransferComplete((event, { transferId, success, error, code }) => {
            this.currentTransfers.delete('send');
            this.currentTransfers.delete('receive');

            if (success) {
                const activeTab = document.querySelector('.tab-content.active');
                if (activeTab.id === 'send-tab') {
                    this.showStatus('send-status', 'success', 'Files sent successfully!');
                    this.addToHistory('send', this.selectedFiles, code);
                    setTimeout(() => this.resetSendTab(), 3000);
                } else if (activeTab.id === 'receive-tab') {
                    this.showStatus('receive-status', 'success', 'Files received successfully!');
                    this.addToHistory('receive', null, this.receiveCodeInput.value);

                    // Open folder if setting enabled
                    if (document.getElementById('open-after-receive').checked) {
                        window.electronAPI.openLocation(this.saveLocation);
                    }

                    setTimeout(() => this.resetReceiveTab(), 3000);
                }
            } else {
                const activeTab = document.querySelector('.tab-content.active');
                if (activeTab.id === 'send-tab') {
                    this.showStatus('send-status', 'error', 'Transfer failed: ' + error);
                } else if (activeTab.id === 'receive-tab') {
                    this.showStatus('receive-status', 'error', 'Transfer failed: ' + error);
                }
            }
        });

        // Text code received
        window.electronAPI.onTextCode((event, { transferId, code }) => {
            document.getElementById('text-wormhole-code').textContent = code;
            document.getElementById('text-code-display').classList.remove('hidden');
            this.addToHistory('send-text', this.textContentTextarea.value, code);

            setTimeout(() => {
                this.textContentTextarea.value = '';
                document.getElementById('text-code-display').classList.add('hidden');
                this.validateTextForm();
            }, 5000);
        });
    }

    // Tab switching methods
    switchTab(tabName) {
        this.tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        this.tabContents.forEach(content => {
            const isActive = content.id === `${tabName}-tab`;
            content.classList.toggle('active', isActive);
        });
    }

    switchTextSubTab(subtabName) {
        this.textSubTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.subtab === subtabName);
        });

        document.getElementById('send-text-tab').classList.toggle('active', subtabName === 'send-text');
        document.getElementById('receive-text-tab').classList.toggle('active', subtabName === 'receive-text');
    }

    // File management methods
    addFiles(files) {
        this.selectedFiles = [...this.selectedFiles, ...files];
        this.updateFileDisplay();
        this.validateSendForm();
    }

    updateFileDisplay() {
        const container = document.getElementById('selected-files');

        if (this.selectedFiles.length === 0) {
            container.innerHTML = '';
            return;
        }

        const totalSize = this.selectedFiles.reduce((sum, file) => sum + file.size, 0);

        container.innerHTML = `
      <div style="margin-bottom: 8px; font-weight: 500;">
        ${this.selectedFiles.length} file(s) selected (${this.formatFileSize(totalSize)})
      </div>
      ${this.selectedFiles.map((file, index) => `
        <div class="selected-file">
          <div class="file-info">
            <div class="file-name">${file.name}</div>
            <div class="file-size">${this.formatFileSize(file.size)}</div>
          </div>
          <button class="remove-file" onclick="gui.removeFile(${index})">✕</button>
        </div>
      `).join('')}
    `;
    }

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.updateFileDisplay();
        this.validateSendForm();
    }

    clearFiles() {
        this.selectedFiles = [];
        this.updateFileDisplay();
        this.validateSendForm();
    }

    // Transfer methods
    async sendFiles() {
        if (this.selectedFiles.length === 0) return;

        this.showStatus('send-status', 'info', 'Initializing transfer...');
        this.showProgress('send-progress', 0, 'Preparing files...');
        this.sendButton.disabled = true;

        try {
            const filePaths = this.selectedFiles.map(f => f.path);
            await window.electronAPI.sendFiles(filePaths);
        } catch (error) {
            this.showStatus('send-status', 'error', 'Failed to send: ' + (error.error || error.message));
            this.sendButton.disabled = false;
            this.hideProgress('send-progress');
        }
    }

    async receiveFiles() {
        const code = this.receiveCodeInput.value.trim();
        if (!code || !this.saveLocation) return;

        this.showStatus('receive-status', 'info', 'Connecting to sender...');
        this.showProgress('receive-progress', 0, 'Establishing connection...');
        this.receiveButton.disabled = true;

        try {
            await window.electronAPI.receiveFiles(code, this.saveLocation);
        } catch (error) {
            this.showStatus('receive-status', 'error', 'Failed to receive: ' + (error.error || error.message));
            this.receiveButton.disabled = false;
            this.hideProgress('receive-progress');
        }
    }

    async sendText() {
        const text = this.textContentTextarea.value.trim();
        if (!text) return;

        this.showStatus('text-send-status', 'info', 'Preparing text message...');
        this.sendTextButton.disabled = true;

        try {
            await window.electronAPI.sendText(text);
            this.showStatus('text-send-status', 'success', 'Text message ready to send!');
        } catch (error) {
            this.showStatus('text-send-status', 'error', 'Failed to send text: ' + (error.error || error.message));
        } finally {
            this.sendTextButton.disabled = false;
        }
    }

    async receiveText() {
        const code = this.textReceiveCodeInput.value.trim();
        if (!code) return;

        this.showStatus('text-receive-status', 'info', 'Connecting to sender...');
        this.receiveTextButton.disabled = true;

        try {
            const result = await window.electronAPI.receiveText(code);
            document.getElementById('received-text-content').value = result.text;
            document.getElementById('received-text').classList.remove('hidden');
            this.showStatus('text-receive-status', 'success', 'Text message received!');
            this.addToHistory('receive-text', result.text, code);

            setTimeout(() => {
                this.textReceiveCodeInput.value = '';
                document.getElementById('text-receive-status').innerHTML = '';
                this.validateTextReceiveForm();
            }, 3000);

        } catch (error) {
            this.showStatus('text-receive-status', 'error', 'Failed to receive text: ' + (error.error || error.message));
        } finally {
            this.receiveTextButton.disabled = false;
        }
    }

    copyReceivedText() {
        const textContent = document.getElementById('received-text-content').value;
        navigator.clipboard.writeText(textContent).then(() => {
            this.copyTextButton.textContent = 'Copied!';
            setTimeout(() => {
                this.copyTextButton.textContent = 'Copy to Clipboard';
            }, 2000);
        });
    }

    async cancelTransfer(type) {
        const transferId = this.currentTransfers.get(type);
        if (transferId) {
            const success = await window.electronAPI.cancelTransfer(transferId);
            if (success) {
                this.showStatus(`${type}-status`, 'info', 'Transfer cancelled');
                this.hideProgress(`${type}-progress`);

                if (type === 'send') {
                    this.sendButton.disabled = false;
                } else if (type === 'receive') {
                    this.receiveButton.disabled = false;
                }
            }
        }
    }

    // Validation methods
    validateSendForm() {
        this.sendButton.disabled = this.selectedFiles.length === 0;
    }

    validateReceiveForm() {
        const hasCode = this.receiveCodeInput.value.trim().length > 0;
        const hasLocation = this.saveLocation.length > 0;
        this.receiveButton.disabled = !hasCode || !hasLocation;
    }

    validateTextForm() {
        this.sendTextButton.disabled = this.textContentTextarea.value.trim().length === 0;
    }

    validateTextReceiveForm() {
        this.receiveTextButton.disabled = this.textReceiveCodeInput.value.trim().length === 0;
    }

    // UI helper methods
    showStatus(elementId, type, message) {
        const element = document.getElementById(elementId);
        element.className = `status-message status-${type}`;
        element.textContent = message;
    }

    showProgress(elementId, progress, text) {
        document.getElementById(elementId).classList.remove('hidden');
        this.updateProgress(elementId.replace('progress', 'progress-fill'),
            elementId.replace('progress', 'progress-text'), progress, text);
    }

    hideProgress(elementId) {
        document.getElementById(elementId).classList.add('hidden');
    }

    updateProgress(fillId, textId, progress, text) {
        document.getElementById(fillId).style.width = `${progress}%`;
        document.getElementById(textId).textContent = text;
    }

    resetSendTab() {
        this.clearFiles();
        document.getElementById('wormhole-code-display').classList.add('hidden');
        document.getElementById('send-progress').classList.add('hidden');
        document.getElementById('send-status').innerHTML = '';
        this.sendButton.disabled = false;
    }

    resetReceiveTab() {
        this.receiveCodeInput.value = '';
        document.getElementById('receive-progress').classList.add('hidden');
        document.getElementById('receive-status').innerHTML = '';
        this.receiveButton.disabled = false;
        this.validateReceiveForm();
    }

    // Settings and storage methods
    async loadDefaultLocation() {
        this.saveLocation = await window.electronAPI.getDownloadsDir();
        this.saveLocationInput.value = this.saveLocation;
        this.validateReceiveForm();
    }

    loadSettings() {
        const settings = JSON.parse(localStorage.getItem('wormhole-settings') || '{}');

        document.getElementById('verify-checksums').checked = settings.verifyChecksums !== false;
        document.getElementById('overwrite-files').checked = settings.overwriteFiles || false;
        document.getElementById('show-notifications').checked = settings.showNotifications !== false;
        document.getElementById('open-after-receive').checked = settings.openAfterReceive !== false;
        document.getElementById('relay-server').value = settings.relayServer || '';
        document.getElementById('code-length').value = settings.codeLength || 2;
    }

    saveSettings() {
        const settings = {
            verifyChecksums: document.getElementById('verify-checksums').checked,
            overwriteFiles: document.getElementById('overwrite-files').checked,
            showNotifications: document.getElementById('show-notifications').checked,
            openAfterReceive: document.getElementById('open-after-receive').checked,
            relayServer: document.getElementById('relay-server').value,
            codeLength: parseInt(document.getElementById('code-length').value)
        };

        localStorage.setItem('wormhole-settings', JSON.stringify(settings));
    }

    // History management
    loadHistory() {
        this.transferHistory = JSON.parse(localStorage.getItem('wormhole-history') || '[]');
        this.updateHistoryDisplay();
    }

    addToHistory(type, data, code) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = now.toDateString() === new Date().toDateString() ? 'Today' : now.toLocaleDateString();

        let description = '';
        if (type === 'send') {
            const totalSize = data.reduce((sum, file) => sum + file.size, 0);
            description = `Sent: ${data.length} file(s) (${this.formatFileSize(totalSize)}) → Code: ${code}`;
        } else if (type === 'receive') {
            description = `Received files ← Code: ${code}`;
        } else if (type === 'send-text') {
            const preview = data.length > 30 ? data.substring(0, 30) + '...' : data;
            description = `Sent text: "${preview}" → Code: ${code}`;
        } else if (type === 'receive-text') {
            const preview = data.length > 30 ? data.substring(0, 30) + '...' : data;
            description = `Received text: "${preview}" ← Code: ${code}`;
        }

        const historyItem = {
            timestamp: now.toISOString(),
            type,
            description,
            code,
            dateStr,
            timeStr
        };

        this.transferHistory.unshift(historyItem);
        this.transferHistory = this.transferHistory.slice(0, 50); // Keep only last 50 items

        localStorage.setItem('wormhole-history', JSON.stringify(this.transferHistory));
        this.updateHistoryDisplay();
    }

    updateHistoryDisplay() {
        const historyContainer = document.getElementById('transfer-history');

        if (this.transferHistory.length === 0) {
            historyContainer.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No transfers yet</div>';
            return;
        }

        historyContainer.innerHTML = this.transferHistory.map(item => `
      <div class="history-item">
        <div class="history-time">${item.dateStr} ${item.timeStr}</div>
        <div>${item.description}</div>
      </div>
    `).join('');
    }

    clearHistory() {
        this.transferHistory = [];
        localStorage.removeItem('wormhole-history');
        this.updateHistoryDisplay();
    }

    // Utility methods
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.gui = new WormholeGUI();
})