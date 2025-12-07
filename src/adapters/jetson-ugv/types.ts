/**
 * Jetson UGV Adapter Types
 */

export interface JetsonUGVAgentConfig {
  /** Port to run the agent on (default: 8000) */
  port?: number;
  /** Agent name (default: 'jetson-ugv') */
  name?: string;
  /** Enable camera features */
  enableCamera?: boolean;
  /** Enable motor control */
  enableMotors?: boolean;
  /** Motor control interface (e.g., GPIO pins, serial port) */
  motorInterface?: string;
  /** Camera device (e.g., /dev/video0) */
  cameraDevice?: string;
}

export interface MotorCommand {
  action: 'forward' | 'backward' | 'left' | 'right' | 'stop' | 'speed';
  value?: number; // Speed (0-100) or duration (ms)
  duration?: number;
}

export interface SystemInfo {
  hostname: string;
  cpuTemp: number;
  gpuTemp?: number;
  cpuUsage: number;
  memoryUsed: number;
  memoryTotal: number;
  diskUsed: number;
  diskTotal: number;
  uptime: number;
  jetsonModel?: string;
}

export interface CameraCapture {
  success: boolean;
  imageBase64?: string;
  width?: number;
  height?: number;
  timestamp: number;
  error?: string;
}

export interface MotorStatus {
  enabled: boolean;
  currentSpeed: number;
  direction: 'forward' | 'backward' | 'stopped' | 'turning';
  leftMotor: number;
  rightMotor: number;
}

export interface GPIOStatus {
  pin: number;
  mode: 'input' | 'output';
  value: number;
}

export interface NetworkInfo {
  interfaces: {
    name: string;
    ip: string;
    mac: string;
  }[];
  hostname: string;
  gateway: string;
}
