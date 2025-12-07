/**
 * Jetson UGV NANDA Agent Factory
 *
 * Creates an AgentServer configured for Jetson-based UGV platforms.
 */

import { AgentServer } from '../../server/AgentServer';
import { extractText } from '../../types/protocol';
import type { Skill } from '../../types/agent';
import type { JetsonUGVAgentConfig } from './types';
import { JetsonUGVClient } from './client';
import { JetsonUGVRouter } from './router';

/**
 * Jetson UGV skill definitions
 */
const JETSON_UGV_SKILLS: Skill[] = [
  {
    id: 'system/info',
    name: 'System Info',
    description: 'Get system status: CPU/GPU temp, memory, disk, uptime',
    tags: ['system', 'monitoring', 'hardware'],
    inputModes: ['text'],
    outputModes: ['text'],
  },
  {
    id: 'motor/control',
    name: 'Motor Control',
    description: 'Control UGV motors: forward, backward, left, right, stop',
    tags: ['motor', 'drive', 'movement', 'ugv'],
    inputModes: ['text'],
    outputModes: ['text'],
  },
  {
    id: 'camera/capture',
    name: 'Camera Capture',
    description: 'Capture image from onboard camera',
    tags: ['camera', 'vision', 'capture'],
    inputModes: ['text'],
    outputModes: ['text', 'image'],
  },
  {
    id: 'network/info',
    name: 'Network Info',
    description: 'Get network interfaces, IPs, and connectivity',
    tags: ['network', 'wifi', 'ethernet'],
    inputModes: ['text'],
    outputModes: ['text'],
  },
  {
    id: 'speech/say',
    name: 'Text to Speech',
    description: 'Speak text through audio output',
    tags: ['speech', 'tts', 'audio'],
    inputModes: ['text'],
    outputModes: ['text'],
  },
  {
    id: 'shell/run',
    name: 'Run Command',
    description: 'Execute safe shell commands (limited set)',
    tags: ['shell', 'command', 'execute'],
    inputModes: ['text'],
    outputModes: ['text'],
  },
];

/**
 * Create a Jetson UGV NANDA agent
 *
 * @param config - Agent configuration
 * @returns Configured AgentServer ready to start
 *
 * @example
 * ```typescript
 * const agent = createJetsonUGVAgent({
 *   port: 8000,
 *   enableCamera: true,
 *   enableMotors: true,
 * });
 * await agent.start();
 * ```
 */
export function createJetsonUGVAgent(config: JetsonUGVAgentConfig = {}): AgentServer {
  // Create local hardware client
  const client = new JetsonUGVClient({
    cameraDevice: config.cameraDevice,
    motorInterface: config.motorInterface,
  });

  // Create command router
  const router = new JetsonUGVRouter(client);

  // Filter skills based on config
  let skills = [...JETSON_UGV_SKILLS];
  if (config.enableCamera === false) {
    skills = skills.filter(s => s.id !== 'camera/capture');
  }
  if (config.enableMotors === false) {
    skills = skills.filter(s => s.id !== 'motor/control');
  }

  // Create agent server
  const server = new AgentServer({
    name: config.name ?? 'jetson-ugv',
    description: 'Jetson-based UGV with motors, camera, and compute capabilities. NANDA-compatible agent.',
    version: '1.0.0',
    port: config.port ?? 8000,
    skills,
    provider: {
      organization: 'NANDA Jetson UGV',
    },
  });

  // Wire up message handler
  server.onMessage(async (params, ctx) => {
    // Extract text from incoming message
    const text = extractText(params.message);

    console.log(`[Jetson-UGV] Received: "${text}"`);

    // Route command to handler
    const response = await router.handleCommand(text);

    console.log(`[Jetson-UGV] Response: "${response.substring(0, 100)}..."`);

    // Create task with response
    const task = ctx.createTask(
      {
        role: 'agent',
        parts: [{ type: 'text', text: response }],
      },
      params.contextId
    );

    // Mark as completed
    ctx.updateTaskState(task.id, 'COMPLETED');

    return {
      ...task,
      state: 'COMPLETED' as const,
    };
  });

  return server;
}

/**
 * Get the Jetson UGV skill definitions
 */
export function getJetsonUGVSkills(): Skill[] {
  return [...JETSON_UGV_SKILLS];
}
