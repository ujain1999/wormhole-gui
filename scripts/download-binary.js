const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const platforms = {
  mac: { os: 'darwin', arch: process.arch },
  win: { os: 'windows', arch: 'amd64' },
  linux: { os: 'linux', arch: process.arch }
};

function downloadBinary(target) {
  const config = platforms[target];
  if (!config) {
    console.log(`Unknown target: ${target}`);
    return;
  }

  console.log(`Downloading binary for ${target} (${config.os}-${config.arch})...`);

  const binDir = path.join(__dirname, '..', 'bin');
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  const ext = config.os === 'windows' ? '.exe' : '';
  const binPath = path.join(binDir, `wormhole-william${ext}`);

  const archMap = {
    'x64': 'amd64',
    'arm64': 'arm64',
    'ia32': '386'
  };

  const arch = archMap[config.arch] || config.arch;
  const binName = `wormhole-william-${config.os}-${arch}${ext}`;
  const url = `https://github.com/psanford/wormhole-william/releases/download/v1.0.8/${binName}`;

  console.log(`Downloading ${url}...`);

  execSync(`curl -L -o "${binPath}" "${url}"`, { stdio: 'inherit' });
  execSync(`chmod +x "${binPath}"`);

  console.log(`Downloaded to ${binPath}`);
}

const target = process.argv[2] || 'mac';
downloadBinary(target);
