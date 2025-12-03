/**
 * Basic Server Example
 *
 * Demonstrates how to create a simple A2A-compliant agent server.
 */

import { AgentServer } from '../src/server/AgentServer';

async function main() {
  // Create the agent server
  const server = new AgentServer({
    name: 'echo-agent',
    description: 'A simple echo agent that repeats messages',
    version: '1.0.0',
    port: 3000,
    provider: {
      organization: 'NANDA Examples',
    },
    skills: [
      {
        id: 'echo',
        name: 'Echo',
        description: 'Echoes back the input message',
        tags: ['utility', 'demo'],
        inputModes: ['text'],
        outputModes: ['text'],
      },
    ],
  });

  // Handle incoming messages
  server.onMessage(async (params, ctx) => {
    const textPart = params.message.parts.find((p) => p.type === 'text');
    const text = textPart?.type === 'text' ? textPart.text : '';

    console.log(`Received message: ${text}`);

    // Create and return a task
    const task = ctx.createTask(
      {
        role: 'agent',
        parts: [{ type: 'text', text: `Echo: ${text}` }],
      },
      params.contextId
    );

    ctx.updateTaskState(task.id, 'COMPLETED');

    return {
      ...task,
      state: 'COMPLETED' as const,
    };
  });

  // Start the server
  await server.start();

  console.log(`
Echo Agent is running!

Endpoints:
  Agent Card: http://localhost:3000/.well-known/agent.json
  JSON-RPC:   http://localhost:3000/rpc
  Health:     http://localhost:3000/health

Press Ctrl+C to stop.
  `);
}

main().catch(console.error);
