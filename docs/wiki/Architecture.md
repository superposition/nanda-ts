# Architecture

NANDA-TS is designed as a modular, layered SDK that provides flexibility while maintaining simplicity.

## Overview Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        NANDA-TS SDK                             │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Client Layer  │   Server Layer  │      Registry Layer         │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ NandaClient     │ AgentServer     │ IndexClient                 │
│ AgentConnection │ A2AHandler      │ QuiltResolver               │
│                 │ HealthCheck     │ RegistryCache               │
├─────────────────┴─────────────────┴─────────────────────────────┤
│                        Protocol Layer                           │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   A2A Client    │   MCP Bridge    │      NLWeb Client           │
├─────────────────┴─────────────────┴─────────────────────────────┤
│                        Core Layer                               │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ Agent Identity  │   AgentFacts    │      Cryptography           │
│   (DID)         │   (Metadata)    │   (Ed25519 Keys)            │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

## Layer Descriptions

### 1. Client Layer

The client layer provides high-level APIs for interacting with agents.

**NandaClient**
- Unified API for the entire NANDA ecosystem
- Combines registry lookup with agent communication
- Supports multiple connection methods (handle, URL, DID)

**AgentConnection**
- Wrapper around A2AClient
- Provides convenience methods for common operations
- Manages connection state

### 2. Server Layer

The server layer handles hosting A2A-compliant agents.

**AgentServer**
- Bun-native HTTP server using `Bun.serve()`
- Automatic Agent Card generation
- JSON-RPC endpoint handling
- Health check endpoints for Kubernetes

**A2AHandler**
- Processes incoming JSON-RPC requests
- Manages task state machine
- Routes methods to registered handlers

**HealthCheck**
- Liveness probe (`/healthz`)
- Readiness probe (`/readyz`)
- Custom health check support

### 3. Registry Layer

The registry layer enables agent discovery and registration.

**IndexClient**
- Main interface to NANDA registry
- Registration, resolution, and search operations
- API key authentication

**QuiltResolver**
- Multi-registry resolution
- Federated agent discovery
- Combines AgentAddr, AgentCard, and AgentFacts

**RegistryCache**
- SQLite-backed caching
- Configurable TTL (default: 5 minutes)
- Reduces registry load

### 4. Protocol Layer

The protocol layer implements specific agent communication protocols.

**A2A Client**
- Full Google A2A v0.3.0 implementation
- Agent discovery via `.well-known/agent.json`
- JSON-RPC 2.0 messaging
- SSE streaming support

**MCP Bridge**
- Protocol bridge for Anthropic's MCP
- Tool registration and execution (planned)
- Resource exposure (planned)

**NLWeb Client**
- Microsoft NLWeb interface
- Schema.org format support
- Natural language querying

### 5. Core Layer

The core layer provides foundational capabilities.

**Agent Identity**
- DID-based identity (`did:key` format)
- Ed25519 key pair management
- JSON signing and verification

**AgentFacts**
- Builder pattern for agent metadata
- Supports NANDA specification
- Classification and capabilities

**Cryptography**
- Ed25519 key generation
- Base58btc encoding
- Detached signatures

## Data Flow

### Agent Discovery Flow

```
Client                    Registry                  Agent Server
  │                          │                           │
  │── resolve(handle) ──────>│                           │
  │<── Agent URL ───────────│                           │
  │                          │                           │
  │── GET /.well-known/agent.json ─────────────────────>│
  │<── Agent Card ──────────────────────────────────────│
  │                          │                           │
```

### Message Flow

```
Client                                            Agent Server
  │                                                     │
  │── POST /rpc {method: "message/send"} ─────────────>│
  │<── Task {id, state: "SUBMITTED"} ─────────────────│
  │                                                     │
  │                    [Agent processes message]        │
  │                                                     │
  │── POST /rpc {method: "tasks/get", taskId} ────────>│
  │<── Task {id, state: "COMPLETED", message} ────────│
  │                                                     │
```

### Streaming Flow

```
Client                                            Agent Server
  │                                                     │
  │── POST /rpc/stream {method: "message/send"} ──────>│
  │<── SSE: event: task ──────────────────────────────│
  │<── SSE: event: message ───────────────────────────│
  │<── SSE: event: message ───────────────────────────│
  │<── SSE: event: task (COMPLETED) ──────────────────│
  │                                                     │
```

## Project Structure

```
nanda-ts/
├── src/
│   ├── index.ts                 # Main exports
│   │
│   ├── protocols/
│   │   ├── a2a/
│   │   │   ├── A2AClient.ts     # A2A protocol client
│   │   │   ├── AgentCard.ts     # Agent Card utilities
│   │   │   ├── streaming.ts     # SSE streaming
│   │   │   └── index.ts
│   │   ├── mcp/
│   │   │   ├── MCPBridge.ts     # MCP protocol bridge
│   │   │   └── index.ts
│   │   └── nlweb/
│   │       ├── NLWebClient.ts   # NLWeb client
│   │       └── index.ts
│   │
│   ├── server/
│   │   ├── AgentServer.ts       # Main server class
│   │   ├── A2AHandler.ts        # JSON-RPC handler
│   │   ├── HealthCheck.ts       # Health endpoints
│   │   └── index.ts
│   │
│   ├── registry/
│   │   ├── IndexClient.ts       # Registry client
│   │   ├── QuiltResolver.ts     # Multi-registry resolver
│   │   ├── cache.ts             # SQLite cache
│   │   └── index.ts
│   │
│   ├── agent/
│   │   ├── Identity.ts          # DID identity
│   │   ├── AgentFacts.ts        # Agent metadata
│   │   └── index.ts
│   │
│   ├── crypto/
│   │   ├── keys.ts              # Key generation
│   │   ├── signatures.ts        # Signing utilities
│   │   └── index.ts
│   │
│   ├── client/
│   │   ├── NandaClient.ts       # Unified client
│   │   ├── AgentConnection.ts   # Connection wrapper
│   │   └── index.ts
│   │
│   └── types/
│       ├── index.ts             # Type exports
│       ├── protocol.ts          # A2A protocol types
│       ├── agent.ts             # Agent types
│       ├── registry.ts          # Registry types
│       └── errors.ts            # Error types
│
├── cli/
│   ├── index.ts                 # CLI entry point
│   ├── init.ts                  # Project initialization
│   ├── dev.ts                   # Development server
│   └── templates/
│       └── basic-agent.ts       # Agent template
│
├── examples/
│   ├── basic-server.ts
│   ├── basic-client.ts
│   └── streaming.ts
│
└── tests/
    ├── unit/
    └── integration/
```

## Design Principles

### 1. Zero Dependencies

NANDA-TS uses only Bun-native APIs:
- `Bun.serve()` for HTTP server
- `bun:sqlite` for caching
- Web Crypto API for cryptography
- Native fetch for HTTP clients

### 2. Protocol Agnostic

The SDK abstracts protocol differences:
- Unified client interface
- Protocol-specific implementations hidden
- Easy to add new protocols

### 3. Type Safety

Full TypeScript support:
- Comprehensive type definitions
- Generic interfaces
- Strict type checking

### 4. Composable

Use only what you need:
- Modular exports
- Independent layers
- Mix and match components

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NANDA_REGISTRY_URL` | Registry base URL | https://registry.nanda.ai |
| `NANDA_API_KEY` | Registry API key | - |
| `NANDA_CACHE_TTL` | Cache TTL in seconds | 300 |
| `NANDA_CACHE_ENABLED` | Enable caching | true |

### Server Configuration

```typescript
interface AgentServerConfig {
  name: string;
  description: string;
  version?: string;           // default: '1.0.0'
  port?: number;              // default: 3000
  hostname?: string;          // default: '0.0.0.0'
  skills?: Skill[];
  capabilities?: {
    streaming?: boolean;
    pushNotifications?: boolean;
    stateTransitionHistory?: boolean;
  };
  provider?: {
    organization?: string;
    url?: string;
  };
}
```

### Client Configuration

```typescript
interface NandaClientConfig {
  registryUrl?: string;
  apiKey?: string;
  cacheEnabled?: boolean;
  timeout?: number;
  additionalRegistries?: Array<{
    baseUrl: string;
    apiKey?: string;
  }>;
}
```
