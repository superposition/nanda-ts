/**
 * Jetson UGV NANDA Agent Example
 *
 * Runs a NANDA-compliant A2A agent on a Jetson-based UGV.
 *
 * Usage:
 *   bun examples/jetson-ugv-agent.ts
 *
 * Or with options:
 *   PORT=8001 REGISTRY_URL=http://192.168.0.100:3000 bun examples/jetson-ugv-agent.ts
 *
 * Environment variables:
 *   PORT          - Port to run on (default: 8000)
 *   REGISTRY_URL  - Registry URL to register with
 *   ENABLE_CAMERA - Set to "false" to disable camera
 *   ENABLE_MOTORS - Set to "false" to disable motors
 *   CAMERA_DEVICE - Camera device path (default: /dev/video0)
 *   MOTOR_IFACE   - Motor interface (default: /dev/ttyUSB0)
 */

import { createJetsonUGVAgent, JetsonUGVClient } from '../src/adapters/jetson-ugv';

async function main() {
  const port = parseInt(process.env.PORT || '8000');
  const registryUrl = process.env.REGISTRY_URL;
  const enableCamera = process.env.ENABLE_CAMERA !== 'false';
  const enableMotors = process.env.ENABLE_MOTORS !== 'false';
  const cameraDevice = process.env.CAMERA_DEVICE || '/dev/video0';
  const motorInterface = process.env.MOTOR_IFACE || '/dev/ttyUSB0';

  console.log('='.repeat(50));
  console.log('Jetson UGV NANDA Agent');
  console.log('='.repeat(50));

  // Show system info on startup
  const client = new JetsonUGVClient({ cameraDevice, motorInterface });
  try {
    const sysInfo = await client.getSystemInfo();
    console.log(`Hostname: ${sysInfo.hostname}`);
    if (sysInfo.jetsonModel) {
      console.log(`Model: ${sysInfo.jetsonModel}`);
    }
    console.log(`CPU Temp: ${sysInfo.cpuTemp.toFixed(1)}°C`);
    console.log(`Memory: ${sysInfo.memoryUsed.toFixed(0)}/${sysInfo.memoryTotal.toFixed(0)} MB`);
  } catch (error) {
    console.warn('Could not read system info:', error);
  }

  console.log(`\nConfiguration:`);
  console.log(`  Port: ${port}`);
  console.log(`  Camera: ${enableCamera ? cameraDevice : 'disabled'}`);
  console.log(`  Motors: ${enableMotors ? motorInterface : 'disabled'}`);
  if (registryUrl) {
    console.log(`  Registry: ${registryUrl}`);
  }

  // Create and start the agent
  const agent = createJetsonUGVAgent({
    port,
    enableCamera,
    enableMotors,
    cameraDevice,
    motorInterface,
  });

  await agent.start();

  // Register with registry if URL provided
  if (registryUrl) {
    try {
      const netInfo = await client.getNetworkInfo();
      const localIP = netInfo.interfaces[0]?.ip || 'localhost';

      const response = await fetch(`${registryUrl}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: `jetson-ugv-${netInfo.hostname}`,
          url: `http://${localIP}:${port}`,
          name: `Jetson UGV (${netInfo.hostname})`,
        }),
      });

      if (response.ok) {
        console.log(`\nRegistered with registry: ${registryUrl}`);

        // Start heartbeat
        setInterval(async () => {
          try {
            await fetch(`${registryUrl}/heartbeat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                handle: `jetson-ugv-${netInfo.hostname}`,
                status: 'healthy',
              }),
            });
          } catch {
            // Ignore heartbeat errors
          }
        }, 30000);
      } else {
        console.warn(`Registry registration failed: ${response.status}`);
      }
    } catch (error) {
      console.warn(`Could not register with registry:`, error);
    }
  }

  console.log(`
Agent is running!

Endpoints:
  Agent Card: http://localhost:${port}/.well-known/agent.json
  JSON-RPC:   http://localhost:${port}/rpc
  Health:     http://localhost:${port}/health

Test with curl:
  # Get agent card
  curl http://localhost:${port}/.well-known/agent.json

  # Send a message
  curl -X POST http://localhost:${port}/rpc \\
    -H "Content-Type: application/json" \\
    -d '{"jsonrpc":"2.0","id":1,"method":"message/send","params":{"message":{"role":"user","parts":[{"type":"text","text":"system info"}]}}}'

Available commands:
  - "system info" - CPU/GPU temp, memory, disk
  - "temperature" - Thermal readings
  - "forward [speed]" / "backward" / "left" / "right" / "stop" - Motor control
  - "camera capture" - Take a photo
  - "network" - Network interfaces
  - "say <text>" - Text to speech
  - "help" - Show all commands

Press Ctrl+C to stop.
`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
