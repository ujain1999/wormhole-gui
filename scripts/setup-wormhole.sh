#!/bin/bash
set -e

TARGET_OS="${1:-$(uname -s | tr '[:upper:]' '[:lower:]')}"
TARGET_ARCH="${2:-$(uname -m)}"

case $TARGET_ARCH in
  x86_64) TARGET_ARCH="amd64" ;;
  arm64|aarch64) TARGET_ARCH="arm64" ;;
  i386|i686) TARGET_ARCH="386" ;;
  *)
    echo "Unsupported architecture: $TARGET_ARCH"
    exit 1
    ;;
esac

case $TARGET_OS in
  darwin|macos) TARGET_OS="darwin" ;;
  linux) TARGET_OS="linux" ;;
  windows|win|mingw|cygwin|msys) TARGET_OS="windows" ;;
  *)
    echo "Unsupported OS: $TARGET_OS"
    exit 1
    ;;
esac

EXT=""
if [ "$TARGET_OS" = "windows" ]; then
  EXT=".exe"
fi

BIN_NAME="wormhole-william-${TARGET_OS}-${TARGET_ARCH}${EXT}"
VERSION="v1.0.8"
DOWNLOAD_URL="https://github.com/psanford/wormhole-william/releases/download/${VERSION}/${BIN_NAME}"
BIN_DIR="$(dirname "$0")/../bin"
BIN_PATH="${BIN_DIR}/wormhole-william${EXT}"

mkdir -p "$BIN_DIR"

echo "Downloading wormhole-william for ${TARGET_OS}-${TARGET_ARCH}..."
curl -L -o "$BIN_PATH" "$DOWNLOAD_URL"

chmod +x "$BIN_PATH"

echo "Installed wormhole-william at $BIN_PATH"
