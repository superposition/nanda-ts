# Protocols

NANDA-TS implements multiple agent communication protocols to enable interoperability across different AI agent ecosystems.

## Overview

| Protocol | Version | Description | Status |
|----------|---------|-------------|--------|
| A2A | v0.3.0 | Google's Agent-to-Agent Protocol | Full Implementation |
| MCP | - | Anthropic's Model Context Protocol | Bridge (Stub) |
| NLWeb | - | Microsoft's Natural Language Web | Client Implementation |

---

## A2A Protocol

The Agent-to-Agent (A2A) protocol is Google's specification for agent communication, enabling agents to discover each other, exchange messages, and manage tasks.

### Key Concepts

#### Agent Card

Every A2A agent must expose an Agent Card at `/.well-known/agent.json`:

```json
{
  "name": "My Agent",
  "description": "A helpful agent",
  "url": "https://agent.example.com",
  "version": "1.0.0",
  "skills": [
    {
      "id": "chat",
      "name": "Chat",
      "description": "General conversation",
      "inputModes": ["text"],
      "outputModes": ["text"]
    }
  ],
  "capabilities": {
    "streaming": true,
    "pushNotifications": false,
    "stateTransitionHistory": true
  },
  "provider": {
    "organization": "My Org",
    "url": "https://example.com"
  }
}
```

#### Tasks

Tasks represent work items with a defined lifecycle:

```
SUBMITTED → WORKING → COMPLETED
                   ↘ FAILED
                   ↘ CANCELLED
```

**Task States:**
- `SUBMITTED` - Task received, queued for processing
- `WORKING` - Agent is processing the task
- `INPUT_REQUIRED` - Agent needs more input
- `COMPLETED` - Task finished successfully
- `FAILED` - Task failed with error
- `CANCELLED` - Task cancelled by user
- `REJECTED` - Task rejected by agent
- `AUTH_REQUIRED` - Authentication needed

#### Messages

Messages contain parts (text, files, or data):

```typescript
const message = {
  role: 'user',
  parts: [
    { type: 'text', text: 'Hello!' },
    { type: 'file', file: { name: 'doc.pdf', mimeType: 'application/pdf', data: '...' } },
  ],
};
```

### JSON-RPC Methods

| Method | Description |
|--------|-------------|
| `message/send` | Send a message to the agent |
| `tasks/get` | Get task by ID |
| `tasks/list` | List all tasks |
| `tasks/cancel` | Cancel a running task |
| `tasks/subscribe` | Subscribe to task updates (SSE) |

### Client Usage

```typescript
import { A2AClient } from 'nanda-ts';

const client = new A2AClient({
  agentUrl: 'http://localhost:3000',
});

// Discover agent
const card = await client.discover();

// Send message
const task = await client.sendMessage({
  message: {
    role: 'user',
    parts: [{ type: 'text', text: 'Hello!' }],
  },
});

// Check task status
const status = await client.get(task.id);

// Stream responses
const stream = await client.sendMessageStream({
  message: {
    role: 'user',
    parts: [{ type: 'text', text: 'Tell me a story' }],
  },
});

for await (const event of stream) {
  if (event.type === 'message') {
    console.log(event.message);
  }
}
```

### Server Usage

```typescript
import { AgentServer } from 'nanda-ts';

const server = new AgentServer({
  name: 'my-agent',
  description: 'My A2A agent',
  skills: [{
    id: 'chat',
    name: 'Chat',
    description: 'General conversation',
    inputModes: ['text'],
    outputModes: ['text'],
  }],
});

server.onMessage(async (params, ctx) => {
  const userText = params.message.parts
    .filter(p => p.type === 'text')
    .map(p => p.text)
    .join(' ');

  const task = ctx.createTask({
    role: 'agent',
    parts: [{ type: 'text', text: `You said: ${userText}` }],
  }, params.contextId);

  ctx.updateTaskState(task.id, 'COMPLETED');
  return { ...task, state: 'COMPLETED' };
});

await server.start();
```

### Streaming

A2A supports streaming via Server-Sent Events (SSE):

```typescript
// Server-side streaming
server.onMessage(async (params, ctx) => {
  const task = ctx.createTask({
    role: 'agent',
    parts: [],
  }, params.contextId);

  // Stream updates
  ctx.updateTaskState(task.id, 'WORKING');

  for await (const chunk of generateResponse()) {
    ctx.appendToPart(task.id, 0, { type: 'text', text: chunk });
    ctx.emit(task.id, 'message', { part: chunk });
  }

  ctx.updateTaskState(task.id, 'COMPLETED');
  return task;
});
```

---

## MCP Protocol

The Model Context Protocol (MCP) is Anthropic's specification for integrating tools and resources with LLMs.

### Status

MCP Bridge is currently a stub implementation. The planned features include:

- Tool registration and execution
- Resource exposure
- Bidirectional protocol translation

### Planned Usage

```typescript
import { MCPBridge } from 'nanda-ts';

const bridge = new MCPBridge({
  // MCP server configuration
});

// Register tools
bridge.registerTool({
  name: 'search',
  description: 'Search the web',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
    },
    required: ['query'],
  },
  handler: async (input) => {
    // Perform search
    return results;
  },
});

// Expose as A2A agent
const server = bridge.toAgentServer();
await server.start();
```

---

## NLWeb Protocol

NLWeb is Microsoft's Natural Language Web interface, enabling natural language queries against web resources.

### Key Concepts

#### Schema.org Integration

NLWeb uses Schema.org format for structured data:

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Widget",
  "description": "A useful widget",
  "price": "19.99"
}
```

#### Discovery

NLWeb endpoints expose a manifest:

```json
{
  "name": "My NLWeb Service",
  "description": "Natural language interface",
  "endpoints": {
    "ask": "/api/ask",
    "askStream": "/api/ask/stream"
  },
  "supportedTypes": ["Product", "Article", "Event"]
}
```

### Client Usage

```typescript
import { NLWebClient } from 'nanda-ts';

const nlweb = new NLWebClient({
  baseUrl: 'https://example.com',
});

// Discover capabilities
const manifest = await nlweb.discover();

// Ask a question
const response = await nlweb.ask('What products do you have?');
console.log(response.items);

// Stream results
for await (const item of nlweb.askStream('Show me all articles')) {
  console.log(item['@type'], item.name);
}
```

### Response Format

```typescript
interface NLWebResponse {
  items: SchemaOrgItem[];
  totalCount?: number;
  nextPage?: string;
  metadata?: Record<string, unknown>;
}

interface SchemaOrgItem {
  '@context': string;
  '@type': string;
  [key: string]: unknown;
}
```

---

## Protocol Selection

### When to Use A2A

- Building autonomous agents
- Multi-agent orchestration
- Task-based workflows
- Streaming interactions

### When to Use MCP

- LLM tool integration
- Resource exposure to LLMs
- Claude/Anthropic ecosystem integration

### When to Use NLWeb

- Natural language queries
- Schema.org data sources
- Web content integration

---

## Protocol Interoperability

NANDA-TS enables bridging between protocols:

```typescript
import { A2AClient, NLWebClient, NandaClient } from 'nanda-ts';

const nanda = new NandaClient();

// Connect to any agent regardless of protocol
const agent = await nanda.connect('some-agent');

// The client handles protocol detection and translation
const response = await agent.send('Search for products');
```

### Protocol Detection

The unified client detects protocols via:

1. Agent Card presence (A2A)
2. NLWeb manifest (NLWeb)
3. MCP handshake (MCP)

### Translation

When bridging protocols, message formats are translated:

```
A2A Task ←→ MCP Tool Call ←→ NLWeb Query
```

---

## Error Handling

Each protocol has specific error types:

### A2A Errors

```typescript
import { JsonRpcError, TaskError } from 'nanda-ts';

try {
  await client.sendMessage(params);
} catch (error) {
  if (error instanceof JsonRpcError) {
    console.log('RPC Error:', error.code, error.message);
  } else if (error instanceof TaskError) {
    console.log('Task Error:', error.taskId, error.state);
  }
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| -32700 | Parse error |
| -32600 | Invalid request |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32603 | Internal error |
| -32000 | Task not found |
| -32001 | Task cancelled |
| -32002 | Authentication required |
