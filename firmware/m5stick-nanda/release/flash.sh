#!/bin/bash
#
# Flash M5StickC Plus 2 firmware
#
# Usage:
#   ./flash.sh              # Auto-detect port
#   ./flash.sh /dev/ttyUSB0 # Specify port
#   ./flash.sh COM3         # Windows COM port (from WSL2)
#

PORT="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Auto-detect port if not specified
if [ -z "$PORT" ]; then
    if [ -e /dev/ttyUSB0 ]; then
        PORT=/dev/ttyUSB0
    elif [ -e /dev/ttyACM0 ]; then
        PORT=/dev/ttyACM0
    elif [ -e /dev/cu.usbserial* ]; then
        PORT=$(ls /dev/cu.usbserial* | head -1)
    else
        echo "No USB serial port detected."
        echo "Usage: $0 [PORT]"
        echo "  e.g., $0 /dev/ttyUSB0"
        echo "  e.g., $0 COM3 (for WSL2)"
        exit 1
    fi
fi

echo "Flashing M5StickC Plus 2 on $PORT..."

# Check if it's a Windows COM port (WSL2)
if [[ "$PORT" == COM* ]]; then
    echo "Detected Windows COM port, using PowerShell..."
    powershell.exe -Command "python -m esptool --chip esp32 --port $PORT --baud 1500000 write_flash -z --flash_mode dio --flash_freq 40m --flash_size detect 0x1000 $SCRIPT_DIR/bootloader.bin 0x8000 $SCRIPT_DIR/partitions.bin 0x10000 $SCRIPT_DIR/firmware.bin"
else
    # Native Linux/macOS
    if ! command -v esptool.py &> /dev/null && ! command -v esptool &> /dev/null; then
        echo "esptool not found. Installing..."
        pip install esptool
    fi

    ESPTOOL=$(command -v esptool.py || command -v esptool)
    $ESPTOOL --chip esp32 --port "$PORT" --baud 1500000 write_flash \
        -z --flash_mode dio --flash_freq 40m --flash_size detect \
        0x1000 "$SCRIPT_DIR/bootloader.bin" \
        0x8000 "$SCRIPT_DIR/partitions.bin" \
        0x10000 "$SCRIPT_DIR/firmware.bin"
fi

echo ""
echo "Done! Reset your M5Stick to boot the new firmware."
