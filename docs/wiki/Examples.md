# Examples

Practical code examples for common NANDA-TS use cases.

## Table of Contents

- [Basic Agent Server](#basic-agent-server)
- [Echo Agent](#echo-agent)
- [Streaming Responses](#streaming-responses)
- [Multi-Skill Agent](#multi-skill-agent)
- [Client Connection](#client-connection)
- [Registry Integration](#registry-integration)
- [Agent with Identity](#agent-with-identity)
- [Error Handling](#error-handling)
- [Testing Agents](#testing-agents)

---

## Basic Agent Server

The simplest possible agent:

```typescript
import { AgentServer } from 'nanda-ts';

const server = new AgentServer({
  name: 'basic-agent',
  description: 'A basic NANDA agent',
  port: 3000,
});

server.onMessage(async (params, ctx) => {
  const task = ctx.createTask({
    role: 'agent',
    parts: [{ type: 'text', text: 'Hello from basic-agent!' }],
  }, params.contextId);

  ctx.updateTaskState(task.id, 'COMPLETED');
  return { ...task, state: 'COMPLETED' };
});

await server.start();
console.log('Agent running at http://localhost:3000');
```

---

## Echo Agent

An agent that echoes back user messages:

```typescript
import { AgentServer } from 'nanda-ts';

const server = new AgentServer({
  name: 'echo-agent',
  description: 'Echoes back your messages',
  skills: [{
    id: 'echo',
    name: 'Echo',
    description: 'Repeats what you say',
    inputModes: ['text'],
    outputModes: ['text'],
  }],
});

server.onMessage(async (params, ctx) => {
  // Extract text from all parts
  const userText = params.message.parts
    .filter(p => p.type === 'text')
    .map(p => p.text)
    .join(' ');

  const task = ctx.createTask({
    role: 'agent',
    parts: [{
      type: 'text',
      text: `You said: "${userText}"`
    }],
  }, params.contextId);

  ctx.updateTaskState(task.id, 'COMPLETED');
  return { ...task, state: 'COMPLETED' };
});

await server.start();
```

---

## Streaming Responses

Agent with streaming response support:

```typescript
import { AgentServer } from 'nanda-ts';

const server = new AgentServer({
  name: 'streaming-agent',
  description: 'Streams responses word by word',
  capabilities: {
    streaming: true,
  },
  skills: [{
    id: 'story',
    name: 'Story Teller',
    description: 'Tells a story with streaming',
    inputModes: ['text'],
    outputModes: ['text'],
  }],
});

server.onMessage(async (params, ctx) => {
  const task = ctx.createTask({
    role: 'agent',
    parts: [{ type: 'text', text: '' }],
  }, params.contextId);

  ctx.updateTaskState(task.id, 'WORKING');

  // Simulate streaming response
  const story = 'Once upon a time, in a land far away, there lived a curious robot who loved to learn.';
  const words = story.split(' ');

  for (const word of words) {
    // Append to the response
    await ctx.appendToMessage(task.id, word + ' ');

    // Emit streaming event
    ctx.emit(task.id, 'message', {
      type: 'text',
      text: word + ' '
    });

    // Simulate delay
    await new Promise(r => setTimeout(r, 100));
  }

  ctx.updateTaskState(task.id, 'COMPLETED');
  return task;
});

await server.start();
```

**Client streaming:**

```typescript
import { A2AClient } from 'nanda-ts';

const client = new A2AClient({ agentUrl: 'http://localhost:3000' });

const stream = await client.sendMessageStream({
  message: {
    role: 'user',
    parts: [{ type: 'text', text: 'Tell me a story' }],
  },
});

for await (const event of stream) {
  if (event.type === 'message') {
    process.stdout.write(event.data.text);
  } else if (event.type === 'task') {
    console.log('\nTask state:', event.data.state);
  }
}
```

---

## Multi-Skill Agent

Agent with multiple capabilities:

```typescript
import { AgentServer } from 'nanda-ts';

const server = new AgentServer({
  name: 'multi-skill-agent',
  description: 'Agent with multiple skills',
  skills: [
    {
      id: 'translate',
      name: 'Translate',
      description: 'Translate text between languages',
      inputModes: ['text'],
      outputModes: ['text'],
    },
    {
      id: 'summarize',
      name: 'Summarize',
      description: 'Summarize long text',
      inputModes: ['text'],
      outputModes: ['text'],
    },
    {
      id: 'sentiment',
      name: 'Sentiment Analysis',
      description: 'Analyze text sentiment',
      inputModes: ['text'],
      outputModes: ['text', 'data'],
    },
  ],
});

server.onMessage(async (params, ctx) => {
  const text = params.message.parts
    .filter(p => p.type === 'text')
    .map(p => p.text)
    .join(' ');

  // Detect which skill to use
  const skill = detectSkill(text);
  let response;

  switch (skill) {
    case 'translate':
      response = await handleTranslate(text);
      break;
    case 'summarize':
      response = await handleSummarize(text);
      break;
    case 'sentiment':
      response = await handleSentiment(text);
      break;
    default:
      response = "I can translate, summarize, or analyze sentiment. What would you like?";
  }

  const task = ctx.createTask({
    role: 'agent',
    parts: [{ type: 'text', text: response }],
  }, params.contextId);

  ctx.updateTaskState(task.id, 'COMPLETED');
  return { ...task, state: 'COMPLETED' };
});

function detectSkill(text: string): string {
  if (text.toLowerCase().includes('translate')) return 'translate';
  if (text.toLowerCase().includes('summarize')) return 'summarize';
  if (text.toLowerCase().includes('sentiment')) return 'sentiment';
  return 'unknown';
}

async function handleTranslate(text: string): Promise<string> {
  // Translation logic here
  return `Translated: ${text}`;
}

async function handleSummarize(text: string): Promise<string> {
  // Summarization logic here
  return `Summary: ${text.slice(0, 50)}...`;
}

async function handleSentiment(text: string): Promise<string> {
  // Sentiment analysis logic here
  return `Sentiment: Positive (0.85)`;
}

await server.start();
```

---

## Client Connection

Connecting to and interacting with agents:

```typescript
import { A2AClient, NandaClient } from 'nanda-ts';

// Direct connection
async function directConnection() {
  const client = new A2AClient({
    agentUrl: 'http://localhost:3000',
    timeout: 30000,
  });

  // Discover capabilities
  const card = await client.discover();
  console.log('Agent:', card.name);
  console.log('Skills:', card.skills.map(s => s.name));

  // Send message
  const task = await client.sendMessage({
    message: {
      role: 'user',
      parts: [{ type: 'text', text: 'Hello!' }],
    },
  });

  console.log('Response:', task.message?.parts[0].text);
}

// Via registry
async function registryConnection() {
  const nanda = new NandaClient();

  // Connect by handle
  const agent = await nanda.connect('my-agent');

  // Simple send
  const response = await agent.send('Hello!');
  console.log(response);

  // With conversation context
  const ctx = await agent.createContext();
  await ctx.send('Remember, my name is Alice');
  const response2 = await ctx.send('What is my name?');
  console.log(response2); // Should mention "Alice"
}

// Batch operations
async function batchOperations() {
  const nanda = new NandaClient();

  // Search for agents
  const agents = await nanda.search({
    query: 'translation',
    capabilities: ['translate'],
  });

  // Connect to multiple agents
  const connections = await Promise.all(
    agents.slice(0, 3).map(a => nanda.connect(a.handle))
  );

  // Send to all
  const results = await Promise.all(
    connections.map(c => c.send('Translate "Hello" to Spanish'))
  );

  results.forEach((r, i) => {
    console.log(`${agents[i].name}: ${r}`);
  });
}
```

---

## Registry Integration

Working with the NANDA registry:

```typescript
import { createIndexClient, AgentServer, AgentFacts } from 'nanda-ts';

// Register your agent
async function registerAgent() {
  const registry = createIndexClient({
    apiKey: process.env.NANDA_API_KEY,
  });

  // Build agent facts
  const facts = new AgentFacts()
    .setName('My Agent')
    .setDescription('A helpful agent')
    .setVersion('1.0.0')
    .addCapability('chat')
    .build();

  // Host facts (you'd typically serve this from your server)
  // For this example, assume it's hosted at:
  const factsUrl = 'https://my-agent.example.com/facts.json';

  await registry.register({
    handle: 'my-agent',
    factsUrl,
  });

  console.log('Agent registered!');
}

// Search for agents
async function searchAgents() {
  const registry = createIndexClient();

  const results = await registry.search({
    query: 'translation language',
    capabilities: ['translate'],
    limit: 10,
  });

  console.log('Found agents:');
  for (const agent of results) {
    console.log(`  ${agent.handle}: ${agent.description}`);
  }
}

// Resolve and connect
async function resolveAndConnect() {
  const registry = createIndexClient();

  const agent = await registry.resolve('translation-agent');
  console.log('Resolved:', agent.name, agent.url);

  // Connect using the resolved URL
  const client = new A2AClient({ agentUrl: agent.url });
  const card = await client.discover();
  console.log('Agent Card:', card);
}
```

---

## Agent with Identity

Creating an agent with cryptographic identity:

```typescript
import { AgentServer, AgentIdentity, AgentFacts } from 'nanda-ts';

async function createSignedAgent() {
  // Generate identity
  const identity = await AgentIdentity.create();
  console.log('Agent DID:', identity.getDid());

  // Build and sign facts
  const facts = new AgentFacts()
    .setName('Secure Agent')
    .setDescription('An agent with verified identity')
    .setVersion('1.0.0')
    .addCapability('secure-messaging')
    .build();

  const signedFacts = await identity.signJson(facts);

  // Create server
  const server = new AgentServer({
    name: facts.name,
    description: facts.description,
    skills: [{
      id: 'secure-chat',
      name: 'Secure Chat',
      description: 'Signed message exchange',
      inputModes: ['text'],
      outputModes: ['text'],
    }],
  });

  server.onMessage(async (params, ctx) => {
    const userText = params.message.parts
      .filter(p => p.type === 'text')
      .map(p => p.text)
      .join(' ');

    // Create signed response
    const responsePayload = {
      text: `Received: ${userText}`,
      timestamp: Date.now(),
    };
    const signedResponse = await identity.signJson(responsePayload);

    const task = ctx.createTask({
      role: 'agent',
      parts: [
        { type: 'text', text: responsePayload.text },
        { type: 'data', data: signedResponse },
      ],
    }, params.contextId);

    ctx.updateTaskState(task.id, 'COMPLETED');
    return { ...task, state: 'COMPLETED' };
  });

  await server.start();
  console.log('Secure agent running at http://localhost:3000');
}

createSignedAgent();
```

---

## Error Handling

Robust error handling patterns:

```typescript
import {
  AgentServer,
  A2AClient,
  JsonRpcError,
  TaskError,
  TimeoutError,
  ConnectionError,
} from 'nanda-ts';

// Server-side error handling
const server = new AgentServer({
  name: 'error-handling-agent',
  description: 'Demonstrates error handling',
});

server.onMessage(async (params, ctx) => {
  try {
    const text = params.message.parts
      .filter(p => p.type === 'text')
      .map(p => p.text)
      .join(' ');

    // Validate input
    if (!text.trim()) {
      throw new JsonRpcError(-32602, 'Message cannot be empty');
    }

    // Simulate processing
    const result = await processMessage(text);

    const task = ctx.createTask({
      role: 'agent',
      parts: [{ type: 'text', text: result }],
    }, params.contextId);

    ctx.updateTaskState(task.id, 'COMPLETED');
    return { ...task, state: 'COMPLETED' };

  } catch (error) {
    // Create failed task
    const task = ctx.createTask({
      role: 'agent',
      parts: [{
        type: 'text',
        text: `Error: ${error.message}`
      }],
    }, params.contextId);

    ctx.updateTaskState(task.id, 'FAILED');
    return { ...task, state: 'FAILED', error };
  }
});

// Client-side error handling
async function clientWithErrorHandling() {
  const client = new A2AClient({
    agentUrl: 'http://localhost:3000',
    timeout: 5000,
  });

  try {
    const task = await client.sendMessage({
      message: {
        role: 'user',
        parts: [{ type: 'text', text: 'Hello!' }],
      },
    });

    if (task.state === 'FAILED') {
      console.error('Task failed:', task.error);
      return;
    }

    console.log('Success:', task.message?.parts[0].text);

  } catch (error) {
    if (error instanceof TimeoutError) {
      console.error('Request timed out');
    } else if (error instanceof ConnectionError) {
      console.error('Failed to connect to agent');
    } else if (error instanceof JsonRpcError) {
      console.error('RPC Error:', error.code, error.message);
    } else {
      console.error('Unknown error:', error);
    }
  }
}

// Retry logic
async function sendWithRetry(
  client: A2AClient,
  message: string,
  maxRetries = 3
) {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await client.sendMessage({
        message: {
          role: 'user',
          parts: [{ type: 'text', text: message }],
        },
      });
    } catch (error) {
      lastError = error;
      console.log(`Attempt ${attempt} failed, retrying...`);
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }

  throw lastError;
}
```

---

## Testing Agents

Testing your agents:

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { AgentServer, A2AClient } from 'nanda-ts';

describe('Echo Agent', () => {
  let server: AgentServer;
  let client: A2AClient;

  beforeAll(async () => {
    server = new AgentServer({
      name: 'test-agent',
      description: 'Test agent',
      port: 3001,
    });

    server.onMessage(async (params, ctx) => {
      const text = params.message.parts
        .filter(p => p.type === 'text')
        .map(p => p.text)
        .join(' ');

      const task = ctx.createTask({
        role: 'agent',
        parts: [{ type: 'text', text: `Echo: ${text}` }],
      }, params.contextId);

      ctx.updateTaskState(task.id, 'COMPLETED');
      return { ...task, state: 'COMPLETED' };
    });

    await server.start();
    client = new A2AClient({ agentUrl: 'http://localhost:3001' });
  });

  afterAll(async () => {
    await server.stop();
  });

  test('should discover agent card', async () => {
    const card = await client.discover();
    expect(card.name).toBe('test-agent');
  });

  test('should echo messages', async () => {
    const task = await client.sendMessage({
      message: {
        role: 'user',
        parts: [{ type: 'text', text: 'Hello, World!' }],
      },
    });

    expect(task.state).toBe('COMPLETED');
    expect(task.message?.parts[0].text).toBe('Echo: Hello, World!');
  });

  test('should handle empty messages', async () => {
    const task = await client.sendMessage({
      message: {
        role: 'user',
        parts: [{ type: 'text', text: '' }],
      },
    });

    expect(task.state).toBe('COMPLETED');
    expect(task.message?.parts[0].text).toBe('Echo: ');
  });
});
```

Run tests:

```bash
bun test
```
