#!/bin/bash
# NANDA Firmware Flash Tool
# No Bun/Node required - uses PlatformIO directly

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Add PlatformIO to PATH
export PATH="$HOME/.platformio/penv/bin:$PATH"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════╗"
    echo "║     NANDA Firmware Flash Tool          ║"
    echo "╚════════════════════════════════════════╝"
    echo -e "${NC}"
}

show_help() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  build       Compile firmware to .bin"
    echo "  flash       Build and flash to device"
    echo "  monitor     Open serial monitor"
    echo "  devices     List connected devices"
    echo "  ports       List available COM/serial ports"
    echo "  clean       Clean build files"
    echo "  full        Build, flash, and monitor"
    echo ""
    echo "Options:"
    echo "  --port=X    Specify port (e.g., --port=/dev/ttyUSB0)"
    echo ""
}

check_pio() {
    if ! command -v pio &> /dev/null; then
        echo -e "${RED}PlatformIO not found!${NC}"
        echo "Installing PlatformIO..."
        curl -fsSL https://raw.githubusercontent.com/platformio/platformio-core-installer/master/get-platformio.py -o /tmp/get-platformio.py
        python3 /tmp/get-platformio.py
        export PATH="$HOME/.platformio/penv/bin:$PATH"
    fi
}

list_ports() {
    echo -e "${YELLOW}Available serial ports:${NC}"
    echo ""

    # Linux
    if ls /dev/ttyUSB* 2>/dev/null; then
        echo -e "${GREEN}USB Serial:${NC}"
        ls -la /dev/ttyUSB* 2>/dev/null
    fi

    if ls /dev/ttyACM* 2>/dev/null; then
        echo -e "${GREEN}ACM Serial:${NC}"
        ls -la /dev/ttyACM* 2>/dev/null
    fi

    # WSL2 - check for Windows COM ports
    if grep -qi microsoft /proc/version 2>/dev/null; then
        echo ""
        echo -e "${YELLOW}WSL2 Detected!${NC}"
        echo "USB devices need to be attached via usbipd-win."
        echo ""
        echo "On Windows PowerShell (Admin):"
        echo "  1. winget install usbipd"
        echo "  2. usbipd list"
        echo "  3. usbipd bind --busid=<BUSID>"
        echo "  4. usbipd attach --wsl --busid=<BUSID>"
        echo ""
        echo "Or flash directly from Windows using:"
        echo "  - ESP Web Flasher: https://web.esphome.io/"
        echo "  - esptool.py on Windows"
    fi

    # PlatformIO device list
    echo ""
    echo -e "${YELLOW}PlatformIO device list:${NC}"
    pio device list 2>/dev/null || echo "No devices found"
}

build() {
    echo -e "${GREEN}Building firmware...${NC}"
    pio run
    echo ""
    echo -e "${GREEN}Build complete!${NC}"
    echo "Firmware binary: .pio/build/m5stick-c-plus2/firmware.bin"
    ls -lh .pio/build/m5stick-c-plus2/firmware.bin 2>/dev/null || true
}

flash() {
    echo -e "${GREEN}Building and flashing...${NC}"

    # Check if running in WSL2
    if grep -qi microsoft /proc/version 2>/dev/null; then
        echo -e "${YELLOW}WSL2 detected - using Windows esptool${NC}"
        local WIN_PORT="${PORT:-COM3}"
        local BUILD_DIR=".pio/build/m5stick-c-plus2"

        # Build first
        pio run

        # Flash via Windows Python - convert paths first
        cd "$BUILD_DIR"
        local BOOTLOADER_WIN=$(wslpath -w "$(pwd)/bootloader.bin")
        local PARTITIONS_WIN=$(wslpath -w "$(pwd)/partitions.bin")
        local FIRMWARE_WIN=$(wslpath -w "$(pwd)/firmware.bin")

        echo -e "${CYAN}Flashing to $WIN_PORT...${NC}"
        powershell.exe -Command "python -m esptool --chip esp32 --port $WIN_PORT --baud 1500000 --before default_reset --after hard_reset write_flash -z --flash_mode dio --flash_freq 80m --flash_size 4MB 0x1000 '$BOOTLOADER_WIN' 0x8000 '$PARTITIONS_WIN' 0x10000 '$FIRMWARE_WIN'"
        cd - > /dev/null
    else
        # Native Linux
        if [ -n "$PORT" ]; then
            pio run -t upload --upload-port "$PORT"
        else
            pio run -t upload
        fi
    fi
}

monitor() {
    echo -e "${GREEN}Opening serial monitor (Ctrl+C to exit)...${NC}"

    # Check if running in WSL2
    if grep -qi microsoft /proc/version 2>/dev/null; then
        local WIN_PORT="${PORT:-COM3}"
        echo -e "${YELLOW}WSL2 detected - using Windows serial monitor${NC}"
        powershell.exe -Command "python -m serial.tools.miniterm $WIN_PORT 115200"
    else
        if [ -n "$PORT" ]; then
            pio device monitor --port "$PORT" --baud 115200
        else
            pio device monitor --baud 115200
        fi
    fi
}

clean() {
    echo -e "${YELLOW}Cleaning build files...${NC}"
    pio run -t clean
    rm -rf .pio/build
    echo -e "${GREEN}Clean complete!${NC}"
}

# Parse arguments
PORT=""
for arg in "$@"; do
    case $arg in
        --port=*)
            PORT="${arg#*=}"
            ;;
    esac
done

# Main
print_header
check_pio

case "${1:-help}" in
    build)
        build
        ;;
    flash)
        flash
        ;;
    monitor)
        monitor
        ;;
    devices|ports)
        list_ports
        ;;
    clean)
        clean
        ;;
    full)
        flash
        monitor
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        show_help
        exit 1
        ;;
esac
