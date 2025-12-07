/**
 * Jetson UGV Local Client
 *
 * Interfaces with local Jetson hardware: motors, camera, GPIO, system info.
 * This runs ON the Jetson itself (not remote like M5Stick).
 */

import { execSync, exec } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import type { SystemInfo, MotorCommand, MotorStatus, CameraCapture, NetworkInfo } from './types';

export class JetsonUGVClient {
  private motorEnabled: boolean = false;
  private currentSpeed: number = 0;
  private currentDirection: 'forward' | 'backward' | 'stopped' | 'turning' = 'stopped';
  private cameraDevice: string;
  private motorInterface: string;

  constructor(config: { cameraDevice?: string; motorInterface?: string } = {}) {
    this.cameraDevice = config.cameraDevice || '/dev/video0';
    this.motorInterface = config.motorInterface || '/dev/ttyUSB0';
  }

  /**
   * Get system information (CPU temp, memory, disk, etc.)
   */
  async getSystemInfo(): Promise<SystemInfo> {
    const hostname = execSync('hostname').toString().trim();

    // CPU Temperature
    let cpuTemp = 0;
    try {
      // Jetson thermal zones
      const thermalPath = '/sys/devices/virtual/thermal/thermal_zone0/temp';
      if (existsSync(thermalPath)) {
        cpuTemp = parseInt(readFileSync(thermalPath, 'utf8')) / 1000;
      } else {
        // Fallback to sensors
        const tempOutput = execSync('cat /sys/class/thermal/thermal_zone*/temp 2>/dev/null | head -1').toString();
        cpuTemp = parseInt(tempOutput) / 1000;
      }
    } catch {
      cpuTemp = 0;
    }

    // GPU Temperature (Jetson specific)
    let gpuTemp: number | undefined;
    try {
      const gpuTempPath = '/sys/devices/virtual/thermal/thermal_zone1/temp';
      if (existsSync(gpuTempPath)) {
        gpuTemp = parseInt(readFileSync(gpuTempPath, 'utf8')) / 1000;
      }
    } catch {
      gpuTemp = undefined;
    }

    // CPU Usage
    let cpuUsage = 0;
    try {
      const loadAvg = readFileSync('/proc/loadavg', 'utf8').split(' ')[0];
      cpuUsage = parseFloat(loadAvg) * 100 / 4; // Normalize for 4 cores
    } catch {
      cpuUsage = 0;
    }

    // Memory
    let memoryUsed = 0;
    let memoryTotal = 0;
    try {
      const memInfo = readFileSync('/proc/meminfo', 'utf8');
      const total = memInfo.match(/MemTotal:\s+(\d+)/)?.[1];
      const available = memInfo.match(/MemAvailable:\s+(\d+)/)?.[1];
      if (total && available) {
        memoryTotal = parseInt(total) / 1024; // MB
        memoryUsed = memoryTotal - parseInt(available) / 1024;
      }
    } catch {
      // ignore
    }

    // Disk
    let diskUsed = 0;
    let diskTotal = 0;
    try {
      const dfOutput = execSync('df -BM / | tail -1').toString();
      const parts = dfOutput.split(/\s+/);
      diskTotal = parseInt(parts[1]);
      diskUsed = parseInt(parts[2]);
    } catch {
      // ignore
    }

    // Uptime
    let uptime = 0;
    try {
      uptime = parseFloat(readFileSync('/proc/uptime', 'utf8').split(' ')[0]);
    } catch {
      // ignore
    }

    // Jetson Model
    let jetsonModel: string | undefined;
    try {
      if (existsSync('/proc/device-tree/model')) {
        jetsonModel = readFileSync('/proc/device-tree/model', 'utf8').replace(/\0/g, '').trim();
      }
    } catch {
      jetsonModel = undefined;
    }

    return {
      hostname,
      cpuTemp,
      gpuTemp,
      cpuUsage: Math.min(100, cpuUsage),
      memoryUsed,
      memoryTotal,
      diskUsed,
      diskTotal,
      uptime,
      jetsonModel,
    };
  }

  /**
   * Execute a motor command
   */
  async motorControl(command: MotorCommand): Promise<MotorStatus> {
    // This is a placeholder - actual implementation depends on motor driver
    // Common options: GPIO, serial to motor controller, ROS, etc.

    console.log(`[Motor] Command: ${command.action}, value: ${command.value}`);

    switch (command.action) {
      case 'forward':
        this.currentDirection = 'forward';
        this.currentSpeed = command.value ?? 50;
        break;
      case 'backward':
        this.currentDirection = 'backward';
        this.currentSpeed = command.value ?? 50;
        break;
      case 'left':
      case 'right':
        this.currentDirection = 'turning';
        this.currentSpeed = command.value ?? 30;
        break;
      case 'stop':
        this.currentDirection = 'stopped';
        this.currentSpeed = 0;
        break;
      case 'speed':
        this.currentSpeed = Math.min(100, Math.max(0, command.value ?? 50));
        break;
    }

    // TODO: Implement actual motor control via GPIO/serial/ROS
    // Example GPIO control:
    // execSync(`gpio -g write 17 ${this.currentSpeed > 0 ? 1 : 0}`);

    // Example serial to motor controller:
    // execSync(`echo "${command.action} ${this.currentSpeed}" > ${this.motorInterface}`);

    return this.getMotorStatus();
  }

  /**
   * Get current motor status
   */
  async getMotorStatus(): Promise<MotorStatus> {
    return {
      enabled: this.motorEnabled,
      currentSpeed: this.currentSpeed,
      direction: this.currentDirection,
      leftMotor: this.currentDirection === 'right' ? 0 : this.currentSpeed,
      rightMotor: this.currentDirection === 'left' ? 0 : this.currentSpeed,
    };
  }

  /**
   * Capture image from camera
   */
  async captureCamera(): Promise<CameraCapture> {
    const timestamp = Date.now();

    try {
      // Check if camera exists
      if (!existsSync(this.cameraDevice)) {
        return {
          success: false,
          timestamp,
          error: `Camera not found at ${this.cameraDevice}`,
        };
      }

      // Capture using fswebcam or v4l2
      const tmpFile = `/tmp/capture_${timestamp}.jpg`;

      try {
        // Try fswebcam first
        execSync(`fswebcam -d ${this.cameraDevice} -r 640x480 --no-banner ${tmpFile} 2>/dev/null`, {
          timeout: 5000,
        });
      } catch {
        // Fallback to v4l2-ctl + ffmpeg
        try {
          execSync(`ffmpeg -f v4l2 -i ${this.cameraDevice} -frames:v 1 -y ${tmpFile} 2>/dev/null`, {
            timeout: 5000,
          });
        } catch {
          return {
            success: false,
            timestamp,
            error: 'Failed to capture image (no capture tool available)',
          };
        }
      }

      // Read and encode
      const imageBuffer = readFileSync(tmpFile);
      const imageBase64 = imageBuffer.toString('base64');

      // Clean up
      execSync(`rm -f ${tmpFile}`);

      return {
        success: true,
        imageBase64,
        width: 640,
        height: 480,
        timestamp,
      };
    } catch (err) {
      return {
        success: false,
        timestamp,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Get network information
   */
  async getNetworkInfo(): Promise<NetworkInfo> {
    const hostname = execSync('hostname').toString().trim();

    let gateway = '';
    try {
      gateway = execSync("ip route | grep default | awk '{print $3}'").toString().trim();
    } catch {
      // ignore
    }

    const interfaces: NetworkInfo['interfaces'] = [];
    try {
      const ifOutput = execSync("ip -o addr show | grep 'inet ' | awk '{print $2, $4}'").toString();
      const macOutput = execSync("ip -o link show | awk '{print $2, $(NF-2)}'").toString();

      const macs: Record<string, string> = {};
      for (const line of macOutput.split('\n')) {
        const [name, mac] = line.split(/\s+/);
        if (name && mac) {
          macs[name.replace(':', '')] = mac;
        }
      }

      for (const line of ifOutput.split('\n')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const name = parts[0];
          const ip = parts[1].split('/')[0];
          if (name !== 'lo') {
            interfaces.push({
              name,
              ip,
              mac: macs[name] || 'unknown',
            });
          }
        }
      }
    } catch {
      // ignore
    }

    return { interfaces, hostname, gateway };
  }

  /**
   * Run a shell command (with safety limits)
   */
  async runCommand(cmd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // Safety: only allow specific safe commands
    const safeCommands = [
      'uptime', 'hostname', 'whoami', 'date', 'pwd',
      'ls', 'df', 'free', 'top -bn1', 'ps aux',
      'ip addr', 'ip route', 'cat /proc/cpuinfo',
      'tegrastats', 'nvpmodel -q', 'jetson_clocks --show',
    ];

    const isSafe = safeCommands.some(safe => cmd.startsWith(safe));
    if (!isSafe) {
      return {
        stdout: '',
        stderr: `Command not allowed: ${cmd}`,
        exitCode: 1,
      };
    }

    try {
      const stdout = execSync(cmd, { timeout: 10000 }).toString();
      return { stdout, stderr: '', exitCode: 0 };
    } catch (err: unknown) {
      const error = err as { stdout?: Buffer; stderr?: Buffer; status?: number };
      return {
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || '',
        exitCode: error.status || 1,
      };
    }
  }

  /**
   * Speak text using TTS (if available)
   */
  async speak(text: string): Promise<boolean> {
    try {
      // Try espeak first
      execSync(`espeak "${text.replace(/"/g, '\\"')}" 2>/dev/null`, { timeout: 30000 });
      return true;
    } catch {
      try {
        // Try pico2wave
        execSync(`pico2wave -w /tmp/speech.wav "${text}" && aplay /tmp/speech.wav`, { timeout: 30000 });
        return true;
      } catch {
        console.log('[TTS] No speech synthesis available');
        return false;
      }
    }
  }
}
