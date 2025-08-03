# Magic Wormhole GUI

A beautiful, native macOS GUI application for magic-wormhole file transfers.

## Features

- **File Transfers**: Send and receive files with drag-and-drop support
- **Text Messages**: Send and receive text messages securely
- **Real-time Progress**: Live progress tracking and status updates
- **System Integration**: Native file dialogs, notifications, and folder opening
- **Transfer History**: Persistent history of all transfers
- **Auto-installation**: Automatically installs magic-wormhole if missing
- **macOS Native**: Follows macOS design guidelines and behaviors

## Prerequisites

- macOS 10.14 or later
- Node.js 16+ and npm
- Python 3 and pip3 (for magic-wormhole installation)

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd magic-wormhole-gui
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the application:**
   ```bash
   npm start
   ```

4. **Build for distribution:**
   ```bash
   npm run build
   ```

## Usage

### Sending Files
1. Click the **Send** tab
2. Click in the drop zone or drag files to select them
3. Click **Send Files**
4. Share the generated wormhole code with the recipient

### Receiving Files
1. Click the **Receive** tab
2. Enter the wormhole code from the sender
3. Choose a download location (defaults to Downloads folder)
4. Click **Receive Files**

### Text Messages
1. Click the **Text** tab
2. Choose **Send Text** or **Receive Text**
3. For sending: Enter your message and click **Send Text**
4. For receiving: Enter the wormhole code and click **Receive Text**

### Settings
- **Transfer Settings**: Configure checksums and file overwriting
- **Notifications**: Control system notifications and folder opening
- **Advanced**: Custom relay servers and code lengths
- **History**: View and manage transfer history

## How It Works

The application uses Electron to provide a native macOS interface while interfacing with the magic-wormhole command-line tool through Node.js child processes. All transfers use the actual magic-wormhole protocol for security and compatibility.

## Security

- Uses the official magic-wormhole protocol
- End-to-end encryption for all transfers
- No data stored on intermediate servers
- Codes are single-use and expire quickly

## Building from Source

The app can be packaged as a native macOS application:

```bash
npm run dist
```

This creates a `.dmg` file in the `dist` folder that can be distributed and installed like any macOS application.

## Development

The application consists of three main parts:

- **main.js**: Electron main process that handles system integration and wormhole process management
- **preload.js**: Secure bridge between main and renderer processes
- **renderer.js**: Frontend logic and UI management
- **index.html**: Application UI and styling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.