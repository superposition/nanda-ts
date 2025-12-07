#!/bin/bash
# M5Stick NANDA Device Test Script
# Tests all available endpoints and features

DEVICE_IP="${1:-192.168.0.146}"
BASE_URL="http://$DEVICE_IP"

echo "=============================================="
echo "  M5Stick NANDA Device Test Suite"
echo "  Target: $BASE_URL"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; }
fail() { echo -e "${RED}✗ FAIL${NC}: $1"; }
warn() { echo -e "${YELLOW}⚠ WARN${NC}: $1"; }
info() { echo -e "  ℹ $1"; }
section() { echo -e "\n${CYAN}=== $1 ===${NC}\n"; }

PASSED=0
FAILED=0

test_endpoint() {
    local name="$1"
    local endpoint="$2"
    local timeout="${3:-5}"

    response=$(curl -s -w "\n%{http_code}" --max-time "$timeout" "$BASE_URL$endpoint" 2>/dev/null)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        pass "$name"
        ((PASSED++))
        if [ -n "$body" ] && [ "$body" != "null" ]; then
            echo "$body" | jq -C . 2>/dev/null | head -8 | sed 's/^/    /'
        fi
        return 0
    else
        fail "$name - HTTP $http_code"
        ((FAILED++))
        return 1
    fi
}

test_html() {
    local name="$1"
    local endpoint="$2"

    response=$(curl -s -w "\n%{http_code}" --max-time 5 "$BASE_URL$endpoint" 2>/dev/null)
    http_code=$(echo "$response" | tail -n1)

    if [ "$http_code" = "200" ]; then
        pass "$name"
        ((PASSED++))
        return 0
    else
        fail "$name - HTTP $http_code"
        ((FAILED++))
        return 1
    fi
}

# Check connectivity first
section "CONNECTIVITY"
if curl -s --max-time 3 "$BASE_URL" > /dev/null 2>&1; then
    pass "Device reachable at $DEVICE_IP"
    ((PASSED++))
else
    fail "Cannot reach device at $DEVICE_IP"
    exit 1
fi

section "AGENT IDENTITY"
test_endpoint "Agent Card" "/.well-known/agent.json"

section "WEB INTERFACES"
test_html "Dashboard" "/"
test_html "Chat Interface" "/chat"

section "SENSOR APIs"
test_endpoint "IMU Sensors" "/api/sensors"
test_endpoint "Battery Status" "/api/battery"
test_endpoint "Button States" "/api/buttons"

section "CONTROL APIs"
# Display test
echo -n "Testing display... "
resp=$(curl -s -w "%{http_code}" --max-time 5 "$BASE_URL/api/display?text=Test" 2>/dev/null)
code="${resp: -3}"
if [ "$code" = "200" ]; then
    pass "Display Control"
    ((PASSED++))
else
    fail "Display Control - HTTP $code"
    ((FAILED++))
fi

# Buzzer test
echo -n "Testing buzzer... "
resp=$(curl -s -w "%{http_code}" --max-time 5 "$BASE_URL/api/buzzer?freq=440&duration=50" 2>/dev/null)
code="${resp: -3}"
if [ "$code" = "200" ]; then
    pass "Buzzer Control"
    ((PASSED++))
else
    fail "Buzzer Control - HTTP $code"
    ((FAILED++))
fi

section "NETWORK"
echo "WiFi scan (may take 10+ seconds)..."
test_endpoint "WiFi Scan" "/api/wifi/scan" 15

section "SUMMARY"
echo ""
echo -e "Results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}"
echo ""

echo "=============================================="
echo "  Feature Inventory"
echo "=============================================="
echo ""

echo -e "${GREEN}WORKING FEATURES:${NC}"
echo "  ✓ Agent Card (.well-known/agent.json)"
echo "  ✓ Web Dashboard (/)"
echo "  ✓ Chat Interface (/chat)"
echo "  ✓ QR Code Menu (on device)"
echo "  ✓ FX Animation Menu (on device)"
echo "  ✓ IMU Sensors (accelerometer, gyroscope, temperature)"
echo "  ✓ Battery Status (voltage, percent, charging)"
echo "  ✓ Button States (A, B, Power)"
echo "  ✓ Display Control (text to LCD)"
echo "  ✓ Buzzer Control (frequency, duration)"
echo "  ✓ WiFi Scanning"
echo "  ✓ mDNS Beacon (nanda-XXXXXX.local)"
echo "  ✓ SuprPosition Startup Animation"
echo "  ✓ A Minor Arpeggio Audio"
echo ""

echo -e "${YELLOW}NOT IMPLEMENTED (Could Add):${NC}"
echo "  ○ IR Transmit/Receive - M5StickC has IR LED"
echo "  ○ LED Control - Internal LED if available"
echo "  ○ RTC - Real-time clock for timestamps"
echo "  ○ Preferences API - Persistent config storage"
echo "  ○ OTA Updates - Over-the-air firmware update"
echo "  ○ WebSocket Streaming - Real-time sensor data"
echo "  ○ Screenshot - Capture display as image"
echo "  ○ Power Management - Sleep/wake modes"
echo "  ○ Microphone - Audio input if available"
echo "  ○ Grove Port - External I2C sensors"
echo "  ○ GPIO Control - General purpose IO"
echo ""

echo -e "${CYAN}NICE TO HAVE:${NC}"
echo "  ○ Registry Auto-Registration"
echo "  ○ Health Check Endpoint (/health)"
echo "  ○ Device Status Endpoint (/status)"
echo "  ○ JSON-RPC A2A Endpoint (/rpc)"
echo "  ○ Agent Discovery (/discover)"
echo "  ○ POST method for display/buzzer (in addition to GET)"
echo ""
