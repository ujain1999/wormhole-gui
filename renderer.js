document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initTabs();
  initDropZone();
  initSettings();
  initReceive();
  initConfirmModal();
});

function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'system';
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = savedTheme === 'system' ? (prefersDark ? 'dark' : 'light') : savedTheme;
  applyTheme(theme);

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newTheme = btn.dataset.theme;
      localStorage.setItem('theme', newTheme);
      const effectiveTheme = newTheme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : newTheme;
      applyTheme(effectiveTheme);
      document.querySelectorAll('.theme-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.theme === newTheme);
      });
    });
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (localStorage.getItem('theme') === 'system') {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}

function applyTheme(theme) {
  document.querySelector('.app').dataset.theme = theme;
}

function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const indicator = document.querySelector('.tab-indicator');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      indicator.dataset.position = target === 'receive' ? 'receive' : 'send';
      contents.forEach(c => c.classList.remove('active'));
      document.getElementById(`${target}Tab`).classList.add('active');
    });
  });
}

function initDropZone() {
  const dropZone = document.getElementById('dropZone');
  const selectFilesBtn = document.getElementById('selectFilesBtn');
  const fileList = document.getElementById('fileList');
  const fileItems = document.getElementById('fileItems');
  const fileCount = document.getElementById('fileCount');
  const clearFilesBtn = document.getElementById('clearFilesBtn');
  const sendBtn = document.getElementById('sendBtn');
  const codeDisplay = document.getElementById('codeDisplay');
  const copyCodeBtn = document.getElementById('copyCodeBtn');
  const sendProgressSection = document.getElementById('sendProgressSection');

  let selectedFiles = [];
  let isSending = false;

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    handleFilePaths(Array.from(files).map(f => f.path));
  });

  async function openFilePicker() {
    if (isSending) return;
    if (window.electronAPI) {
      const paths = await window.electronAPI.selectFiles();
      if (paths && paths.length > 0) {
        handleFilePaths(paths);
      }
    }
  }

  selectFilesBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openFilePicker();
  });

  dropZone.addEventListener('click', () => {
    openFilePicker();
  });

  clearFilesBtn.addEventListener('click', () => {
    selectedFiles = [];
    updateFileList();
    dropZone.classList.remove('hidden');
    fileList.classList.add('hidden');
    codeDisplay.classList.add('hidden');
    sendProgressSection.classList.add('hidden');
  });

  sendBtn.addEventListener('click', async () => {
    if (selectedFiles.length > 0 && !isSending) {
      await initiateSend();
    }
  });

  copyCodeBtn.addEventListener('click', () => {
    const code = document.getElementById('wormholeCode').textContent;
    navigator.clipboard.writeText(code);
    copyCodeBtn.classList.add('copied');
    setTimeout(() => copyCodeBtn.classList.remove('copied'), 1500);
  });

  if (window.electronAPI) {
    window.electronAPI.onSendProgress((data) => {
      console.log('Send progress:', data);
      isSending = true;

      if (data.stage === 'preparing') {
        dropZone.classList.add('hidden');
        fileList.classList.add('hidden');
        sendProgressSection.classList.remove('hidden');
        document.getElementById('sendProgressText').textContent = data.message;
        document.getElementById('sendProgressFill').style.width = '10%';
      } else if (data.stage === 'waiting') {
        document.getElementById('sendProgressText').textContent = data.message;
        document.getElementById('sendProgressFill').style.width = '20%';
        codeDisplay.classList.remove('hidden');
        sendProgressSection.classList.add('hidden');
        document.getElementById('wormholeCode').textContent = data.code;
        if (data.qrCode) {
          document.getElementById('qrCode').innerHTML = `<img src="${data.qrCode}" alt="QR Code">`;
        }
      } else if (data.stage === 'progress') {
        document.getElementById('sendProgressText').textContent = data.message;
        if (data.percent !== undefined) {
          document.getElementById('sendProgressFill').style.width = `${data.percent}%`;
        }
        sendProgressSection.classList.remove('hidden');
        codeDisplay.classList.remove('hidden');
      } else if (data.stage === 'complete') {
        document.getElementById('sendProgressText').textContent = data.message;
        document.getElementById('sendProgressFill').style.width = '100%';
        isSending = false;
        sendProgressSection.classList.add('hidden');
        codeDisplay.classList.add('hidden');
        document.getElementById('sendSuccessSection').classList.remove('hidden');
        document.getElementById('sendSuccessText').textContent = 'Sent!';
        setTimeout(() => {
          resetSendUI();
        }, 2000);
      } else if (data.stage === 'error') {
        document.getElementById('sendProgressText').textContent = data.message;
        document.getElementById('sendProgressText').style.color = 'var(--error)';
        isSending = false;
        setTimeout(() => {
          resetSendUI();
        }, 2000);
      }
    });
  }

  function resetSendUI() {
    selectedFiles = [];
    dropZone.classList.remove('hidden');
    fileList.classList.add('hidden');
    codeDisplay.classList.add('hidden');
    sendProgressSection.classList.add('hidden');
    document.getElementById('sendSuccessSection').classList.add('hidden');
    document.getElementById('sendProgressFill').style.width = '0%';
    document.getElementById('sendProgressText').style.color = '';
    isSending = false;
  }

  async function initiateSend() {
    dropZone.classList.add('hidden');
    fileList.classList.add('hidden');
    sendProgressSection.classList.remove('hidden');
    document.getElementById('sendProgressText').textContent = 'Preparing...';
    document.getElementById('sendProgressFill').style.width = '5%';

    try {
      if (window.electronAPI) {
        const filePaths = selectedFiles.map(f => f.path);
        console.log('[send] Sending paths:', filePaths);
        await window.electronAPI.sendFile(filePaths);
      }
    } catch (err) {
      console.error('Send error:', err);
      document.getElementById('sendProgressText').textContent = err.message || 'Send failed';
      document.getElementById('sendProgressText').style.color = 'var(--error)';
      setTimeout(resetSendUI, 2000);
    }
  }

  function handleFilePaths(paths) {
    selectedFiles = paths.map(p => ({
      path: p,
      name: p.split('/').pop()
    }));
    if (selectedFiles.length > 0) {
      dropZone.classList.add('hidden');
      fileList.classList.remove('hidden');
      updateFileList();
    }
  }

  function updateFileList() {
    fileCount.textContent = `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected`;
    fileItems.innerHTML = selectedFiles.map((file, index) => `
      <div class="file-item">
        <svg class="file-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
        </svg>
        <div class="file-item-info">
          <div class="file-item-name">${escapeHtml(file.name)}</div>
          <div class="file-item-size">${file.path}</div>
        </div>
        <button class="file-item-remove" data-index="${index}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `).join('');

    fileItems.querySelectorAll('.file-item-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(btn.dataset.index);
        selectedFiles.splice(index, 1);
        if (selectedFiles.length === 0) {
          dropZone.classList.remove('hidden');
          fileList.classList.add('hidden');
        } else {
          updateFileList();
        }
      });
    });
  }
}

function initSettings() {
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const browseBtn = document.getElementById('browseBtn');
  const downloadPathInput = document.getElementById('downloadPathInput');
  const askEverytimeCheckbox = document.getElementById('askEverytimeCheckbox');

  const settings = JSON.parse(localStorage.getItem('settings') || '{}');

  if (window.electronAPI) {
    window.electronAPI.getDefaultDownloadPath().then(defaultPath => {
      downloadPathInput.value = settings.downloadPath || defaultPath;
    });
  } else {
    downloadPathInput.value = settings.downloadPath || '/Downloads';
  }

  askEverytimeCheckbox.checked = settings.askEverytime || false;

  settingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.add('hidden');
    }
  });

  browseBtn.addEventListener('click', async () => {
    if (window.electronAPI) {
      const path = await window.electronAPI.selectFolder();
      if (path) {
        downloadPathInput.value = path;
        saveSettings();
      }
    }
  });

  askEverytimeCheckbox.addEventListener('change', saveSettings);
  downloadPathInput.addEventListener('change', saveSettings);

  function saveSettings() {
    const settings = {
      downloadPath: downloadPathInput.value,
      askEverytime: askEverytimeCheckbox.checked
    };
    localStorage.setItem('settings', JSON.stringify(settings));
  }
}

function initReceive() {
  const receiveBtn = document.getElementById('receiveBtn');
  const receiveCodeInput = document.getElementById('receiveCodeInput');
  const receiveSection = document.getElementById('receiveInput');
  const progressSection = document.getElementById('progressSection');
  const progressText = document.getElementById('progressText');
  const progressFill = document.getElementById('progressFill');

  const CODE_REGEX = /^\d+-[a-z]+-[a-z]+$/i;

  if (window.electronAPI) {
    window.electronAPI.onReceiveProgress((data) => {
      console.log('Receive progress:', data);

      if (data.stage === 'connecting') {
        progressText.textContent = data.message;
        progressFill.style.width = '10%';
      } else if (data.stage === 'confirm') {
        progressText.textContent = 'Waiting for confirmation...';
        progressFill.style.width = '30%';
        showConfirmModal(data.fileName, data.fileSize);
      } else if (data.stage === 'accepted') {
        progressText.textContent = 'Accepted, transferring...';
        progressFill.style.width = '40%';
      } else if (data.stage === 'progress') {
        progressText.textContent = data.percent ? `${data.percent}%` : data.message;
        if (data.percent !== undefined) {
          progressFill.style.width = `${data.percent}%`;
        }
      } else if (data.stage === 'complete') {
        progressText.textContent = 'Complete!';
        progressFill.style.width = '100%';
        progressSection.classList.add('hidden');
        document.getElementById('receiveSuccessSection').classList.remove('hidden');
        document.getElementById('receiveSuccessText').textContent = `Received: ${data.fileName || 'file'}`;
        setTimeout(() => {
          resetReceiveUI();
        }, 2000);
      } else if (data.stage === 'rejected' || data.stage === 'error') {
        progressText.textContent = data.message;
        progressText.style.color = 'var(--error)';
        setTimeout(() => {
          resetReceiveUI();
        }, 2000);
      }
    });
  }

  async function resetReceiveUI() {
    receiveSection.classList.remove('hidden');
    progressSection.classList.add('hidden');
    document.getElementById('receiveSuccessSection').classList.add('hidden');
    progressFill.style.width = '0%';
    progressText.style.color = '';
    receiveCodeInput.value = '';
  }

  receiveBtn.addEventListener('click', async () => {
    const code = receiveCodeInput.value.trim().toLowerCase();

    if (!CODE_REGEX.test(code)) {
      showError('Invalid code format. Expected: 1-abc-def');
      return;
    }

    receiveSection.classList.add('hidden');
    progressSection.classList.remove('hidden');
    progressText.textContent = 'Connecting...';
    progressFill.style.width = '5%';

    const settings = JSON.parse(localStorage.getItem('settings') || '{}');
    let outputPath = settings.downloadPath;

    if (!outputPath && window.electronAPI) {
      outputPath = await window.electronAPI.getDefaultDownloadPath();
    }

    if (settings.askEverytime && window.electronAPI) {
      outputPath = await window.electronAPI.selectFolder();
      if (!outputPath) {
        resetReceiveUI();
        return;
      }
    }

    try {
      if (window.electronAPI) {
        await window.electronAPI.receiveFile(code, outputPath);
      }
    } catch (err) {
      showError(err.message || 'An error occurred');
      setTimeout(resetReceiveUI, 2000);
    }
  });

  receiveCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      receiveBtn.click();
    }
  });

  receiveCodeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toLowerCase();
  });
}

function initConfirmModal() {
  const confirmModal = document.getElementById('confirmModal');
  const declineBtn = document.getElementById('declineBtn');
  const acceptBtn = document.getElementById('acceptBtn');

  declineBtn.addEventListener('click', () => {
    confirmModal.classList.add('hidden');
    if (window.electronAPI) {
      window.electronAPI.confirmReceive(false);
    }
  });

  acceptBtn.addEventListener('click', () => {
    confirmModal.classList.add('hidden');
    if (window.electronAPI) {
      window.electronAPI.confirmReceive(true);
    }
  });
}

function showConfirmModal(fileName, fileSize) {
  document.getElementById('confirmFileName').textContent = fileName || 'Unknown file';
  document.getElementById('confirmFileSize').textContent = fileSize ? formatFileSize(fileSize) : 'Unknown size';
  document.getElementById('confirmModal').classList.remove('hidden');
}

function showError(message) {
  const progressText = document.getElementById('progressText');
  progressText.textContent = message;
  progressText.style.color = 'var(--error)';
  setTimeout(() => {
    progressText.style.color = '';
  }, 3000);
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
