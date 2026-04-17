#!/bin/bash
set -e

OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case $ARCH in
  x86_64) ARCH="amd64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *)
    echo "Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

case $OS in
  darwin) OS="darwin" ;;
  linux) OS="linux" ;;
  mingw*|cygwin*|msys*) OS="windows" ;;
  *)
    echo "Unsupported OS: $OS"
    exit 1
    ;;
esac

EXT=""
if [ "$OS" = "windows" ]; then
  EXT=".exe"
fi

BIN_NAME="wormhole-william-${OS}-${ARCH}${EXT}"
VERSION="v1.0.8"
DOWNLOAD_URL="https://github.com/psanford/wormhole-william/releases/download/${VERSION}/${BIN_NAME}"
BIN_DIR="$(dirname "$0")/../bin"
BIN_PATH="${BIN_DIR}/wormhole-william${EXT}"

mkdir -p "$BIN_DIR"

if [ -f "$BIN_PATH" ]; then
  echo "wormhole-william already installed at $BIN_PATH"
  exit 0
fi

echo "Downloading wormhole-william from GitHub..."
curl -L -o "$BIN_PATH" "$DOWNLOAD_URL"

chmod +x "$BIN_PATH"

echo "Installed wormhole-william at $BIN_PATH"
