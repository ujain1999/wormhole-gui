# Wormhole GUI

A beautiful, minimal desktop application for [magic-wormhole](https://github.com/magic-wormhole/magic-wormhole). Send and receive files securely between devices using easy-to-share codes or QR codes.

## Features

- Send files with drag and drop or file picker
- Receive files by entering the wormhole code
- QR code support for easy mobile transfers
- Light and dark themes
- Configurable default download location
- File confirmation dialog on receive
- Automatic wormhole binary installation

## Requirements

- Node.js 18+
- npm 8+

## Installation

```bash
npm install
```

## Development

```bash
npm start
```

## Building

```bash
# Download binaries for each platform
node scripts/download-binary.js mac
node scripts/download-binary.js win
node scripts/download-binary.js linux

# Build each platform
npm run build:mac    # macOS (dmg + zip)
npm run build:win    # Windows (portable zip)
npm run build:linux  # Linux (AppImage)
```

Builds are output to the `dist/` folder.

## How it works

1. **Send**: Select files, click Send, share the code or QR with the receiver
2. **Receive**: Enter the code or scan the QR, confirm to accept the file

## Tech Stack

- Electron
- [wormhole-william](https://github.com/psanford/wormhole-william) (Go implementation of magic-wormhole)
- QRCode

