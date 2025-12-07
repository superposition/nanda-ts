# NANDA A2A Server - M5StickC Plus 2

ESP32 firmware that turns the M5StickC Plus 2 into a NANDA-compatible agent.

## Quick Start

### 1. Start the Registry (on any computer)

```bash
# Option A: Docker (recommended - works on any platform)
cd nanda-ts
docker compose -f docker-compose.registry.yml up -d

# Option B: Direct (requires Bun)
bun examples/local-registry.ts
```

The registry listens on port 3000 and the M5Stick will auto-discover it.

### 2. Configure WiFi

Edit `src/main.cpp`:
```cpp
const char* WIFI_SSID = "YourWiFi";
const char* WIFI_PASS = "YourPassword";
```

### 3. Build & Flash

```bash
# Compile
~/.platformio/penv/bin/pio run

# Upload (adjust COM port as needed)
# Windows/WSL:
powershell.exe -Command "python -m esptool --chip esp32 --port COM3 --baud 1500000 write_flash -z --flash-mode dio --flash-freq 40m --flash-size detect 0x1000 .pio/build/m5stick-c-plus2/bootloader.bin 0x8000 .pio/build/m5stick-c-plus2/partitions.bin 0x10000 .pio/build/m5stick-c-plus2/firmware.bin"

# Linux/Mac:
esptool.py --chip esp32 --port /dev/ttyUSB0 --baud 1500000 write_flash -z 0x1000 .pio/build/m5stick-c-plus2/bootloader.bin 0x8000 .pio/build/m5stick-c-plus2/partitions.bin 0x10000 .pio/build/m5stick-c-plus2/firmware.bin
```

### 4. Boot Sequence

1. Shows "NANDA" splash with device handle
2. Connects to WiFi
3. Auto-discovers registry (tries gateway:3000, x.x.x.100:3000, etc.)
4. Registers and shows "INSTALLED" with victory beep
5. Home screen shows: device ID, IP, registry status, agent count

## Architecture

```
┌────────────────────────────────────────────┐
│           M5StickC Plus 2                  │
├────────────────────────────────────────────┤
│  /.well-known/agent.json  → Agent Card     │
│  /a2a                     → JSON-RPC       │
│  /api/*                   → Direct REST    │
├────────────────────────────────────────────┤
│  Skills:                                   │
│  - sensors/read  (IMU, temp)               │
│  - display/show  (LCD)                     │
│  - ir/send       (IR TX)                   │
│  - ir/learn      (IR RX)                   │
│  - button/status (A, B, PWR)               │
│  - buzzer/tone   (speaker)                 │
│  - led/set       (GPIO19)                  │
│  - battery/status (voltage, %)             │
│  - wifi/scan     (networks)                │
└────────────────────────────────────────────┘
```

## Offline Build (No Internet Required)

### Option 1: Pre-download libraries

```bash
# First time only (requires internet)
cd firmware/m5stick-nanda
pio pkg install

# This downloads to .pio/libdeps/ - commit these or copy offline
```

### Option 2: Vendor libraries locally

```bash
mkdir -p lib/
# Copy these libraries into lib/:
# - M5StickCPlus2
# - ArduinoJson
# - AsyncTCP
# - ESPAsyncWebServer
```

### Option 3: Use lib_extra_dirs

Add to platformio.ini:
```ini
lib_extra_dirs = /path/to/offline/libs
```

## Build Commands

```bash
# Build only
pio run

# Build and upload via USB
pio run -t upload

# Monitor serial output
pio device monitor

# Build + upload + monitor
pio run -t upload && pio device monitor
```

## Flash Partition Layout

Using default 4MB partition:
- app0:  1.2MB (firmware)
- spiffs: 1.5MB (files/config)

## First Boot

1. Device starts in AP mode: `NANDA-Config`
2. Connect and go to `http://192.168.4.1/setup`
3. Enter your LAN WiFi credentials
4. Device reboots and joins your network
5. Access agent at `http://<device-ip>/.well-known/agent.json`

## mDNS Discovery

The device broadcasts as `nanda-device.local` on your local network:

```bash
# Access via mDNS (no IP needed!)
curl http://nanda-device.local/.well-known/agent.json

# Discover NANDA agents on the network (Linux/Mac)
avahi-browse -r _nanda._tcp

# Or on Mac
dns-sd -B _nanda._tcp
```

The device advertises two services:
- `_http._tcp` - Standard HTTP service
- `_nanda._tcp` - NANDA A2A agent (with TXT records for version/type)

## API Usage

```bash
# Get agent card (via mDNS)
curl http://nanda-device.local/.well-known/agent.json

# Or via IP
curl http://192.168.1.100/.well-known/agent.json

# Read sensors directly
curl http://192.168.1.100/api/sensors

# A2A JSON-RPC call
curl -X POST http://192.168.1.100/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tasks/send",
    "params": {
      "message": {
        "parts": [{
          "skill": "sensors/read",
          "parameters": {}
        }]
      }
    }
  }'
```

## Connecting from nanda-ts

```typescript
import { A2AClient } from 'nanda-ts/client';

// Connect via mDNS hostname
const device = new A2AClient('http://nanda-device.local');
const card = await device.getAgentCard();

console.log('Found device:', card.name);
console.log('Skills:', card.skills.map(s => s.id));

// Execute skill
const result = await device.sendTask({
  skill: 'sensors/read'
});
console.log('Sensors:', result);
```
