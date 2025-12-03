/**
 * Basic Client Example
 *
 * Demonstrates how to connect to and communicate with an A2A agent.
 */

import { A2AClient } from '../src/protocols/a2a/A2AClient';

async function main() {
  // Create a client for an A2A-compliant agent
  const client = new A2AClient({
    agentUrl: 'http://localhost:3000',
    timeout: 30000,
  });

  try {
    // Discover the agent's capabilities
    console.log('Discovering agent...');
    const card = await client.discover();

    console.log(`Connected to: ${card.name}`);
    console.log(`Description: ${card.description}`);
    console.log(`Skills: ${card.skills.map((s) => s.name).join(', ')}`);

    // Send a message to the agent
    console.log('\nSending message...');
    const task = await client.sendMessage({
      message: {
        role: 'user',
        parts: [{ type: 'text', text: 'Hello! What can you do?' }],
      },
    });

    console.log(`Task ID: ${task.id}`);
    console.log(`State: ${task.state}`);

    if (task.message) {
      const textPart = task.message.parts.find((p) => p.type === 'text');
      if (textPart?.type === 'text') {
        console.log(`Response: ${textPart.text}`);
      }
    }

    // List all tasks
    console.log('\nListing tasks...');
    const { tasks } = await client.listTasks();
    console.log(`Total tasks: ${tasks.length}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
