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

const raw_words = {
  '00': ['aardvark', 'adroitness'],
  '01': ['absurd', 'adviser'],
  '02': ['accrue', 'aftermath'],
  '03': ['acme', 'aggregate'],
  '04': ['adrift', 'alkali'],
  '05': ['adult', 'almighty'],
  '06': ['afflict', 'amulet'],
  '07': ['ahead', 'amusement'],
  '08': ['aimless', 'antenna'],
  '09': ['Algol', 'applicant'],
  '0A': ['allow', 'Apollo'],
  '0B': ['alone', 'armistice'],
  '0C': ['ammo', 'article'],
  '0D': ['ancient', 'asteroid'],
  '0E': ['apple', 'Atlantic'],
  '0F': ['artist', 'atmosphere'],
  '10': ['assume', 'autopsy'],
  '11': ['Athens', 'Babylon'],
  '12': ['atlas', 'backwater'],
  '13': ['Aztec', 'barbecue'],
  '14': ['baboon', 'belowground'],
  '15': ['backfield', 'bifocals'],
  '16': ['backward', 'bodyguard'],
  '17': ['banjo', 'bookseller'],
  '18': ['beaming', 'borderline'],
  '19': ['bedlamp', 'bottomless'],
  '1A': ['beehive', 'Bradbury'],
  '1B': ['beeswax', 'bravado'],
  '1C': ['befriend', 'Brazilian'],
  '1D': ['Belfast', 'breakaway'],
  '1E': ['berserk', 'Burlington'],
  '1F': ['billiard', 'businessman'],
  '20': ['bison', 'butterfat'],
  '21': ['blackjack', 'Camelot'],
  '22': ['blockade', 'candidate'],
  '23': ['blowtorch', 'cannonball'],
  '24': ['bluebird', 'Capricorn'],
  '25': ['bombast', 'caravan'],
  '26': ['bookshelf', 'caretaker'],
  '27': ['brackish', 'celebrate'],
  '28': ['breadline', 'cellulose'],
  '29': ['breakup', 'certify'],
  '2A': ['brickyard', 'chambermaid'],
  '2B': ['briefcase', 'Cherokee'],
  '2C': ['Burbank', 'Chicago'],
  '2D': ['button', 'clergyman'],
  '2E': ['buzzard', 'coherence'],
  '2F': ['cement', 'combustion'],
  '30': ['chairlift', 'commando'],
  '31': ['chatter', 'company'],
  '32': ['checkup', 'component'],
  '33': ['chisel', 'concurrent'],
  '34': ['choking', 'confidence'],
  '35': ['chopper', 'conformist'],
  '36': ['Christmas', 'congregate'],
  '37': ['clamshell', 'consensus'],
  '38': ['classic', 'consulting'],
  '39': ['classroom', 'corporate'],
  '3A': ['cleanup', 'corrosion'],
  '3B': ['clockwork', 'councilman'],
  '3C': ['cobra', 'crossover'],
  '3D': ['commence', 'crucifix'],
  '3E': ['concert', 'cumbersome'],
  '3F': ['cowbell', 'customer'],
  '40': ['crackdown', 'Dakota'],
  '41': ['cranky', 'decadence'],
  '42': ['crowfoot', 'December'],
  '43': ['crucial', 'decimal'],
  '44': ['crumpled', 'designing'],
  '45': ['crusade', 'detector'],
  '46': ['cubic', 'detergent'],
  '47': ['dashboard', 'determine'],
  '48': ['deadbolt', 'dictator'],
  '49': ['deckhand', 'dinosaur'],
  '4A': ['dogsled', 'direction'],
  '4B': ['dragnet', 'disable'],
  '4C': ['drainage', 'disbelief'],
  '4D': ['dreadful', 'disruptive'],
  '4E': ['drifter', 'distortion'],
  '4F': ['dropper', 'document'],
  '50': ['drumbeat', 'embezzle'],
  '51': ['drunken', 'enchanting'],
  '52': ['Dupont', 'enrollment'],
  '53': ['dwelling', 'enterprise'],
  '54': ['eating', 'equation'],
  '55': ['edict', 'equipment'],
  '56': ['egghead', 'escapade'],
  '57': ['eightball', 'Eskimo'],
  '58': ['endorse', 'everyday'],
  '59': ['endow', 'examine'],
  '5A': ['enlist', 'existence'],
  '5B': ['erase', 'exodus'],
  '5C': ['escape', 'fascinate'],
  '5D': ['exceed', 'filament'],
  '5E': ['eyeglass', 'finicky'],
  '5F': ['eyetooth', 'forever'],
  '60': ['facial', 'fortitude'],
  '61': ['fallout', 'frequency'],
  '62': ['flagpole', 'gadgetry'],
  '63': ['flatfoot', 'Galveston'],
  '64': ['flytrap', 'getaway'],
  '65': ['fracture', 'glossary'],
  '66': ['framework', 'gossamer'],
  '67': ['freedom', 'graduate'],
  '68': ['frighten', 'gravity'],
  '69': ['gazelle', 'guitarist'],
  '6A': ['Geiger', 'hamburger'],
  '6B': ['glitter', 'Hamilton'],
  '6C': ['glucose', 'handiwork'],
  '6D': ['goggles', 'hazardous'],
  '6E': ['goldfish', 'headwaters'],
  '6F': ['gremlin', 'hemisphere'],
  '70': ['guidance', 'hesitate'],
  '71': ['hamlet', 'hideaway'],
  '72': ['highchair', 'holiness'],
  '73': ['hockey', 'hurricane'],
  '74': ['indoors', 'hydraulic'],
  '75': ['indulge', 'impartial'],
  '76': ['inverse', 'impetus'],
  '77': ['involve', 'inception'],
  '78': ['island', 'indigo'],
  '79': ['jawbone', 'inertia'],
  '7A': ['keyboard', 'infancy'],
  '7B': ['kickoff', 'inferno'],
  '7C': ['kiwi', 'informant'],
  '7D': ['klaxon', 'insincere'],
  '7E': ['locale', 'insurgent'],
  '7F': ['lockup', 'integrate'],
  '80': ['merit', 'intention'],
  '81': ['minnow', 'inventive'],
  '82': ['miser', 'Istanbul'],
  '83': ['Mohawk', 'Jamaica'],
  '84': ['mural', 'Jupiter'],
  '85': ['music', 'leprosy'],
  '86': ['necklace', 'letterhead'],
  '87': ['Neptune', 'liberty'],
  '88': ['newborn', 'maritime'],
  '89': ['nightbird', 'matchmaker'],
  '8A': ['Oakland', 'maverick'],
  '8B': ['obtuse', 'Medusa'],
  '8C': ['offload', 'megaton'],
  '8D': ['optic', 'microscope'],
  '8E': ['orca', 'microwave'],
  '8F': ['payday', 'midsummer'],
  '90': ['peachy', 'millionaire'],
  '91': ['pheasant', 'miracle'],
  '92': ['physique', 'misnomer'],
  '93': ['playhouse', 'molasses'],
  '94': ['Pluto', 'molecule'],
  '95': ['preclude', 'Montana'],
  '96': ['prefer', 'monument'],
  '97': ['preshrunk', 'mosquito'],
  '98': ['printer', 'narrative'],
  '99': ['prowler', 'nebula'],
  '9A': ['pupil', 'newsletter'],
  '9B': ['puppy', 'Norwegian'],
  '9C': ['python', 'October'],
  '9D': ['quadrant', 'Ohio'],
  '9E': ['quiver', 'onlooker'],
  '9F': ['quota', 'opulent'],
  'A0': ['ragtime', 'Orlando'],
  'A1': ['ratchet', 'outfielder'],
  'A2': ['rebirth', 'Pacific'],
  'A3': ['reform', 'pandemic'],
  'A4': ['regain', 'Pandora'],
  'A5': ['reindeer', 'paperweight'],
  'A6': ['rematch', 'paragon'],
  'A7': ['repay', 'paragraph'],
  'A8': ['retouch', 'paramount'],
  'A9': ['revenge', 'passenger'],
  'AA': ['reward', 'pedigree'],
  'AB': ['rhythm', 'Pegasus'],
  'AC': ['ribcage', 'penetrate'],
  'AD': ['ringbolt', 'perceptive'],
  'AE': ['robust', 'performance'],
  'AF': ['rocker', 'pharmacy'],
  'B0': ['ruffled', 'phonetic'],
  'B1': ['sailboat', 'photograph'],
  'B2': ['sawdust', 'pioneer'],
  'B3': ['scallion', 'pocketful'],
  'B4': ['scenic', 'politeness'],
  'B5': ['scorecard', 'positive'],
  'B6': ['Scotland', 'potato'],
  'B7': ['seabird', 'processor'],
  'B8': ['select', 'provincial'],
  'B9': ['sentence', 'proximate'],
  'BA': ['shadow', 'puberty'],
  'BB': ['shamrock', 'publisher'],
  'BC': ['showgirl', 'pyramid'],
  'BD': ['skullcap', 'quantity'],
  'BE': ['skydive', 'racketeer'],
  'BF': ['slingshot', 'rebellion'],
  'C0': ['slowdown', 'recipe'],
  'C1': ['snapline', 'recover'],
  'C2': ['snapshot', 'repellent'],
  'C3': ['snowcap', 'replica'],
  'C4': ['snowslide', 'reproduce'],
  'C5': ['solo', 'resistor'],
  'C6': ['southward', 'responsive'],
  'C7': ['soybean', 'retraction'],
  'C8': ['spaniel', 'retrieval'],
  'C9': ['spearhead', 'retrospect'],
  'CA': ['spellbind', 'revenue'],
  'CB': ['spheroid', 'revival'],
  'CC': ['spigot', 'revolver'],
  'CD': ['spindle', 'sandalwood'],
  'CE': ['spyglass', 'sardonic'],
  'CF': ['stagehand', 'Saturday'],
  'D0': ['stagnate', 'savagery'],
  'D1': ['stairway', 'scavenger'],
  'D2': ['standard', 'sensation'],
  'D3': ['stapler', 'sociable'],
  'D4': ['steamship', 'souvenir'],
  'D5': ['sterling', 'specialist'],
  'D6': ['stockman', 'speculate'],
  'D7': ['stopwatch', 'stethoscope'],
  'D8': ['stormy', 'stupendous'],
  'D9': ['sugar', 'supportive'],
  'DA': ['surmount', 'surrender'],
  'DB': ['suspense', 'suspicious'],
  'DC': ['sweatband', 'sympathy'],
  'DD': ['swelter', 'tambourine'],
  'DE': ['tactics', 'telephone'],
  'DF': ['talon', 'therapist'],
  'E0': ['tapeworm', 'tobacco'],
  'E1': ['tempest', 'tolerance'],
  'E2': ['tiger', 'tomorrow'],
  'E3': ['tissue', 'torpedo'],
  'E4': ['tonic', 'tradition'],
  'E5': ['topmost', 'travesty'],
  'E6': ['tracker', 'trombonist'],
  'E7': ['transit', 'truncated'],
  'E8': ['trauma', 'typewriter'],
  'E9': ['treadmill', 'ultimate'],
  'EA': ['Trojan', 'undaunted'],
  'EB': ['trouble', 'underfoot'],
  'EC': ['tumor', 'unicorn'],
  'ED': ['tunnel', 'unify'],
  'EE': ['tycoon', 'universe'],
  'EF': ['uncut', 'unravel'],
  'F0': ['unearth', 'upcoming'],
  'F1': ['unwind', 'vacancy'],
  'F2': ['uproot', 'vagabond'],
  'F3': ['upset', 'vertigo'],
  'F4': ['upshot', 'Virginia'],
  'F5': ['vapor', 'visitor'],
  'F6': ['village', 'vocalist'],
  'F7': ['virus', 'voyager'],
  'F8': ['Vulcan', 'warranty'],
  'F9': ['waffle', 'Waterloo'],
  'FA': ['wallet', 'whimsical'],
  'FB': ['watchword', 'Wichita'],
  'FC': ['wayside', 'Wilmington'],
  'FD': ['willow', 'Wyoming'],
  'FE': ['woodlark', 'yesteryear'],
  'FF': ['Zulu', 'Yucatan']
};

const evenWords = new Set();
const oddWords = new Set();

for (const key in raw_words) {
  const [even, odd] = raw_words[key];
  evenWords.add(even.toLowerCase());
  oddWords.add(odd.toLowerCase());
}

function getWordCompletions(prefix, numWords = 2) {
  const parts = prefix.split('-');
  const count = parts.length - 1;
  const lastPartialWord = parts[parts.length - 1];
  const lp = lastPartialWord.length;
  const completions = new Set();

  const wordSet = count % 2 === 0 ? oddWords : evenWords;
  const currentWord = count + 1;
  const needsMore = currentWord < numWords;

  for (const word of wordSet) {
    if (word.startsWith(lastPartialWord)) {
      let suffix;
      if (lp === 0) {
        suffix = prefix + word;
      } else {
        suffix = prefix.slice(0, -lp) + word;
      }
      if (needsMore) {
        suffix += '-';
      }
      completions.add(suffix);
    }
  }

  return Array.from(completions).slice(0, 8);
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

  receiveCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      receiveBtn.click();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const value = receiveCodeInput.value.toLowerCase().trim();

      if (/^\d+$/.test(value)) {
        return;
      }

      if (value.length > 0) {
        const completions = getWordCompletions(value, 2);
        if (completions.length > 0) {
          const hyphenCount = (value.match(/-/g) || []).length;
          const suffix = hyphenCount === 1 ? '-' : '';
          const completion = completions[0] + suffix;
          receiveCodeInput.value = completion;
          const predictionEl = document.getElementById('receiveCodePrediction');
          predictionEl.textContent = '';
          predictionEl.classList.remove('visible');
        }
      }
    }
  });

  receiveCodeInput.addEventListener('input', (e) => {
    const lowerValue = e.target.value.toLowerCase();
    const value = lowerValue.trim();
    const predictionEl = document.getElementById('receiveCodePrediction');

    const cleanValue = value.replace(/-/g, '');

    if (cleanValue.length > 0 && !/^\d+$/.test(cleanValue)) {
      const completions = getWordCompletions(value, 2);
      if (completions.length > 0) {
        const hyphenCount = (value.match(/-/g) || []).length;
        const suffix = hyphenCount === 1 ? '-' : '';
        const completion = completions[0] + suffix;
        const prediction = completion.slice(value.length);
        predictionEl.textContent = prediction;
        const tempSpan = document.createElement('span');
        tempSpan.style.font = getComputedStyle(e.target).font;
        tempSpan.style.letterSpacing = getComputedStyle(e.target).letterSpacing;
        tempSpan.textContent = value.substring(0, e.target.selectionStart);
        document.body.appendChild(tempSpan);
        const width = tempSpan.offsetWidth;
        document.body.removeChild(tempSpan);
        predictionEl.style.left = (width + 26) + 'px';
        predictionEl.classList.add('visible');
      } else {
        predictionEl.classList.remove('visible');
      }
    } else {
      predictionEl.classList.remove('visible');
    }
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
