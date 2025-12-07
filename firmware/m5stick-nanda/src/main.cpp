/**
 * NANDA A2A Server for M5StickC Plus 2
 * Using M5Unified library
 *
 * Menu-based UI with button navigation:
 * - BtnA (big button): Select/confirm
 * - BtnB (side button): Next menu item
 *
 * Features:
 * - Unique device ID from MAC address
 * - Registry registration with heartbeats
 * - mDNS beacon for local discovery
 * - Agent discovery on network
 */

#include <M5Unified.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <ESPmDNS.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WebSocketsClient.h>
#include <qrcode.h>

// ============================================================================
// Configuration
// ============================================================================

#define AGENT_VERSION "1.0.0"
#define HTTP_PORT 80

// Registry settings
// Default registry - can be overridden via preferences or WiFi gateway detection
#define DEFAULT_REGISTRY_PORT 3000
#define HEARTBEAT_INTERVAL 30000  // 30 seconds

// Public registry discovery URL (fallback when no local registry found)
// This URL returns a list of available public registries
const char* PUBLIC_REGISTRY_LIST = "https://raw.githubusercontent.com/nanda-framework/registries/main/list.json";

// WiFi credentials
const char* WIFI_SSID = "TP-Link_A768";
const char* WIFI_PASS = "49392012";

// ============================================================================
// Menu System
// ============================================================================

enum MenuScreen {
    MENU_HOME = 0,
    MENU_SENSORS,
    MENU_NETWORK,
    MENU_DISCOVERY,
    MENU_BATTERY,
    MENU_IR,
    MENU_FX,
    MENU_QR,
    MENU_COUNT  // Keep last
};

const char* menuLabels[] = {
    "Home",
    "Sensors",
    "Network",
    "Discovery",
    "Battery",
    "IR Control",
    "FX",
    "QR Chat"
};

MenuScreen currentScreen = MENU_HOME;
bool needsRedraw = true;

// Message display state (for showing messages temporarily)
bool showingMessage = false;
unsigned long messageDisplayTime = 0;
const unsigned long MESSAGE_DISPLAY_DURATION = 5000;  // Show messages for 5 seconds

// A minor diatonic arpeggio frequencies (A3, C4, E4, A4, E4, C4, A3)
const int AMIN_ARPEGGIO[] = {220, 262, 330, 440, 330, 262, 220};
const int ARPEGGIO_LEN = 7;

// ============================================================================
// Global State
// ============================================================================

AsyncWebServer server(HTTP_PORT);
Preferences preferences;
bool wifiConnected = false;
bool mdnsStarted = false;
String deviceIP = "";

// Device identity (generated from MAC)
String deviceId = "";
String deviceHandle = "";
String deviceHostname = "";
String deviceName = "";

// Registry state
String registryUrl = "";
bool registryConnected = false;
unsigned long lastHeartbeat = 0;
int heartbeatFailures = 0;

// Discovered agents
struct DiscoveredAgent {
    String handle;
    String url;
    String name;
    bool healthy;
};
DiscoveredAgent discoveredAgents[10];
int discoveredAgentCount = 0;
unsigned long lastDiscovery = 0;

// WebSocket tunnel for external access
WebSocketsClient webSocket;
bool tunnelConnected = false;
unsigned long lastTunnelReconnect = 0;
#define TUNNEL_RECONNECT_INTERVAL 10000

// Sensor data
struct SensorData {
    float accelX, accelY, accelZ;
    float gyroX, gyroY, gyroZ;
    float temperature;
    float batteryVoltage;
    int batteryPercent;
    bool isCharging;
    unsigned long lastUpdate;
} sensors;

// ============================================================================
// Display Helpers
// ============================================================================

void drawHeader(const char* title) {
    M5.Display.fillScreen(TFT_BLACK);
    M5.Display.setTextColor(TFT_CYAN);
    M5.Display.setTextSize(2);
    M5.Display.setCursor(5, 5);
    M5.Display.println(title);

    // Draw separator line
    M5.Display.drawLine(0, 25, 240, 25, TFT_DARKGREY);
}

void drawNavHint() {
    M5.Display.setTextColor(TFT_DARKGREY);
    M5.Display.setTextSize(1);
    M5.Display.setCursor(5, 125);
    M5.Display.print("A:Select  B:Next");
}

void drawMenuItem(int y, const char* label, bool selected) {
    if (selected) {
        M5.Display.fillRect(0, y - 2, 240, 18, TFT_NAVY);
        M5.Display.setTextColor(TFT_WHITE);
    } else {
        M5.Display.setTextColor(TFT_LIGHTGREY);
    }
    M5.Display.setTextSize(2);
    M5.Display.setCursor(10, y);
    M5.Display.print(label);
}

// ============================================================================
// Sensor Functions
// ============================================================================

void updateSensors() {
    float ax, ay, az, gx, gy, gz;

    M5.Imu.getAccel(&ax, &ay, &az);
    M5.Imu.getGyro(&gx, &gy, &gz);

    sensors.accelX = ax;
    sensors.accelY = ay;
    sensors.accelZ = az;
    sensors.gyroX = gx;
    sensors.gyroY = gy;
    sensors.gyroZ = gz;

    // Temperature from IMU
    float t;
    M5.Imu.getTemp(&t);
    sensors.temperature = t;

    // Battery
    sensors.batteryVoltage = M5.Power.getBatteryVoltage() / 1000.0f;
    sensors.batteryPercent = M5.Power.getBatteryLevel();
    sensors.isCharging = M5.Power.isCharging();

    sensors.lastUpdate = millis();
}

// ============================================================================
// Device Identity
// ============================================================================

void generateDeviceId() {
    // Get MAC address as unique identifier
    uint8_t mac[6];
    WiFi.macAddress(mac);

    // Create short ID from last 3 bytes of MAC (e.g., "a1b2c3")
    char shortId[7];
    snprintf(shortId, sizeof(shortId), "%02x%02x%02x", mac[3], mac[4], mac[5]);

    // Full device ID
    char fullId[18];
    snprintf(fullId, sizeof(fullId), "%02x%02x%02x%02x%02x%02x",
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);

    deviceId = String(fullId);
    deviceHandle = "m5stick-" + String(shortId);
    deviceHostname = "nanda-" + String(shortId);
    deviceName = "M5Stick " + String(shortId);

    Serial.println("Device ID: " + deviceId);
    Serial.println("Handle: " + deviceHandle);
    Serial.println("Hostname: " + deviceHostname);
}

// ============================================================================
// Registry Functions
// ============================================================================

// Try to fetch public registry list from internet
String fetchPublicRegistry() {
    HTTPClient https;

    // Use WiFiClientSecure for HTTPS
    WiFiClientSecure client;
    client.setInsecure();  // Skip certificate verification for simplicity

    https.begin(client, PUBLIC_REGISTRY_LIST);
    https.setTimeout(10000);

    Serial.println("Fetching public registry list...");
    int httpCode = https.GET();

    if (httpCode == 200) {
        String payload = https.getString();
        Serial.println("Got registry list: " + payload.substring(0, 100));

        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, payload);

        if (!error) {
            JsonArray registries = doc["registries"];
            if (registries.size() > 0) {
                // Get the first available registry
                String url = registries[0]["url"] | "";
                if (url.length() > 0) {
                    Serial.println("Found public registry: " + url);
                    https.end();
                    return url;
                }
            }
        }
    } else {
        Serial.println("Failed to fetch registry list: " + String(httpCode));
    }

    https.end();
    return "";
}

// Try to discover registry via mDNS
String discoverRegistryMDNS() {
    Serial.println("Searching for NANDA registry via mDNS...");

    int n = MDNS.queryService("nanda-registry", "tcp");
    if (n > 0) {
        String host = MDNS.hostname(0);
        IPAddress ip = MDNS.IP(0);
        int port = MDNS.port(0);

        String url = "http://" + ip.toString() + ":" + String(port);
        Serial.println("Found registry via mDNS: " + url);
        return url;
    }

    // Also try HTTP service with nanda TXT record
    n = MDNS.queryService("http", "tcp");
    for (int i = 0; i < n; i++) {
        // Check for registries
        String host = MDNS.hostname(i);
        if (host.indexOf("nanda") >= 0 || host.indexOf("registry") >= 0) {
            String url = "http://" + MDNS.IP(i).toString() + ":" + String(MDNS.port(i));
            Serial.println("Found potential registry: " + url);
            return url;
        }
    }

    return "";
}

void autoDetectRegistry() {
    // Priority:
    // 1. Saved preference
    // 2. mDNS discovery
    // 3. LAN IP scan (gateway, common IPs)
    // 4. Public registry list from internet
    // 5. Fallback to gateway:3000

    String savedRegistry = preferences.getString("registry", "");
    if (savedRegistry.length() > 0) {
        registryUrl = savedRegistry;
        Serial.println("Using saved registry: " + registryUrl);
        return;
    }

    // Try mDNS discovery first
    String mdnsRegistry = discoverRegistryMDNS();
    if (mdnsRegistry.length() > 0) {
        // Verify it's actually a registry
        HTTPClient http;
        http.begin(mdnsRegistry + "/health");
        http.setTimeout(2000);
        int code = http.GET();
        http.end();

        if (code == 200) {
            registryUrl = mdnsRegistry;
            Serial.println("Using mDNS-discovered registry: " + registryUrl);
            return;
        }
    }

    // Try gateway IP on registry port
    IPAddress gateway = WiFi.gatewayIP();
    String gatewayStr = gateway.toString();

    // Try common registry locations on LAN
    // Scan a range of common IPs where a registry might be running
    String subnet = gatewayStr.substring(0, gatewayStr.lastIndexOf('.'));
    String candidates[] = {
        "http://" + gatewayStr + ":" + String(DEFAULT_REGISTRY_PORT),  // Gateway
        "http://" + subnet + ".192:" + String(DEFAULT_REGISTRY_PORT),  // Jetson UGV
        "http://" + subnet + ".100:" + String(DEFAULT_REGISTRY_PORT),  // .100 convention
        "http://" + subnet + ".1:" + String(DEFAULT_REGISTRY_PORT),    // Router
        "http://" + subnet + ".104:" + String(DEFAULT_REGISTRY_PORT),  // Common PC IPs
        "http://" + subnet + ".105:" + String(DEFAULT_REGISTRY_PORT),
        "http://" + subnet + ".102:" + String(DEFAULT_REGISTRY_PORT),
        "http://" + subnet + ".103:" + String(DEFAULT_REGISTRY_PORT),
        "http://" + subnet + ".10:" + String(DEFAULT_REGISTRY_PORT),
        "http://" + subnet + ".50:" + String(DEFAULT_REGISTRY_PORT)
    };

    HTTPClient http;
    for (String candidate : candidates) {
        http.begin(candidate + "/health");
        http.setTimeout(2000);
        int code = http.GET();
        http.end();

        if (code == 200) {
            registryUrl = candidate;
            Serial.println("Found local registry at: " + registryUrl);
            return;
        }
    }

    // No local registry found - try to fetch from public list
    String publicRegistry = fetchPublicRegistry();
    if (publicRegistry.length() > 0) {
        registryUrl = publicRegistry;
        Serial.println("Using public registry: " + registryUrl);
        return;
    }

    // Fallback to gateway (might not work, but we try)
    registryUrl = "http://" + gatewayStr + ":" + String(DEFAULT_REGISTRY_PORT);
    Serial.println("Using fallback registry: " + registryUrl);
}

bool registerWithRegistry() {
    if (!wifiConnected) return false;

    HTTPClient http;
    http.begin(registryUrl + "/agents");
    http.addHeader("Content-Type", "application/json");

    JsonDocument doc;
    doc["handle"] = deviceHandle;
    doc["url"] = "http://" + deviceIP;

    String body;
    serializeJson(doc, body);

    int httpCode = http.POST(body);

    if (httpCode == 200 || httpCode == 201) {
        registryConnected = true;
        heartbeatFailures = 0;
        Serial.println("Registered with registry: " + deviceHandle);
        http.end();
        return true;
    } else {
        Serial.println("Registry registration failed: " + String(httpCode));
        http.end();
        return false;
    }
}

bool sendHeartbeat() {
    if (!wifiConnected || !registryConnected) return false;

    HTTPClient http;
    http.begin(registryUrl + "/heartbeat");
    http.addHeader("Content-Type", "application/json");

    JsonDocument doc;
    doc["handle"] = deviceHandle;
    doc["status"] = "healthy";

    String body;
    serializeJson(doc, body);

    int httpCode = http.POST(body);
    http.end();

    if (httpCode == 200) {
        lastHeartbeat = millis();
        heartbeatFailures = 0;
        return true;
    } else {
        heartbeatFailures++;
        if (heartbeatFailures > 3) {
            registryConnected = false;
            // Try to re-register
            registerWithRegistry();
        }
        return false;
    }
}

void discoverAgents() {
    if (!wifiConnected) return;

    HTTPClient http;
    http.begin(registryUrl + "/agents");

    int httpCode = http.GET();

    if (httpCode == 200) {
        String payload = http.getString();

        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, payload);

        if (!error) {
            JsonArray agents = doc["agents"];
            discoveredAgentCount = 0;

            for (JsonObject agent : agents) {
                if (discoveredAgentCount >= 10) break;

                String handle = agent["handle"] | "";
                // Skip ourselves
                if (handle == deviceHandle) continue;

                discoveredAgents[discoveredAgentCount].handle = handle;
                discoveredAgents[discoveredAgentCount].url = agent["url"] | "";
                discoveredAgents[discoveredAgentCount].name = agent["name"] | handle;
                discoveredAgents[discoveredAgentCount].healthy = agent["healthy"] | false;
                discoveredAgentCount++;
            }

            lastDiscovery = millis();
            Serial.println("Discovered " + String(discoveredAgentCount) + " agents");
        }
    }

    http.end();
}

// ============================================================================
// Screen Renderers
// ============================================================================

void drawHomeScreen() {
    drawHeader("NANDA");

    M5.Display.setTextSize(1);

    // Device identity
    M5.Display.setTextColor(TFT_MAGENTA);
    M5.Display.setCursor(10, 32);
    M5.Display.println(deviceHandle);

    // Network status
    if (wifiConnected) {
        M5.Display.setTextColor(TFT_GREEN);
        M5.Display.setCursor(10, 45);
        M5.Display.print("WiFi ");
        M5.Display.setTextColor(TFT_CYAN);
        M5.Display.println(deviceIP);

        // mDNS hostname
        if (mdnsStarted) {
            M5.Display.setTextColor(TFT_DARKGREY);
            M5.Display.setCursor(10, 58);
            M5.Display.println(deviceHostname + ".local");
        }
    } else {
        M5.Display.setTextColor(TFT_RED);
        M5.Display.setCursor(10, 45);
        M5.Display.println("WiFi: Connecting...");
    }

    // Registry status
    M5.Display.setCursor(10, 75);
    if (registryConnected) {
        M5.Display.setTextColor(TFT_GREEN);
        M5.Display.print("Registry ");
        M5.Display.setTextColor(TFT_WHITE);
        int totalAgents = discoveredAgentCount + 1;  // +1 for ourselves
        M5.Display.print(totalAgents);
        M5.Display.println(totalAgents == 1 ? " agent (you)" : " agents");
    } else {
        M5.Display.setTextColor(TFT_YELLOW);
        M5.Display.println("Registry: Offline");
    }

    // Tunnel status
    M5.Display.setCursor(10, 90);
    if (tunnelConnected) {
        M5.Display.setTextColor(TFT_GREEN);
        M5.Display.print("Tunnel ");
        M5.Display.setTextColor(TFT_WHITE);
        M5.Display.println("connected");
    } else if (registryConnected) {
        M5.Display.setTextColor(TFT_YELLOW);
        M5.Display.println("Tunnel: reconnecting...");
    }

    // Quick stats
    updateSensors();
    M5.Display.setTextColor(TFT_WHITE);
    M5.Display.setCursor(10, 108);
    M5.Display.printf("%.1fC  %d%%  ", sensors.temperature, sensors.batteryPercent);
    M5.Display.setTextColor(TFT_GREEN);
    M5.Display.print(":80");

    drawNavHint();
}

void drawSensorsScreen() {
    drawHeader("Sensors");
    updateSensors();

    M5.Display.setTextSize(1);
    M5.Display.setTextColor(TFT_WHITE);

    M5.Display.setCursor(10, 35);
    M5.Display.printf("Accel X: %+.2f g", sensors.accelX);
    M5.Display.setCursor(10, 50);
    M5.Display.printf("Accel Y: %+.2f g", sensors.accelY);
    M5.Display.setCursor(10, 65);
    M5.Display.printf("Accel Z: %+.2f g", sensors.accelZ);

    M5.Display.setTextColor(TFT_CYAN);
    M5.Display.setCursor(10, 85);
    M5.Display.printf("Gyro: %+.0f %+.0f %+.0f", sensors.gyroX, sensors.gyroY, sensors.gyroZ);

    M5.Display.setTextColor(TFT_ORANGE);
    M5.Display.setCursor(10, 105);
    M5.Display.printf("Temp: %.1f C", sensors.temperature);

    drawNavHint();
}

void drawNetworkScreen() {
    drawHeader("Network");

    M5.Display.setTextSize(1);

    if (wifiConnected) {
        M5.Display.setTextColor(TFT_GREEN);
        M5.Display.setCursor(10, 35);
        M5.Display.println("Status: Connected");

        M5.Display.setTextColor(TFT_WHITE);
        M5.Display.setCursor(10, 50);
        M5.Display.print("SSID: ");
        M5.Display.println(WIFI_SSID);

        M5.Display.setCursor(10, 65);
        M5.Display.print("IP: ");
        M5.Display.println(deviceIP);

        M5.Display.setTextColor(TFT_CYAN);
        M5.Display.setCursor(10, 80);
        M5.Display.print("mDNS: ");
        M5.Display.println(deviceHostname + ".local");

        M5.Display.setTextColor(TFT_YELLOW);
        M5.Display.setCursor(10, 100);
        M5.Display.printf("RSSI: %d dBm", WiFi.RSSI());
    } else {
        M5.Display.setTextColor(TFT_RED);
        M5.Display.setCursor(10, 50);
        M5.Display.println("Connecting...");
    }

    drawNavHint();
}

void drawBatteryScreen() {
    drawHeader("Battery");
    updateSensors();

    M5.Display.setTextSize(2);

    // Battery percentage with color
    if (sensors.batteryPercent > 50) {
        M5.Display.setTextColor(TFT_GREEN);
    } else if (sensors.batteryPercent > 20) {
        M5.Display.setTextColor(TFT_YELLOW);
    } else {
        M5.Display.setTextColor(TFT_RED);
    }

    M5.Display.setCursor(10, 40);
    M5.Display.printf("%d%%", sensors.batteryPercent);

    // Voltage
    M5.Display.setTextSize(1);
    M5.Display.setTextColor(TFT_WHITE);
    M5.Display.setCursor(10, 70);
    M5.Display.printf("Voltage: %.2f V", sensors.batteryVoltage);

    // Charging status
    M5.Display.setCursor(10, 90);
    if (sensors.isCharging) {
        M5.Display.setTextColor(TFT_CYAN);
        M5.Display.println("Charging...");
    } else {
        M5.Display.setTextColor(TFT_DARKGREY);
        M5.Display.println("Not charging");
    }

    // Battery bar
    int barWidth = map(sensors.batteryPercent, 0, 100, 0, 200);
    M5.Display.drawRect(10, 105, 204, 14, TFT_WHITE);
    M5.Display.fillRect(12, 107, barWidth, 10,
        sensors.batteryPercent > 50 ? TFT_GREEN :
        sensors.batteryPercent > 20 ? TFT_YELLOW : TFT_RED);

    drawNavHint();
}

void drawDiscoveryScreen() {
    drawHeader("Discovery");

    M5.Display.setTextSize(1);

    // Beacon status
    M5.Display.setTextColor(TFT_CYAN);
    M5.Display.setCursor(10, 32);
    M5.Display.print("Beacon: ");
    if (mdnsStarted) {
        M5.Display.setTextColor(TFT_GREEN);
        M5.Display.println("Broadcasting");
    } else {
        M5.Display.setTextColor(TFT_RED);
        M5.Display.println("Offline");
    }

    // Registry status
    M5.Display.setTextColor(TFT_CYAN);
    M5.Display.setCursor(10, 45);
    M5.Display.print("Registry: ");
    if (registryConnected) {
        M5.Display.setTextColor(TFT_GREEN);
        M5.Display.println("Connected");
    } else {
        M5.Display.setTextColor(TFT_YELLOW);
        M5.Display.println("Disconnected");
    }

    // Discovered agents (including self)
    int totalAgents = registryConnected ? discoveredAgentCount + 1 : 0;
    M5.Display.setTextColor(TFT_WHITE);
    M5.Display.setCursor(10, 62);
    M5.Display.print("Agents: ");
    M5.Display.print(totalAgents);
    if (totalAgents == 1) M5.Display.println(" (just you)");
    else if (totalAgents > 1) M5.Display.println(" online");
    else M5.Display.println("");

    // List agents - show self first, then others
    int y = 78;
    if (registryConnected) {
        // Show ourselves first
        M5.Display.setCursor(15, y);
        M5.Display.setTextColor(TFT_GREEN);
        M5.Display.print("+ ");
        M5.Display.setTextColor(TFT_CYAN);
        M5.Display.print(deviceHandle);
        M5.Display.setTextColor(TFT_DARKGREY);
        M5.Display.println(" (you)");
        y += 12;
    }

    // Then show other agents
    for (int i = 0; i < min(2, discoveredAgentCount); i++) {
        M5.Display.setCursor(15, y);
        M5.Display.setTextColor(discoveredAgents[i].healthy ? TFT_GREEN : TFT_RED);
        M5.Display.print(discoveredAgents[i].healthy ? "+ " : "- ");
        M5.Display.setTextColor(TFT_WHITE);
        // Truncate long handles
        String handle = discoveredAgents[i].handle;
        if (handle.length() > 18) handle = handle.substring(0, 18) + "..";
        M5.Display.println(handle);
        y += 12;
    }

    // Press A to refresh
    M5.Display.setTextColor(TFT_YELLOW);
    M5.Display.setCursor(10, 118);
    M5.Display.println("A:Refresh");

    drawNavHint();
}

void drawIRScreen() {
    drawHeader("IR Control");

    M5.Display.setTextSize(1);
    M5.Display.setTextColor(TFT_WHITE);

    M5.Display.setCursor(10, 40);
    M5.Display.println("IR Transmitter Ready");

    M5.Display.setTextColor(TFT_YELLOW);
    M5.Display.setCursor(10, 60);
    M5.Display.println("Press A to send test");

    M5.Display.setTextColor(TFT_DARKGREY);
    M5.Display.setCursor(10, 85);
    M5.Display.println("Use HTTP API for");
    M5.Display.setCursor(10, 100);
    M5.Display.println("custom IR commands");

    drawNavHint();
}

void drawFXScreen() {
    M5.Display.fillScreen(TFT_BLACK);
    drawHeader("FX");

    M5.Display.setTextColor(TFT_CYAN);
    M5.Display.setTextSize(1);
    M5.Display.setCursor(10, 40);
    M5.Display.println("Visual Effects");

    M5.Display.setTextColor(TFT_WHITE);
    M5.Display.setCursor(10, 60);
    M5.Display.println("Press A to play");
    M5.Display.setCursor(10, 75);
    M5.Display.println("startup animation");

    // Draw some voxel decorations
    for (int i = 0; i < 20; i++) {
        int x = random(10, 230);
        int y = random(95, 125);
        int size = random(2, 5);
        uint16_t color = (random(0, 2) == 0) ? TFT_CYAN : TFT_MAGENTA;
        M5.Display.fillRect(x, y, size, size, color);
    }

    drawNavHint();
}

void drawQRScreen() {
    M5.Display.fillScreen(TFT_BLACK);

    // Build the chat URL
    String chatUrl = "http://" + deviceIP + "/chat";

    // Create QR code
    QRCode qrcode;
    uint8_t qrcodeData[qrcode_getBufferSize(3)];
    qrcode_initText(&qrcode, qrcodeData, 3, ECC_LOW, chatUrl.c_str());

    // Calculate size and position (fit in screen)
    int moduleSize = 3;  // Size of each QR module
    int qrSize = qrcode.size * moduleSize;
    int offsetX = (240 - qrSize) / 2;
    int offsetY = 15;

    // Draw white background for QR
    M5.Display.fillRect(offsetX - 4, offsetY - 4, qrSize + 8, qrSize + 8, TFT_WHITE);

    // Draw QR code
    for (uint8_t y = 0; y < qrcode.size; y++) {
        for (uint8_t x = 0; x < qrcode.size; x++) {
            if (qrcode_getModule(&qrcode, x, y)) {
                M5.Display.fillRect(offsetX + x * moduleSize, offsetY + y * moduleSize,
                                   moduleSize, moduleSize, TFT_BLACK);
            }
        }
    }

    // Show URL text
    M5.Display.setTextColor(TFT_CYAN);
    M5.Display.setTextSize(1);
    M5.Display.setCursor(10, 115);
    M5.Display.print("Scan to chat: ");
    M5.Display.setTextColor(TFT_WHITE);
    M5.Display.setCursor(10, 125);
    M5.Display.print(chatUrl);
}

void drawCurrentScreen() {
    switch (currentScreen) {
        case MENU_HOME:
            drawHomeScreen();
            break;
        case MENU_SENSORS:
            drawSensorsScreen();
            break;
        case MENU_NETWORK:
            drawNetworkScreen();
            break;
        case MENU_DISCOVERY:
            drawDiscoveryScreen();
            break;
        case MENU_BATTERY:
            drawBatteryScreen();
            break;
        case MENU_IR:
            drawIRScreen();
            break;
        case MENU_FX:
            drawFXScreen();
            break;
        case MENU_QR:
            drawQRScreen();
            break;
        default:
            drawHomeScreen();
            break;
    }
}

// ============================================================================
// API Handlers
// ============================================================================

String getAgentCard() {
    JsonDocument doc;

    doc["name"] = deviceName;
    doc["handle"] = deviceHandle;
    doc["deviceId"] = deviceId;
    doc["description"] = "M5StickC Plus 2 IoT device with sensors, display, IR, and controls";
    if (mdnsStarted) {
        doc["url"] = "http://" + deviceHostname + ".local";
    } else {
        doc["url"] = "http://" + deviceIP;
    }
    doc["version"] = AGENT_VERSION;

    JsonArray inputModes = doc["defaultInputModes"].to<JsonArray>();
    inputModes.add("application/json");

    JsonArray outputModes = doc["defaultOutputModes"].to<JsonArray>();
    outputModes.add("application/json");

    JsonObject caps = doc["capabilities"].to<JsonObject>();
    caps["streaming"] = false;
    caps["pushNotifications"] = false;

    JsonArray skills = doc["skills"].to<JsonArray>();

    // Define available skills
    const char* skillDefs[][3] = {
        {"sensors/read", "Read Sensors", "Read accelerometer, gyroscope, and temperature"},
        {"display/show", "Show on Display", "Display text on LCD"},
        {"button/status", "Button Status", "Get current button states"},
        {"buzzer/tone", "Play Tone", "Play a tone on the buzzer"},
        {"battery/status", "Battery Status", "Get battery voltage and percentage"},
        {"wifi/scan", "Scan WiFi", "Scan for nearby WiFi networks"}
    };

    for (int i = 0; i < 6; i++) {
        JsonObject skill = skills.add<JsonObject>();
        skill["id"] = skillDefs[i][0];
        skill["name"] = skillDefs[i][1];
        skill["description"] = skillDefs[i][2];
    }

    String output;
    serializeJson(doc, output);
    return output;
}

String handleSensorsRead() {
    updateSensors();

    JsonDocument doc;

    JsonObject accel = doc["accelerometer"].to<JsonObject>();
    accel["x"] = sensors.accelX;
    accel["y"] = sensors.accelY;
    accel["z"] = sensors.accelZ;

    JsonObject gyro = doc["gyroscope"].to<JsonObject>();
    gyro["x"] = sensors.gyroX;
    gyro["y"] = sensors.gyroY;
    gyro["z"] = sensors.gyroZ;

    doc["temperature"] = sensors.temperature;
    doc["timestamp"] = sensors.lastUpdate;

    String output;
    serializeJson(doc, output);
    return output;
}

String handleButtonStatus() {
    JsonDocument doc;
    doc["btnA"] = M5.BtnA.isPressed();
    doc["btnB"] = M5.BtnB.isPressed();
    doc["btnPwr"] = M5.BtnPWR.isPressed();

    String output;
    serializeJson(doc, output);
    return output;
}

String handleBatteryStatus() {
    updateSensors();

    JsonDocument doc;
    doc["voltage"] = sensors.batteryVoltage;
    doc["percent"] = sensors.batteryPercent;
    doc["isCharging"] = sensors.isCharging;

    String output;
    serializeJson(doc, output);
    return output;
}

String handleWifiScan() {
    int n = WiFi.scanNetworks();

    JsonDocument doc;
    JsonArray networks = doc["networks"].to<JsonArray>();

    for (int i = 0; i < n && i < 10; i++) {
        JsonObject net = networks.add<JsonObject>();
        net["ssid"] = WiFi.SSID(i);
        net["rssi"] = WiFi.RSSI(i);
        net["channel"] = WiFi.channel(i);
    }

    doc["count"] = n;

    String output;
    serializeJson(doc, output);
    return output;
}

// Animated message display with voxel-style effects
void drawVoxelEffect() {
    // Draw animated voxel-style background
    for (int i = 0; i < 20; i++) {
        int x = random(0, 135);
        int y = random(0, 240);
        int size = random(2, 8);
        uint16_t colors[] = {TFT_CYAN, TFT_MAGENTA, TFT_YELLOW, TFT_GREEN, TFT_BLUE};
        uint16_t color = colors[random(0, 5)];
        M5.Display.fillRect(x, y, size, size, color);
    }
}

void animateMessageIn(const String& text) {
    // Play A minor arpeggio intro
    M5.Speaker.tone(AMIN_ARPEGGIO[0], 40);

    // Wild color particle burst
    for (int wave = 0; wave < 2; wave++) {
        for (int i = 0; i < 30; i++) {
            int x = random(0, 240);
            int y = random(0, 135);
            int size = random(2, 8);
            uint16_t wildColors[] = {TFT_CYAN, TFT_MAGENTA, TFT_YELLOW, TFT_GREEN, TFT_WHITE};
            M5.Display.fillRect(x, y, size, size, wildColors[random(0, 5)]);
        }
        if (wave < ARPEGGIO_LEN) {
            M5.Speaker.tone(AMIN_ARPEGGIO[wave], 40);
        }
        delay(50);
    }

    // Quick scanline wipe
    for (int x = 0; x < 240; x += 8) {
        M5.Display.fillRect(x, 0, 8, 135, TFT_BLACK);
        delay(3);
    }

    // SuprPosition fly-in (quick version)
    const char* brand = "SuprPosition";
    for (int frame = -100; frame <= 55; frame += 15) {
        // Trail
        if (frame > -80) {
            M5.Display.setTextColor(TFT_BLUE);
            M5.Display.setTextSize(2);
            M5.Display.setCursor(frame - 15, 55);
            M5.Display.print(brand);
        }
        // Main
        uint16_t flyColors[] = {TFT_CYAN, TFT_MAGENTA, TFT_YELLOW, TFT_WHITE};
        M5.Display.setTextColor(flyColors[(frame/15) % 4]);
        M5.Display.setCursor(frame, 55);
        M5.Display.print(brand);
        // Clear trail
        if (frame > -80) {
            M5.Display.fillRect(frame - 30, 50, 15, 30, TFT_BLACK);
        }
        // Arpeggio notes
        int noteIdx = (frame + 100) / 25;
        if (noteIdx >= 0 && noteIdx < ARPEGGIO_LEN && (frame % 25 == 0)) {
            M5.Speaker.tone(AMIN_ARPEGGIO[noteIdx], 50);
        }
        delay(15);
    }

    // Final flash
    M5.Display.fillScreen(TFT_WHITE);
    M5.Speaker.tone(440, 60);
    delay(30);
    M5.Display.fillScreen(TFT_BLACK);

    // Draw cyber border
    M5.Display.drawRect(0, 0, 240, 135, TFT_CYAN);
    M5.Display.drawRect(2, 2, 236, 131, TFT_MAGENTA);

    // Animated header
    M5.Display.setTextColor(TFT_BLACK);
    M5.Display.fillRect(5, 5, 230, 18, TFT_CYAN);
    M5.Display.setTextSize(1);
    M5.Display.setCursor(60, 10);
    M5.Display.print(">> INCOMING MSG <<");

    M5.Speaker.tone(330, 50);
}

String handleDisplayShow(const String& text) {
    // Animated cyber-punk style message display
    animateMessageIn(text);

    // Display message with glow effect
    M5.Display.setTextColor(TFT_WHITE);
    M5.Display.setTextSize(2);

    // Word wrap for small screen
    String remaining = text;
    int y = 40;
    while (remaining.length() > 0 && y < 200) {
        int lineLen = min((int)remaining.length(), 10);
        // Glow effect - draw shadow first
        M5.Display.setTextColor(TFT_BLUE);
        M5.Display.setCursor(11, y + 1);
        M5.Display.println(remaining.substring(0, lineLen));
        // Main text
        M5.Display.setTextColor(TFT_WHITE);
        M5.Display.setCursor(10, y);
        M5.Display.println(remaining.substring(0, lineLen));
        remaining = remaining.substring(lineLen);
        y += 22;
    }

    // Add some voxel decorations
    for (int i = 0; i < 15; i++) {
        int x = random(5, 130);
        int py = random(y + 10, 230);
        int size = random(2, 5);
        uint16_t color = (random(0, 2) == 0) ? TFT_CYAN : TFT_MAGENTA;
        M5.Display.fillRect(x, py, size, size, color);
    }

    // Confirmation sound
    M5.Speaker.tone(1200, 50);
    delay(60);
    M5.Speaker.tone(1800, 50);

    // Set flag to keep message displayed
    showingMessage = true;
    messageDisplayTime = millis();

    JsonDocument doc;
    doc["success"] = true;
    doc["displayed"] = text;

    String output;
    serializeJson(doc, output);
    return output;
}

String handleBuzzerTone(int freq, int duration) {
    M5.Speaker.tone(freq, duration);

    JsonDocument doc;
    doc["success"] = true;
    doc["frequency"] = freq;
    doc["duration"] = duration;

    String output;
    serializeJson(doc, output);
    return output;
}

// ============================================================================
// WebSocket Tunnel (for external access via registry relay)
// ============================================================================

// Process a request that came through the WebSocket tunnel
String processTunnelRequest(const String& method, const String& path, const String& body) {
    // Route the request to appropriate handler
    if (path == "/.well-known/agent.json") {
        return getAgentCard();
    }
    if (path == "/api/sensors") {
        return handleSensorsRead();
    }
    if (path == "/api/buttons") {
        return handleButtonStatus();
    }
    if (path == "/api/battery") {
        return handleBatteryStatus();
    }
    if (path.startsWith("/api/buzzer")) {
        // Parse freq and duration from path query string
        int freq = 1000, duration = 100;
        int qPos = path.indexOf('?');
        if (qPos > 0) {
            String query = path.substring(qPos + 1);
            int freqPos = query.indexOf("freq=");
            if (freqPos >= 0) {
                freq = query.substring(freqPos + 5).toInt();
            }
            int durPos = query.indexOf("duration=");
            if (durPos >= 0) {
                duration = query.substring(durPos + 9).toInt();
            }
        }
        return handleBuzzerTone(freq, duration);
    }
    if (path.startsWith("/api/display")) {
        int textPos = path.indexOf("text=");
        if (textPos > 0) {
            String text = path.substring(textPos + 5);
            // URL decode basic chars
            text.replace("%20", " ");
            return handleDisplayShow(text);
        }
    }

    // Default 404
    JsonDocument doc;
    doc["error"] = "Not found";
    doc["path"] = path;
    String output;
    serializeJson(doc, output);
    return output;
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
    switch (type) {
        case WStype_DISCONNECTED:
            tunnelConnected = false;
            Serial.println("[WS] Tunnel disconnected");
            break;

        case WStype_CONNECTED:
            tunnelConnected = true;
            Serial.println("[WS] Tunnel connected!");
            break;

        case WStype_TEXT: {
            String msg = String((char*)payload);
            Serial.println("[WS] Received: " + msg.substring(0, 100));

            JsonDocument doc;
            DeserializationError error = deserializeJson(doc, msg);
            if (error) {
                Serial.println("[WS] JSON parse error");
                break;
            }

            String msgType = doc["type"] | "";

            // Handle connection confirmation
            if (msgType == "connected") {
                Serial.println("[WS] Tunnel confirmed for: " + String(doc["handle"] | "unknown"));
            }

            // Handle incoming request to relay
            if (msgType == "request") {
                String reqId = doc["id"] | "";
                String method = doc["method"] | "GET";
                String path = doc["path"] | "/";
                String body = doc["body"] | "";

                Serial.println("[WS] Request: " + method + " " + path);

                // Process the request locally
                String response = processTunnelRequest(method, path, body);

                // Send response back through tunnel
                JsonDocument respDoc;
                respDoc["type"] = "response";
                respDoc["id"] = reqId;
                respDoc["status"] = 200;
                respDoc["headers"]["Content-Type"] = "application/json";
                respDoc["body"] = response;

                String respStr;
                serializeJson(respDoc, respStr);
                webSocket.sendTXT(respStr);
                Serial.println("[WS] Sent response for: " + reqId);
            }

            // Handle heartbeat ack
            if (msgType == "heartbeat_ack") {
                Serial.println("[WS] Heartbeat acknowledged");
            }
            break;
        }

        case WStype_PING:
            Serial.println("[WS] Ping");
            break;

        case WStype_PONG:
            Serial.println("[WS] Pong");
            break;

        case WStype_ERROR:
            Serial.println("[WS] Error");
            tunnelConnected = false;
            break;

        default:
            break;
    }
}

void connectTunnel() {
    if (!wifiConnected || registryUrl.length() == 0) return;

    // Parse registry URL to get host and port
    String url = registryUrl;
    url.replace("http://", "");
    url.replace("https://", "");

    int colonPos = url.indexOf(':');
    String host = url.substring(0, colonPos > 0 ? colonPos : url.length());
    int port = colonPos > 0 ? url.substring(colonPos + 1).toInt() : 80;

    String wsPath = "/tunnel?handle=" + deviceHandle;

    Serial.println("[WS] Connecting tunnel to " + host + ":" + String(port) + wsPath);

    webSocket.begin(host.c_str(), port, wsPath.c_str());
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000);

    // Enable heartbeat (ping every 15s, timeout 3s, disconnect after 2 fails)
    webSocket.enableHeartbeat(15000, 3000, 2);
}

void sendTunnelHeartbeat() {
    if (!tunnelConnected) return;

    JsonDocument doc;
    doc["type"] = "heartbeat";
    doc["handle"] = deviceHandle;

    String msg;
    serializeJson(doc, msg);
    webSocket.sendTXT(msg);
}

// ============================================================================
// WiFi Setup
// ============================================================================

void connectWiFi() {
    Serial.println("Connecting to WiFi...");
    Serial.print("SSID: ");
    Serial.println(WIFI_SSID);

    M5.Display.fillScreen(TFT_BLACK);
    M5.Display.setTextColor(TFT_YELLOW);
    M5.Display.setTextSize(2);
    M5.Display.setCursor(20, 40);
    M5.Display.println("Connecting");
    M5.Display.setTextSize(1);
    M5.Display.setCursor(20, 70);
    M5.Display.println(WIFI_SSID);

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASS);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(500);
        M5.Display.print(".");
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        deviceIP = WiFi.localIP().toString();
        wifiConnected = true;

        Serial.println("\nWiFi connected!");
        Serial.print("IP: ");
        Serial.println(deviceIP);

        // Start mDNS beacon for discovery
        if (MDNS.begin(deviceHostname.c_str())) {
            // HTTP service
            MDNS.addService("http", "tcp", HTTP_PORT);

            // NANDA A2A service with rich metadata
            MDNS.addService("nanda", "tcp", HTTP_PORT);
            MDNS.addServiceTxt("nanda", "tcp", "version", AGENT_VERSION);
            MDNS.addServiceTxt("nanda", "tcp", "type", "a2a-agent");
            MDNS.addServiceTxt("nanda", "tcp", "handle", deviceHandle.c_str());
            MDNS.addServiceTxt("nanda", "tcp", "deviceId", deviceId.c_str());
            MDNS.addServiceTxt("nanda", "tcp", "capabilities", "sensors,display,buzzer,ir");

            mdnsStarted = true;
            Serial.println("mDNS beacon started: " + deviceHostname + ".local");
            Serial.println("Broadcasting as NANDA agent: " + deviceHandle);
        }

        M5.Display.fillScreen(TFT_BLACK);
        M5.Display.setTextColor(TFT_GREEN);
        M5.Display.setTextSize(2);
        M5.Display.setCursor(20, 40);
        M5.Display.println("Connected!");
        M5.Display.setTextSize(1);
        M5.Display.setTextColor(TFT_WHITE);
        M5.Display.setCursor(20, 70);
        M5.Display.println(deviceIP);
        delay(1500);
    } else {
        Serial.println("\nWiFi connection failed!");
        M5.Display.fillScreen(TFT_BLACK);
        M5.Display.setTextColor(TFT_RED);
        M5.Display.setTextSize(2);
        M5.Display.setCursor(20, 50);
        M5.Display.println("WiFi Failed");
        delay(2000);
    }

    needsRedraw = true;
}

// ============================================================================
// HTTP Server Setup
// ============================================================================

void setupServer() {
    // Agent Card endpoint (A2A discovery)
    server.on("/.well-known/agent.json", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(200, "application/json", getAgentCard());
    });

    // API endpoints
    server.on("/api/sensors", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(200, "application/json", handleSensorsRead());
    });

    server.on("/api/buttons", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(200, "application/json", handleButtonStatus());
    });

    server.on("/api/battery", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(200, "application/json", handleBatteryStatus());
    });

    server.on("/api/wifi/scan", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(200, "application/json", handleWifiScan());
    });

    server.on("/api/display", HTTP_GET, [](AsyncWebServerRequest *request) {
        String text = request->getParam("text")->value();
        request->send(200, "application/json", handleDisplayShow(text));
    });

    server.on("/api/buzzer", HTTP_GET, [](AsyncWebServerRequest *request) {
        int freq = request->hasParam("freq") ? request->getParam("freq")->value().toInt() : 1000;
        int duration = request->hasParam("duration") ? request->getParam("duration")->value().toInt() : 100;
        request->send(200, "application/json", handleBuzzerTone(freq, duration));
    });

    // Simple web dashboard
    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
        String html = "<!DOCTYPE html><html><head><title>NANDA Device</title>"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
            "<style>"
            "body{font-family:system-ui;max-width:600px;margin:0 auto;padding:20px;background:#1a1a2e;color:#eee}"
            "h1{color:#00d4ff}"
            ".card{background:#16213e;border-radius:8px;padding:15px;margin:10px 0}"
            ".label{color:#888;font-size:12px}"
            ".value{font-size:24px;font-weight:bold}"
            "button{background:#00d4ff;border:none;padding:10px 20px;border-radius:5px;cursor:pointer;margin:5px}"
            "#sensors{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}"
            "</style></head><body>"
            "<h1>NANDA M5Stick</h1>"
            "<div class=\"card\"><div class=\"label\">Status</div><div class=\"value\" style=\"color:#0f0\">Online</div></div>"
            "<div class=\"card\" id=\"sensors\">Loading...</div>"
            "<div class=\"card\">"
            "<button onclick=\"fetch('/api/buzzer?freq=1000&duration=100')\">Beep</button>"
            "<button onclick=\"fetch('/api/display?text=Hello!')\">Hello</button>"
            "<button onclick=\"location.reload()\">Refresh</button>"
            "</div>"
            "<script>"
            "async function u(){"
            "var s=await fetch('/api/sensors').then(r=>r.json());"
            "var b=await fetch('/api/battery').then(r=>r.json());"
            "document.getElementById('sensors').innerHTML="
            "'<div><div class=label>Accel X</div><div>'+s.accelerometer.x.toFixed(2)+'</div></div>'"
            "+'<div><div class=label>Accel Y</div><div>'+s.accelerometer.y.toFixed(2)+'</div></div>'"
            "+'<div><div class=label>Accel Z</div><div>'+s.accelerometer.z.toFixed(2)+'</div></div>'"
            "+'<div><div class=label>Temp</div><div>'+s.temperature.toFixed(1)+'C</div></div>'"
            "+'<div><div class=label>Battery</div><div>'+b.percent+'%</div></div>'"
            "+'<div><div class=label>Voltage</div><div>'+b.voltage.toFixed(2)+'V</div></div>';"
            "}u();setInterval(u,2000);"
            "</script></body></html>";
        request->send(200, "text/html", html);
    });

    // Chat interface - mini app for talking to the device
    server.on("/chat", HTTP_GET, [](AsyncWebServerRequest *request) {
        String html = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
    <title>SuprPosition Chat</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, system-ui, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            color: #fff;
        }
        .header {
            background: rgba(0,212,255,0.1);
            padding: 15px;
            text-align: center;
            border-bottom: 1px solid rgba(0,212,255,0.3);
        }
        .header h1 {
            font-size: 1.5em;
            background: linear-gradient(90deg, #00d4ff, #ff00ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .header .status {
            font-size: 0.8em;
            color: #0f0;
            margin-top: 5px;
        }
        .chat-container {
            height: calc(100vh - 140px);
            overflow-y: auto;
            padding: 15px;
        }
        .message {
            margin: 10px 0;
            padding: 12px 16px;
            border-radius: 18px;
            max-width: 85%;
            animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .message.user {
            background: linear-gradient(135deg, #00d4ff, #0099cc);
            margin-left: auto;
            border-bottom-right-radius: 4px;
        }
        .message.device {
            background: rgba(255,255,255,0.1);
            border-bottom-left-radius: 4px;
        }
        .message.device::before {
            content: '🤖 ';
        }
        .input-container {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 10px;
            background: rgba(22,33,62,0.95);
            border-top: 1px solid rgba(0,212,255,0.3);
            display: flex;
            gap: 10px;
        }
        #messageInput {
            flex: 1;
            padding: 12px 16px;
            border: none;
            border-radius: 25px;
            background: rgba(255,255,255,0.1);
            color: #fff;
            font-size: 16px;
            outline: none;
        }
        #messageInput::placeholder { color: rgba(255,255,255,0.5); }
        #sendBtn {
            width: 50px;
            height: 50px;
            border: none;
            border-radius: 50%;
            background: linear-gradient(135deg, #00d4ff, #ff00ff);
            color: #fff;
            font-size: 20px;
            cursor: pointer;
        }
        .quick-actions {
            display: flex;
            gap: 8px;
            padding: 10px 15px;
            overflow-x: auto;
        }
        .quick-btn {
            padding: 8px 16px;
            border: 1px solid rgba(0,212,255,0.5);
            border-radius: 20px;
            background: transparent;
            color: #00d4ff;
            font-size: 14px;
            white-space: nowrap;
            cursor: pointer;
        }
        .quick-btn:active { background: rgba(0,212,255,0.2); }
    </style>
</head>
<body>
    <div class="header">
        <h1>SuprPosition</h1>
        <div class="status">● Connected to M5Stick</div>
    </div>
    <div class="quick-actions">
        <button class="quick-btn" onclick="send('read sensors')">📊 Sensors</button>
        <button class="quick-btn" onclick="send('battery status')">🔋 Battery</button>
        <button class="quick-btn" onclick="send('beep')">🔔 Beep</button>
        <button class="quick-btn" onclick="send('wifi scan')">📶 WiFi</button>
    </div>
    <div class="chat-container" id="chat"></div>
    <div class="input-container">
        <input type="text" id="messageInput" placeholder="Ask me anything..." autocomplete="off">
        <button id="sendBtn" onclick="sendMessage()">→</button>
    </div>
    <script>
        const chat = document.getElementById('chat');
        const input = document.getElementById('messageInput');

        function addMessage(text, isUser) {
            const div = document.createElement('div');
            div.className = 'message ' + (isUser ? 'user' : 'device');
            div.textContent = text;
            chat.appendChild(div);
            chat.scrollTop = chat.scrollHeight;
        }

        async function send(text) {
            if (!text.trim()) return;
            addMessage(text, true);
            input.value = '';

            try {
                const res = await fetch('/api/display?text=' + encodeURIComponent(text));
                const data = await res.json();

                // Also get a response based on the command
                let response = '';
                const lower = text.toLowerCase();

                if (lower.includes('sensor') || lower.includes('temp')) {
                    const s = await fetch('/api/sensors').then(r => r.json());
                    response = `Temperature: ${s.temperature.toFixed(1)}°C\nAccel: X=${s.accelerometer.x.toFixed(2)}, Y=${s.accelerometer.y.toFixed(2)}, Z=${s.accelerometer.z.toFixed(2)}`;
                } else if (lower.includes('battery') || lower.includes('power')) {
                    const b = await fetch('/api/battery').then(r => r.json());
                    response = `Battery: ${b.percent}% (${b.voltage.toFixed(2)}V)\nCharging: ${b.isCharging ? 'Yes' : 'No'}`;
                } else if (lower.includes('beep') || lower.includes('tone')) {
                    await fetch('/api/buzzer?freq=1000&duration=200');
                    response = '🔔 Beep!';
                } else if (lower.includes('wifi') || lower.includes('scan')) {
                    const w = await fetch('/api/wifi/scan').then(r => r.json());
                    response = `Found ${w.count} networks:\n` + w.networks.slice(0,5).map(n => `• ${n.ssid} (${n.rssi}dBm)`).join('\n');
                } else if (lower.includes('button')) {
                    const b = await fetch('/api/buttons').then(r => r.json());
                    response = `Buttons: A=${b.btnA?'pressed':'released'}, B=${b.btnB?'pressed':'released'}`;
                } else {
                    response = `Displayed: "${data.displayed}"`;
                }

                addMessage(response, false);
            } catch (e) {
                addMessage('Error: ' + e.message, false);
            }
        }

        function sendMessage() {
            send(input.value);
        }

        input.addEventListener('keypress', e => {
            if (e.key === 'Enter') sendMessage();
        });

        // Welcome message
        addMessage('Hello! I\'m your M5Stick assistant. Ask me to read sensors, check battery, beep, or display something!', false);
    </script>
</body>
</html>
)rawliteral";
        request->send(200, "text/html", html);
    });

    server.begin();
    Serial.println("HTTP server started on port 80");
}

// ============================================================================
// Main
// ============================================================================

// Epic startup animation with SuprPosition fly-in
void playStartupAnimation() {
    M5.Display.setRotation(1);
    M5.Display.fillScreen(TFT_BLACK);

    // Wild color particle explosion
    for (int wave = 0; wave < 3; wave++) {
        for (int i = 0; i < 50; i++) {
            int x = random(0, 240);
            int y = random(0, 135);
            int size = random(3, 12);
            uint16_t wildColors[] = {
                TFT_RED, TFT_ORANGE, TFT_YELLOW, TFT_GREEN,
                TFT_CYAN, TFT_BLUE, TFT_MAGENTA, TFT_WHITE
            };
            M5.Display.fillRect(x, y, size, size, wildColors[random(0, 8)]);
        }
        // Play arpeggio note with each wave
        if (wave < ARPEGGIO_LEN) {
            M5.Speaker.tone(AMIN_ARPEGGIO[wave], 80);
        }
        delay(100);
    }

    // Clear with scanline wipe
    for (int x = 0; x < 240; x += 4) {
        M5.Display.fillRect(x, 0, 4, 135, TFT_BLACK);
        if (x % 20 == 0 && x/20 < ARPEGGIO_LEN) {
            M5.Speaker.tone(AMIN_ARPEGGIO[x/20], 60);
        }
        delay(8);
    }

    // SuprPosition fly-in from left with trail effect
    const char* brand = "SuprPosition";
    int textLen = strlen(brand);

    for (int frame = -120; frame <= 60; frame += 8) {
        // Draw trailing ghost
        if (frame > -100) {
            M5.Display.setTextColor(TFT_BLUE);
            M5.Display.setTextSize(2);
            M5.Display.setCursor(frame - 20, 55);
            M5.Display.print(brand);
        }

        // Draw main text
        uint16_t flyColors[] = {TFT_CYAN, TFT_MAGENTA, TFT_YELLOW, TFT_WHITE};
        M5.Display.setTextColor(flyColors[(frame/8) % 4]);
        M5.Display.setTextSize(2);
        M5.Display.setCursor(frame, 55);
        M5.Display.print(brand);

        // Clear trail
        if (frame > -100) {
            M5.Display.fillRect(frame - 40, 50, 20, 30, TFT_BLACK);
        }

        // Arpeggio during fly-in
        int noteIdx = (frame + 120) / 30;
        if (noteIdx >= 0 && noteIdx < ARPEGGIO_LEN && (frame % 30 == 0)) {
            M5.Speaker.tone(AMIN_ARPEGGIO[noteIdx], 70);
        }

        delay(25);
    }

    // Final position with glow
    M5.Display.fillScreen(TFT_BLACK);

    // Draw voxel border
    for (int i = 0; i < 30; i++) {
        int x = random(0, 240);
        int y = random(0, 135);
        int size = random(2, 6);
        uint16_t color = (random(0, 2) == 0) ? TFT_CYAN : TFT_MAGENTA;
        M5.Display.fillRect(x, y, size, size, color);
    }

    // Glow effect
    M5.Display.setTextColor(TFT_BLUE);
    M5.Display.setTextSize(2);
    M5.Display.setCursor(32, 56);
    M5.Display.print(brand);
    M5.Display.setCursor(28, 54);
    M5.Display.print(brand);

    // Main text
    M5.Display.setTextColor(TFT_WHITE);
    M5.Display.setCursor(30, 55);
    M5.Display.print(brand);

    // Final chord - A minor (A, C, E played together as sequence)
    M5.Speaker.tone(220, 100);
    delay(50);
    M5.Speaker.tone(262, 100);
    delay(50);
    M5.Speaker.tone(330, 150);
    delay(200);

    // Tagline
    M5.Display.setTextColor(TFT_GREEN);
    M5.Display.setTextSize(1);
    M5.Display.setCursor(70, 90);
    M5.Display.print("NANDA IoT");

    delay(1000);
}

void setup() {
    // Initialize M5Unified
    auto cfg = M5.config();
    M5.begin(cfg);

    Serial.begin(115200);
    Serial.println("=== NANDA M5Stick Server ===");

    // Initialize preferences
    preferences.begin("nanda", false);

    // Epic startup animation
    playStartupAnimation();

    // Generate device ID from MAC (before WiFi connect)
    WiFi.mode(WIFI_STA);
    generateDeviceId();

    // Show device ID on screen
    M5.Display.setCursor(30, 105);
    M5.Display.setTextColor(TFT_CYAN);
    M5.Display.println(deviceHandle);
    delay(500);

    // Connect to WiFi
    connectWiFi();

    // Start HTTP server
    setupServer();

    // Auto-detect and register with registry
    if (wifiConnected) {
        M5.Display.fillScreen(TFT_BLACK);
        M5.Display.setCursor(10, 40);
        M5.Display.setTextColor(TFT_YELLOW);
        M5.Display.println("Finding registry...");

        autoDetectRegistry();

        M5.Display.setCursor(10, 55);
        M5.Display.setTextColor(TFT_DARKGREY);
        M5.Display.println(registryUrl);
        M5.Display.setCursor(10, 75);
        M5.Display.setTextColor(TFT_YELLOW);
        M5.Display.println("Registering...");

        if (registerWithRegistry()) {
            // Success! Show "INSTALLED" screen
            M5.Display.fillScreen(TFT_BLACK);
            M5.Display.setTextColor(TFT_GREEN);
            M5.Display.setTextSize(2);
            M5.Display.setCursor(20, 30);
            M5.Display.println("INSTALLED");
            M5.Display.setTextSize(1);
            M5.Display.setTextColor(TFT_CYAN);
            M5.Display.setCursor(10, 60);
            M5.Display.println(deviceHandle);
            M5.Display.setTextColor(TFT_WHITE);
            M5.Display.setCursor(10, 80);
            M5.Display.println(deviceIP);
            M5.Display.setTextColor(TFT_DARKGREY);
            M5.Display.setCursor(10, 100);
            M5.Display.println("Discoverable on network");

            // Victory beep
            M5.Speaker.tone(880, 100);
            delay(150);
            M5.Speaker.tone(1100, 100);
            delay(150);
            M5.Speaker.tone(1320, 200);

            // Connect WebSocket tunnel for external access
            M5.Display.setCursor(10, 115);
            M5.Display.setTextColor(TFT_DARKGREY);
            M5.Display.println("Connecting tunnel...");
            connectTunnel();

            // Initial discovery
            discoverAgents();
            delay(1500);
        } else {
            M5.Display.setTextColor(TFT_YELLOW);
            M5.Display.setCursor(10, 70);
            M5.Display.println("Standalone mode");
            M5.Display.setTextColor(TFT_DARKGREY);
            M5.Display.setCursor(10, 90);
            M5.Display.println("(Registry offline)");
            delay(1000);
        }
    }

    // Initial draw
    needsRedraw = true;

    Serial.println("=== Device Ready ===");
    Serial.println("Handle: " + deviceHandle);
    Serial.println("URL: http://" + deviceIP);
    if (mdnsStarted) {
        Serial.println("mDNS: http://" + deviceHostname + ".local");
    }
}

void loop() {
    M5.update();

    // Process WebSocket events (tunnel)
    webSocket.loop();

    // Button B: Next screen
    if (M5.BtnB.wasPressed()) {
        currentScreen = (MenuScreen)((currentScreen + 1) % MENU_COUNT);
        needsRedraw = true;
        M5.Speaker.tone(800, 50);  // Click sound
    }

    // Button A: Action on current screen
    if (M5.BtnA.wasPressed()) {
        M5.Speaker.tone(1200, 50);  // Confirm sound

        switch (currentScreen) {
            case MENU_DISCOVERY:
                // Refresh discovery - re-register and discover agents
                M5.Display.fillScreen(TFT_BLACK);
                M5.Display.setCursor(10, 50);
                M5.Display.setTextColor(TFT_YELLOW);
                M5.Display.println("Discovering...");
                if (!registryConnected) {
                    registerWithRegistry();
                }
                discoverAgents();
                needsRedraw = true;
                break;
            case MENU_IR:
                // Send test IR signal (placeholder)
                M5.Display.setCursor(10, 75);
                M5.Display.setTextColor(TFT_GREEN);
                M5.Display.println("IR Sent!");
                delay(500);
                needsRedraw = true;
                break;
            case MENU_FX:
                // Play the startup animation
                playStartupAnimation();
                needsRedraw = true;
                break;
            case MENU_HOME:
                // Refresh home screen and trigger heartbeat
                sendHeartbeat();
                needsRedraw = true;
                break;
            default:
                // Force sensor update and redraw
                updateSensors();
                needsRedraw = true;
                break;
        }
    }

    // Check if message display has timed out
    if (showingMessage && (millis() - messageDisplayTime > MESSAGE_DISPLAY_DURATION)) {
        showingMessage = false;
        needsRedraw = true;  // Return to normal screen
    }

    // Redraw screen if needed (but not while showing a message)
    if (needsRedraw && !showingMessage) {
        drawCurrentScreen();
        needsRedraw = false;
    }

    // Periodic heartbeat to registry
    static unsigned long lastHeartbeatTime = 0;
    if (wifiConnected && millis() - lastHeartbeatTime > HEARTBEAT_INTERVAL) {
        sendHeartbeat();
        sendTunnelHeartbeat();  // Also send heartbeat through WebSocket tunnel
        lastHeartbeatTime = millis();
    }

    // Reconnect tunnel if disconnected
    static unsigned long lastTunnelCheck = 0;
    if (wifiConnected && registryConnected && !tunnelConnected && millis() - lastTunnelCheck > TUNNEL_RECONNECT_INTERVAL) {
        Serial.println("Reconnecting tunnel...");
        connectTunnel();
        lastTunnelCheck = millis();
    }

    // Periodic agent discovery (every 60 seconds)
    static unsigned long lastDiscoveryTime = 0;
    if (wifiConnected && millis() - lastDiscoveryTime > 60000) {
        discoverAgents();
        lastDiscoveryTime = millis();
        // Redraw if on discovery screen
        if (currentScreen == MENU_DISCOVERY) {
            needsRedraw = true;
        }
    }

    // Auto-refresh for sensor/discovery screens
    static unsigned long lastAutoRefresh = 0;
    if (currentScreen == MENU_SENSORS || currentScreen == MENU_BATTERY ||
        currentScreen == MENU_DISCOVERY) {
        if (millis() - lastAutoRefresh > 500) {
            drawCurrentScreen();
            lastAutoRefresh = millis();
        }
    }

    delay(10);
}
