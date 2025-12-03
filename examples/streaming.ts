/**
 * Streaming Example
 *
 * Demonstrates how to use streaming responses with A2A.
 */

import { AgentServer } from '../src/server/AgentServer';
import { A2AClient } from '../src/protocols/a2a/A2AClient';

// Create a server that supports streaming
async function createStreamingServer() {
  const server = new AgentServer({
    name: 'streaming-agent',
    description: 'An agent that streams responses word by word',
    version: '1.0.0',
    port: 3001,
    provider: { organization: 'NANDA Examples' },
    skills: [
      {
        id: 'stream',
        name: 'Stream',
        description: 'Streams text word by word',
        tags: ['streaming', 'demo'],
        inputModes: ['text'],
        outputModes: ['text'],
      },
    ],
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
  });

  server.onMessage(async (params, ctx) => {
    const textPart = params.message.parts.find((p) => p.type === 'text');
    const text = textPart?.type === 'text' ? textPart.text : '';

    // Simulate streaming response
    const response = `You said: "${text}". This response is being streamed to you.`;

    // Create task in WORKING state
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

async function main() {
  // Start the server
  const server = await createStreamingServer();
  await server.start();

  console.log('Streaming Agent started on port 3001');
  console.log('');

  // Give server a moment to start
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Connect as a client
  const client = new A2AClient({
    agentUrl: 'http://localhost:3001',
  });

  // Discover the agent
  const card = await client.discover();
  console.log(`Connected to: ${card.name}`);
  console.log(`Streaming supported: ${card.capabilities?.streaming}`);
  console.log('');

  // Send a message
  console.log('Sending message...');
  const task = await client.sendMessage({
    message: {
      role: 'user',
      parts: [{ type: 'text', text: 'Hello streaming world!' }],
    },
  });

  console.log(`Task state: ${task.state}`);

  if (task.message) {
    const textPart = task.message.parts.find((p) => p.type === 'text');
    if (textPart?.type === 'text') {
      console.log(`Response: ${textPart.text}`);
    }
  }

  // Clean up
  await server.stop();
  console.log('\nServer stopped.');
}

main().catch(console.error);
