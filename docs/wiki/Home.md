# NANDA-TS

**A Bun-native TypeScript SDK for the NANDA (Networked Autonomous Decentralized Agents) ecosystem**

NANDA-TS provides a unified interface for building and connecting autonomous AI agents that communicate across different protocols and platforms.

## What is NANDA-TS?

NANDA-TS is a zero-dependency SDK built entirely on Bun-native APIs that enables:

- **Multi-Protocol Agent Communication** - A single SDK to handle A2A, MCP, and NLWeb protocols
- **Agent Discovery & Registration** - Register and discover agents through the NANDA registry
- **DID-Based Identity** - Decentralized identifier support for trustless agent communication
- **Interoperability** - Bridge between different AI agent ecosystems

## Supported Protocols

| Protocol | Description | Status |
|----------|-------------|--------|
| **A2A** | Google's Agent-to-Agent Protocol v0.3.0 | Full Implementation |
| **MCP** | Anthropic's Model Context Protocol | Bridge (Stub) |
| **NLWeb** | Microsoft's Natural Language Web | Client Implementation |

## Quick Links

- [[Getting Started]] - Installation and first steps
- [[Architecture]] - System design and components
- [[API Reference]] - Complete API documentation
- [[Protocols]] - Protocol specifications and usage
- [[Registry]] - Agent discovery and registration
- [[Agent Identity]] - DID and cryptography
- [[Examples]] - Code examples and tutorials
- [[CLI]] - Command-line interface
- [[Contributing]] - How to contribute

## Installation

```bash
bun add nanda-ts
```

**Requirements:** Bun >= 1.1.0

## Quick Example

### Create an Agent Server

```typescript
import { AgentServer } from 'nanda-ts';

const server = new AgentServer({
  name: 'my-agent',
  description: 'A helpful AI agent',
  skills: [{
    id: 'chat',
    name: 'Chat',
    description: 'General conversation',
    inputModes: ['text'],
    outputModes: ['text'],
  }],
});

server.onMessage(async (params, ctx) => {
  const task = ctx.createTask({
    role: 'agent',
    parts: [{ type: 'text', text: 'Hello! How can I help?' }],
  }, params.contextId);
  ctx.updateTaskState(task.id, 'COMPLETED');
  return { ...task, state: 'COMPLETED' };
});

await server.start();
console.log('Agent running at http://localhost:3000');
```

### Connect to an Agent

```typescript
import { A2AClient } from 'nanda-ts';

const client = new A2AClient({ agentUrl: 'http://localhost:3000' });

const card = await client.discover();
console.log(`Connected to: ${card.name}`);

const task = await client.sendMessage({
  message: {
    role: 'user',
    parts: [{ type: 'text', text: 'Hello!' }],
  },
});

console.log(`Response: ${task.message?.parts[0].text}`);
```

## Key Features

- **Bun Native** - Uses `Bun.serve()`, `bun:sqlite`, and native Web APIs
- **Zero Dependencies** - No external packages required
- **TypeScript First** - Fully typed with comprehensive type definitions
- **Ed25519 Cryptography** - Secure agent identity and signing
- **JSON-RPC 2.0** - Standard RPC protocol support
- **Server-Sent Events** - Real-time streaming responses
- **SQLite Caching** - Built-in cache for registry data
- **K8s Health Probes** - Production-ready health endpoints

## License

MIT
