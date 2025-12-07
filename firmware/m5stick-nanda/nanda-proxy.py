#!/usr/bin/env python3
"""
NANDA Proxy Agent for M5StickC Plus 2

This agent proxies requests to the M5Stick device and exposes it
via the NANDA Adapter for public discovery.
"""

import os
import json
import requests
from nanda_adapter import (
    A2AServer,
    AgentCard,
    AgentSkill,
    Message,
    TextContent
)

# M5Stick device address
M5STICK_URL = os.getenv("M5STICK_URL", "http://192.168.0.146")

def create_agent_card():
    """Create the NANDA AgentCard for the M5Stick proxy"""
    return AgentCard(
        name="m5stick-nanda",
        description="M5StickC Plus 2 IoT device with sensors, display, IR, and controls. Proxy to physical device.",
        url="",  # Will be set by adapter
        version="1.0.0",
        skills=[
            AgentSkill(
                id="sensors/read",
                name="Read Sensors",
                description="Read accelerometer, gyroscope, and temperature from the device"
            ),
            AgentSkill(
                id="battery/status",
                name="Battery Status",
                description="Get battery voltage, percentage, and charging status"
            ),
            AgentSkill(
                id="display/show",
                name="Show on Display",
                description="Display text on the LCD screen. Parameter: text (string)"
            ),
            AgentSkill(
                id="buzzer/tone",
                name="Play Tone",
                description="Play a tone on the buzzer. Parameters: freq (Hz), duration (ms)"
            ),
            AgentSkill(
                id="button/status",
                name="Button Status",
                description="Get current button states (A, B, Power)"
            ),
            AgentSkill(
                id="wifi/scan",
                name="WiFi Scan",
                description="Scan for nearby WiFi networks"
            )
        ]
    )


def handle_message(message: Message) -> Message:
    """
    Handle incoming A2A messages and proxy to M5Stick
    """
    try:
        # Extract the text content
        text = ""
        for part in message.content:
            if isinstance(part, TextContent):
                text = part.text
                break

        text_lower = text.lower()

        # Route to appropriate M5Stick endpoint
        if "sensor" in text_lower or "accelerometer" in text_lower or "gyro" in text_lower or "temperature" in text_lower:
            response = requests.get(f"{M5STICK_URL}/api/sensors", timeout=5)
            data = response.json()
            result = f"Sensors:\n- Accel: X={data['accelerometer']['x']:.2f}, Y={data['accelerometer']['y']:.2f}, Z={data['accelerometer']['z']:.2f}\n- Gyro: X={data['gyroscope']['x']:.1f}, Y={data['gyroscope']['y']:.1f}, Z={data['gyroscope']['z']:.1f}\n- Temperature: {data['temperature']:.1f}°C"

        elif "battery" in text_lower or "power" in text_lower or "charge" in text_lower:
            response = requests.get(f"{M5STICK_URL}/api/battery", timeout=5)
            data = response.json()
            charging = "Yes" if data['isCharging'] else "No"
            result = f"Battery: {data['percent']}% ({data['voltage']:.2f}V) - Charging: {charging}"

        elif "button" in text_lower:
            response = requests.get(f"{M5STICK_URL}/api/buttons", timeout=5)
            data = response.json()
            result = f"Buttons: A={data['btnA']}, B={data['btnB']}, PWR={data['btnPwr']}"

        elif "wifi" in text_lower or "scan" in text_lower or "network" in text_lower:
            response = requests.get(f"{M5STICK_URL}/api/wifi/scan", timeout=10)
            data = response.json()
            networks = "\n".join([f"  - {n['ssid']} ({n['rssi']} dBm)" for n in data['networks'][:5]])
            result = f"WiFi Networks ({data['count']} found):\n{networks}"

        elif "display" in text_lower or "show" in text_lower or "text" in text_lower:
            # Extract text to display (everything after "display" or "show")
            import re
            match = re.search(r'(?:display|show)\s+["\']?(.+?)["\']?\s*$', text, re.IGNORECASE)
            display_text = match.group(1) if match else "Hello!"
            response = requests.get(f"{M5STICK_URL}/api/display", params={"text": display_text}, timeout=5)
            data = response.json()
            result = f"Displayed: {data['displayed']}"

        elif "beep" in text_lower or "tone" in text_lower or "buzzer" in text_lower or "sound" in text_lower:
            # Parse frequency and duration if provided
            import re
            freq = 1000
            duration = 200
            freq_match = re.search(r'(\d+)\s*(?:hz|hertz)', text, re.IGNORECASE)
            dur_match = re.search(r'(\d+)\s*(?:ms|millisecond)', text, re.IGNORECASE)
            if freq_match:
                freq = int(freq_match.group(1))
            if dur_match:
                duration = int(dur_match.group(1))

            response = requests.get(f"{M5STICK_URL}/api/buzzer", params={"freq": freq, "duration": duration}, timeout=5)
            data = response.json()
            result = f"Played tone: {data['frequency']}Hz for {data['duration']}ms"

        elif "status" in text_lower or "info" in text_lower or "hello" in text_lower:
            # Get combined status
            sensors = requests.get(f"{M5STICK_URL}/api/sensors", timeout=5).json()
            battery = requests.get(f"{M5STICK_URL}/api/battery", timeout=5).json()
            result = f"M5Stick Status:\n- Temperature: {sensors['temperature']:.1f}°C\n- Battery: {battery['percent']}% ({battery['voltage']:.2f}V)\n- Device online and responding"

        else:
            result = f"""M5StickC Plus 2 NANDA Agent

Available commands:
- "read sensors" - Get accelerometer, gyro, temperature
- "battery status" - Get battery level and charging status
- "button status" - Get button states
- "wifi scan" - Scan nearby networks
- "display [text]" - Show text on screen
- "beep" or "tone 1000hz 200ms" - Play buzzer tone
- "status" - Get device overview

Device: {M5STICK_URL}"""

        return Message(
            role="agent",
            content=[TextContent(type="text", text=result)]
        )

    except requests.exceptions.RequestException as e:
        return Message(
            role="agent",
            content=[TextContent(type="text", text=f"Error connecting to M5Stick at {M5STICK_URL}: {str(e)}")]
        )
    except Exception as e:
        return Message(
            role="agent",
            content=[TextContent(type="text", text=f"Error: {str(e)}")]
        )


def main():
    """Start the NANDA proxy server"""

    print("=" * 50)
    print("M5Stick NANDA Proxy Agent")
    print("=" * 50)
    print(f"Proxying to: {M5STICK_URL}")

    # Test connection to M5Stick
    try:
        response = requests.get(f"{M5STICK_URL}/api/battery", timeout=5)
        data = response.json()
        print(f"M5Stick connected! Battery: {data['percent']}%")
    except Exception as e:
        print(f"WARNING: Cannot reach M5Stick at {M5STICK_URL}: {e}")

    # Create and start the A2A server
    agent_card = create_agent_card()

    server = A2AServer(
        agent_card=agent_card,
        message_handler=handle_message
    )

    # Get port from environment or use default
    port = int(os.getenv("PORT", "8000"))

    print(f"\nStarting NANDA server on port {port}...")
    print(f"Agent card will be at: http://localhost:{port}/.well-known/agent.json")
    print("\nTo expose publicly, use:")
    print("  - ngrok http 8000")
    print("  - cloudflared tunnel --url http://localhost:8000")
    print("=" * 50)

    server.run(host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
