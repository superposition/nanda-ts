#!/bin/bash
# Download all dependencies for offline builds
# Run this once while you have internet access

set -e
cd "$(dirname "$0")/.."

echo "=== NANDA Firmware: Downloading offline dependencies ==="

# Install PlatformIO core if needed
if ! command -v pio &> /dev/null; then
    echo "Installing PlatformIO..."
    pip install platformio
fi

# Download platform and toolchains
echo "Downloading ESP32 platform..."
pio pkg install -p espressif32

# Download all library dependencies
echo "Downloading libraries..."
pio pkg install

# Download board definitions
echo "Downloading board definitions..."
pio boards m5stick-c > /dev/null 2>&1

# Create vendored libs backup
echo "Creating lib backup..."
mkdir -p lib-backup
cp -r .pio/libdeps/m5stick-c-plus2/* lib-backup/ 2>/dev/null || true

echo ""
echo "=== Done! ==="
echo "Dependencies saved to:"
echo "  - .pio/libdeps/  (PlatformIO managed)"
echo "  - lib-backup/    (manual backup)"
echo ""
echo "For fully offline builds, copy this entire directory"
echo "including .pio/ folder to the air-gapped machine."
