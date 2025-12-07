/**
 * Jetson UGV Command Router
 *
 * Routes natural language commands to appropriate handlers.
 */

import { JetsonUGVClient } from './client';

export class JetsonUGVRouter {
  constructor(private client: JetsonUGVClient) {}

  /**
   * Handle a text command and return a response
   */
  async handleCommand(text: string): Promise<string> {
    const lower = text.toLowerCase().trim();

    // System info commands
    if (this.matches(lower, ['system', 'info', 'status', 'stats', 'health'])) {
      return this.handleSystemInfo();
    }

    // Temperature commands
    if (this.matches(lower, ['temp', 'temperature', 'thermal', 'heat'])) {
      return this.handleTemperature();
    }

    // Motor commands
    if (this.matches(lower, ['forward', 'ahead', 'go forward'])) {
      const speed = this.extractNumber(lower) || 50;
      return this.handleMotor('forward', speed);
    }
    if (this.matches(lower, ['backward', 'back', 'reverse', 'go back'])) {
      const speed = this.extractNumber(lower) || 50;
      return this.handleMotor('backward', speed);
    }
    if (this.matches(lower, ['left', 'turn left'])) {
      const speed = this.extractNumber(lower) || 30;
      return this.handleMotor('left', speed);
    }
    if (this.matches(lower, ['right', 'turn right'])) {
      const speed = this.extractNumber(lower) || 30;
      return this.handleMotor('right', speed);
    }
    if (this.matches(lower, ['stop', 'halt', 'brake'])) {
      return this.handleMotor('stop', 0);
    }
    if (this.matches(lower, ['motor', 'drive'])) {
      return this.handleMotorStatus();
    }

    // Camera commands
    if (this.matches(lower, ['camera', 'capture', 'photo', 'picture', 'image', 'snapshot'])) {
      return this.handleCamera();
    }

    // Network commands
    if (this.matches(lower, ['network', 'ip', 'wifi', 'ethernet', 'connection'])) {
      return this.handleNetwork();
    }

    // Speech commands
    if (lower.startsWith('say ') || lower.startsWith('speak ')) {
      const textToSpeak = text.replace(/^(say|speak)\s+/i, '');
      return this.handleSpeak(textToSpeak);
    }

    // Shell commands (limited)
    if (lower.startsWith('run ') || lower.startsWith('exec ')) {
      const cmd = text.replace(/^(run|exec)\s+/i, '');
      return this.handleShellCommand(cmd);
    }

    // Help
    if (this.matches(lower, ['help', 'commands', 'what can you do'])) {
      return this.handleHelp();
    }

    // Default: echo back
    return `Jetson UGV received: "${text}"\n\nAvailable commands:\n- system info\n- temperature\n- forward/backward/left/right/stop\n- camera capture\n- network info\n- say <text>\n- help`;
  }

  private matches(text: string, keywords: string[]): boolean {
    return keywords.some(kw => text.includes(kw));
  }

  private extractNumber(text: string): number | null {
    const match = text.match(/\d+/);
    return match ? parseInt(match[0]) : null;
  }

  private async handleSystemInfo(): Promise<string> {
    try {
      const info = await this.client.getSystemInfo();
      const uptimeHours = Math.floor(info.uptime / 3600);
      const uptimeMins = Math.floor((info.uptime % 3600) / 60);

      let response = `System Status:\n`;
      response += `  Hostname: ${info.hostname}\n`;
      if (info.jetsonModel) {
        response += `  Model: ${info.jetsonModel}\n`;
      }
      response += `  CPU Temp: ${info.cpuTemp.toFixed(1)}°C\n`;
      if (info.gpuTemp !== undefined) {
        response += `  GPU Temp: ${info.gpuTemp.toFixed(1)}°C\n`;
      }
      response += `  CPU Usage: ${info.cpuUsage.toFixed(1)}%\n`;
      response += `  Memory: ${info.memoryUsed.toFixed(0)}/${info.memoryTotal.toFixed(0)} MB (${((info.memoryUsed / info.memoryTotal) * 100).toFixed(1)}%)\n`;
      response += `  Disk: ${info.diskUsed}/${info.diskTotal} MB\n`;
      response += `  Uptime: ${uptimeHours}h ${uptimeMins}m`;

      return response;
    } catch (err) {
      return `Error getting system info: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  }

  private async handleTemperature(): Promise<string> {
    try {
      const info = await this.client.getSystemInfo();
      let response = `Temperature:\n`;
      response += `  CPU: ${info.cpuTemp.toFixed(1)}°C`;
      if (info.gpuTemp !== undefined) {
        response += `\n  GPU: ${info.gpuTemp.toFixed(1)}°C`;
      }
      return response;
    } catch (err) {
      return `Error reading temperature: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  }

  private async handleMotor(action: 'forward' | 'backward' | 'left' | 'right' | 'stop', speed: number): Promise<string> {
    try {
      const status = await this.client.motorControl({ action, value: speed });
      return `Motor: ${status.direction} at ${status.currentSpeed}% speed\nLeft: ${status.leftMotor}%, Right: ${status.rightMotor}%`;
    } catch (err) {
      return `Motor error: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  }

  private async handleMotorStatus(): Promise<string> {
    try {
      const status = await this.client.getMotorStatus();
      return `Motor Status:\n  Direction: ${status.direction}\n  Speed: ${status.currentSpeed}%\n  Left: ${status.leftMotor}%\n  Right: ${status.rightMotor}%`;
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  }

  private async handleCamera(): Promise<string> {
    try {
      const capture = await this.client.captureCamera();
      if (capture.success) {
        // Return image info (actual base64 would be too long for text response)
        return `Camera captured: ${capture.width}x${capture.height} at ${new Date(capture.timestamp).toISOString()}\nImage size: ${Math.round((capture.imageBase64?.length || 0) / 1024)} KB (base64)`;
      } else {
        return `Camera error: ${capture.error}`;
      }
    } catch (err) {
      return `Camera error: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  }

  private async handleNetwork(): Promise<string> {
    try {
      const info = await this.client.getNetworkInfo();
      let response = `Network:\n`;
      response += `  Hostname: ${info.hostname}\n`;
      response += `  Gateway: ${info.gateway}\n`;
      response += `  Interfaces:\n`;
      for (const iface of info.interfaces) {
        response += `    ${iface.name}: ${iface.ip} (${iface.mac})\n`;
      }
      return response.trim();
    } catch (err) {
      return `Network error: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  }

  private async handleSpeak(text: string): Promise<string> {
    const success = await this.client.speak(text);
    return success ? `Speaking: "${text}"` : `TTS not available. Would say: "${text}"`;
  }

  private async handleShellCommand(cmd: string): Promise<string> {
    try {
      const result = await this.client.runCommand(cmd);
      if (result.exitCode === 0) {
        return result.stdout || '(no output)';
      } else {
        return `Error (${result.exitCode}): ${result.stderr || result.stdout}`;
      }
    } catch (err) {
      return `Command error: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  }

  private handleHelp(): string {
    return `Jetson UGV Commands:

System:
  - "system info" / "status" - Get system stats
  - "temperature" - CPU/GPU temps
  - "network" - Network interfaces

Motors:
  - "forward [speed]" - Move forward
  - "backward [speed]" - Move backward
  - "left" / "right" - Turn
  - "stop" - Stop motors
  - "motor status" - Current motor state

Camera:
  - "camera" / "capture" - Take a photo

Other:
  - "say <text>" - Text to speech
  - "run <cmd>" - Run safe shell commands`;
  }
}
