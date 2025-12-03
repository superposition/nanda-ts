# Getting Started

This guide will help you get up and running with NANDA-TS quickly.

## Prerequisites

- **Bun** >= 1.1.0 ([Install Bun](https://bun.sh))
- Basic TypeScript knowledge

## Installation

### Using Bun (Recommended)

```bash
bun add nanda-ts
```

### Using npm/pnpm/yarn

```bash
npm install nanda-ts
# or
pnpm add nanda-ts
# or
yarn add nanda-ts
```

> **Note:** While installable via npm/pnpm/yarn, NANDA-TS uses Bun-native APIs and requires Bun as the runtime.

## Creating Your First Agent

### Step 1: Create a New Project

```bash
# Using the CLI
bunx nanda-ts init my-first-agent
cd my-first-agent

# Or manually
mkdir my-first-agent && cd my-first-agent
bun init -y
bun add nanda-ts
```

### Step 2: Create the Agent Server

Create `src/index.ts`:

```typescript
import { AgentServer } from 'nanda-ts';

// Create the server
const server = new AgentServer({
  name: 'my-first-agent',
  description: 'My first NANDA agent',
  version: '1.0.0',
  port: 3000,
  skills: [
    {
      id: 'echo',
      name: 'Echo',
      description: 'Echoes back your message',
      inputModes: ['text'],
      outputModes: ['text'],
    },
  ],
});

// Handle incoming messages
server.onMessage(async (params, ctx) => {
  // Get the user's message
  const userMessage = params.message.parts
    .filter(p => p.type === 'text')
    .map(p => p.text)
    .join(' ');

  // Create a response task
  const task = ctx.createTask(
    {
      role: 'agent',
      parts: [{ type: 'text', text: `You said: ${userMessage}` }],
    },
    params.contextId
  );

  // Mark as completed
  ctx.updateTaskState(task.id, 'COMPLETED');

  return { ...task, state: 'COMPLETED' };
});

// Start the server
await server.start();
console.log('🚀 Agent running at http://localhost:3000');
console.log('📋 Agent Card: http://localhost:3000/.well-known/agent.json');
```

### Step 3: Run the Agent

```bash
bun run src/index.ts
```

### Step 4: Test the Agent

In another terminal:

```bash
# Check the agent card
curl http://localhost:3000/.well-known/agent.json | jq

# Send a message
curl -X POST http://localhost:3000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "1",
    "params": {
      "message": {
        "role": "user",
        "parts": [{"type": "text", "text": "Hello, Agent!"}]
      }
    }
  }' | jq
```

## Connecting to an Agent

### Basic Client Usage

Create `client.ts`:

```typescript
import { A2AClient } from 'nanda-ts';

const client = new A2AClient({
  agentUrl: 'http://localhost:3000',
});

// Discover agent capabilities
const card = await client.discover();
console.log('Agent:', card.name);
console.log('Description:', card.description);
console.log('Skills:', card.skills.map(s => s.name).join(', '));

// Send a message
const task = await client.sendMessage({
  message: {
    role: 'user',
    parts: [{ type: 'text', text: 'Hello from the client!' }],
  },
});

console.log('Task ID:', task.id);
console.log('State:', task.state);
console.log('Response:', task.message?.parts[0].text);
```

Run it:

```bash
bun run client.ts
```

## Using the Registry

### Discovering Agents

```typescript
import { createIndexClient } from 'nanda-ts';

const registry = createIndexClient();

// Search for agents by capability
const agents = await registry.search({
  query: 'translation',
  capabilities: ['translate'],
});

for (const agent of agents) {
  console.log(`- ${agent.handle}: ${agent.description}`);
}
```

### Registering Your Agent

```typescript
import { createIndexClient } from 'nanda-ts';

const registry = createIndexClient({
  apiKey: process.env.NANDA_API_KEY,
});

await registry.register({
  handle: 'my-first-agent',
  factsUrl: 'https://example.com/my-agent/facts.json',
});

console.log('Agent registered successfully!');
```

## Using the Unified Client

The `NandaClient` provides a high-level API that combines registry discovery with agent communication:

```typescript
import { NandaClient } from 'nanda-ts';

const client = new NandaClient();

// Connect by handle (resolves via registry)
const agent = await client.connect('some-agent');

// Or connect by URL
const agentByUrl = await client.connect('http://localhost:3000');

// Send messages
const response = await agent.send('Hello!');
console.log(response);

// Stream responses
for await (const chunk of agent.stream('Tell me a story')) {
  process.stdout.write(chunk);
}
```

## Next Steps

- [[Architecture]] - Understand the system design
- [[API Reference]] - Explore the full API
- [[Protocols]] - Deep dive into A2A, MCP, and NLWeb
- [[Examples]] - More code examples
- [[CLI]] - Use the command-line interface

## Troubleshooting

### Common Issues

**"Port already in use"**
```bash
# Find and kill the process using the port
lsof -i :3000
kill -9 <PID>
```

**"Module not found"**
```bash
# Ensure dependencies are installed
bun install
```

**"Bun not found"**
```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash
```

### Getting Help

- [GitHub Issues](https://github.com/nanda-ai/nanda-ts/issues)
- [Discussions](https://github.com/nanda-ai/nanda-ts/discussions)
