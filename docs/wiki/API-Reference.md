# API Reference

Complete API documentation for NANDA-TS.

## Table of Contents

- [AgentServer](#agentserver)
- [A2AClient](#a2aclient)
- [NandaClient](#nandaclient)
- [IndexClient](#indexclient)
- [NLWebClient](#nlwebclient)
- [AgentIdentity](#agentidentity)
- [AgentFacts](#agentfacts)
- [Cryptography](#cryptography)
- [Types](#types)

---

## AgentServer

The main server class for hosting A2A-compliant agents.

### Constructor

```typescript
new AgentServer(config: AgentServerConfig)
```

**AgentServerConfig:**

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `name` | `string` | Yes | - | Agent name |
| `description` | `string` | Yes | - | Agent description |
| `version` | `string` | No | `'1.0.0'` | Semantic version |
| `port` | `number` | No | `3000` | HTTP port |
| `hostname` | `string` | No | `'0.0.0.0'` | Bind address |
| `skills` | `Skill[]` | No | `[]` | Agent capabilities |
| `capabilities` | `Capabilities` | No | `{}` | Server capabilities |
| `provider` | `Provider` | No | `{}` | Organization info |

### Methods

#### `onMessage(handler)`

Register a handler for incoming messages.

```typescript
server.onMessage(async (params: SendMessageParams, ctx: TaskContext) => {
  // Handle message
  return task;
});
```

**Parameters:**
- `params.message` - The incoming message
- `params.contextId` - Optional context ID
- `params.metadata` - Optional metadata

**TaskContext:**
- `createTask(message, contextId?)` - Create a new task
- `updateTaskState(taskId, state)` - Update task state
- `addArtifact(taskId, artifact)` - Add artifact to task
- `getTask(taskId)` - Get task by ID

#### `start()`

Start the server.

```typescript
await server.start();
```

**Returns:** `Promise<void>`

#### `stop()`

Stop the server.

```typescript
await server.stop();
```

**Returns:** `Promise<void>`

#### `isRunning()`

Check if server is running.

```typescript
const running = server.isRunning();
```

**Returns:** `boolean`

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/agent.json` | GET | Agent Card |
| `/rpc` | POST | JSON-RPC endpoint |
| `/rpc/stream` | POST | Streaming endpoint |
| `/health` | GET | Detailed health |
| `/healthz` | GET | Liveness probe |
| `/readyz` | GET | Readiness probe |

---

## A2AClient

Client for communicating with A2A-compliant agents.

### Constructor

```typescript
new A2AClient(config: A2AClientConfig)
```

**A2AClientConfig:**

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `agentUrl` | `string` | Yes | - | Agent base URL |
| `timeout` | `number` | No | `30000` | Request timeout (ms) |
| `headers` | `Record<string, string>` | No | `{}` | Additional headers |

### Methods

#### `discover()`

Fetch the agent's Agent Card.

```typescript
const card = await client.discover();
```

**Returns:** `Promise<AgentCard>`

#### `sendMessage(params)`

Send a message to the agent.

```typescript
const task = await client.sendMessage({
  message: {
    role: 'user',
    parts: [{ type: 'text', text: 'Hello!' }],
  },
  contextId: 'optional-context-id',
});
```

**Returns:** `Promise<Task>`

#### `sendMessageStream(params)`

Send a message and receive streaming response.

```typescript
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

**Returns:** `Promise<AsyncIterable<StreamEvent>>`

#### `get(taskId)`

Get task by ID.

```typescript
const task = await client.get('task-id');
```

**Returns:** `Promise<Task>`

#### `listTasks(params?)`

List all tasks.

```typescript
const { tasks } = await client.listTasks({
  contextId: 'optional-filter',
});
```

**Returns:** `Promise<{ tasks: Task[] }>`

#### `cancelTask(params)`

Cancel a task.

```typescript
const cancelled = await client.cancelTask({
  taskId: 'task-id',
});
```

**Returns:** `Promise<Task>`

---

## NandaClient

Unified high-level client for the NANDA ecosystem.

### Constructor

```typescript
new NandaClient(config?: NandaClientConfig)
```

**NandaClientConfig:**

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `registryUrl` | `string` | No | See env | NANDA registry URL |
| `apiKey` | `string` | No | - | Registry API key |
| `cacheEnabled` | `boolean` | No | `true` | Enable caching |
| `timeout` | `number` | No | `30000` | Request timeout |
| `additionalRegistries` | `Registry[]` | No | `[]` | Additional registries |

### Methods

#### `connect(identifier)`

Connect to an agent by handle, URL, or DID.

```typescript
// By handle
const agent = await client.connect('my-agent');

// By URL
const agent = await client.connect('http://localhost:3000');

// By DID
const agent = await client.connect('did:key:z6Mk...');
```

**Returns:** `Promise<AgentConnection>`

#### `resolve(handle)`

Resolve agent metadata by handle.

```typescript
const metadata = await client.resolve('my-agent');
```

**Returns:** `Promise<AgentMetadata>`

#### `search(params)`

Search the registry for agents.

```typescript
const agents = await client.search({
  query: 'translation',
  capabilities: ['translate'],
  protocols: ['a2a'],
});
```

**Returns:** `Promise<Agent[]>`

#### `register(handle, factsUrl)`

Register an agent with the registry.

```typescript
await client.register('my-agent', 'https://example.com/facts.json');
```

**Returns:** `Promise<void>`

---

## IndexClient

Low-level NANDA registry client.

### Factory Function

```typescript
const registry = createIndexClient(config?: IndexClientConfig);
```

### Methods

#### `resolve(handle)`

Resolve an agent by handle.

```typescript
const agent = await registry.resolve('my-agent');
```

**Returns:** `Promise<ResolvedAgent>`

#### `search(params)`

Search for agents.

```typescript
const results = await registry.search({
  query: 'translation',
  capabilities: ['translate'],
  protocols: ['a2a'],
  limit: 10,
  offset: 0,
});
```

**Returns:** `Promise<SearchResult[]>`

#### `register(params)`

Register an agent.

```typescript
await registry.register({
  handle: 'my-agent',
  factsUrl: 'https://example.com/facts.json',
});
```

**Returns:** `Promise<RegisterResponse>`

---

## NLWebClient

Client for Microsoft's Natural Language Web interface.

### Constructor

```typescript
new NLWebClient(config: NLWebClientConfig)
```

### Methods

#### `discover()`

Discover NLWeb capabilities.

```typescript
const manifest = await nlweb.discover();
```

**Returns:** `Promise<NLWebManifest>`

#### `ask(question)`

Ask a natural language question.

```typescript
const response = await nlweb.ask('What products do you have?');
```

**Returns:** `Promise<NLWebResponse>`

#### `askStream(question)`

Stream the response to a question.

```typescript
for await (const item of nlweb.askStream('Show me all items')) {
  console.log(item);
}
```

**Returns:** `AsyncIterable<SchemaOrgItem>`

---

## AgentIdentity

DID-based agent identity management.

### Constructor

```typescript
const identity = await AgentIdentity.create();
// or
const identity = AgentIdentity.fromKeyPair(publicKey, privateKey);
```

### Methods

#### `getDid()`

Get the agent's DID.

```typescript
const did = identity.getDid();
// did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK
```

**Returns:** `string`

#### `sign(data)`

Sign arbitrary data.

```typescript
const signature = await identity.sign(data);
```

**Returns:** `Promise<Uint8Array>`

#### `signJson(object)`

Sign a JSON object.

```typescript
const signed = await identity.signJson({ message: 'hello' });
```

**Returns:** `Promise<SignedObject>`

#### `verify(data, signature)`

Verify a signature.

```typescript
const valid = await identity.verify(data, signature);
```

**Returns:** `Promise<boolean>`

#### `getPublicKey()`

Export the public key.

```typescript
const publicKey = identity.getPublicKey();
```

**Returns:** `Uint8Array`

---

## AgentFacts

Builder for agent metadata.

### Usage

```typescript
const facts = new AgentFacts()
  .setName('My Agent')
  .setDescription('A helpful agent')
  .setVersion('1.0.0')
  .setProvider({
    organization: 'My Org',
    url: 'https://example.com',
  })
  .addCapability('translation')
  .addCapability('summarization')
  .setClassification({
    category: 'utility',
    subcategory: 'language',
  })
  .build();
```

### Methods

| Method | Description |
|--------|-------------|
| `setName(name)` | Set agent name |
| `setDescription(desc)` | Set description |
| `setVersion(version)` | Set version |
| `setProvider(provider)` | Set provider info |
| `addCapability(cap)` | Add a capability |
| `setClassification(class)` | Set classification |
| `setCompliance(compliance)` | Set compliance info |
| `setSupplyChain(chain)` | Set supply chain |
| `build()` | Build the facts object |

---

## Cryptography

Low-level cryptographic utilities.

### Key Generation

```typescript
import { generateKeyPair, publicKeyToDid } from 'nanda-ts/crypto';

const { publicKey, privateKey } = await generateKeyPair();
const did = publicKeyToDid(publicKey);
```

### Signing

```typescript
import { signMessage, verifySignature } from 'nanda-ts/crypto';

const signature = await signMessage(message, privateKey);
const valid = await verifySignature(message, signature, publicKey);
```

### Encoding

```typescript
import { encodeBase58btc, decodeBase58btc } from 'nanda-ts/crypto';

const encoded = encodeBase58btc(bytes);
const decoded = decodeBase58btc(encoded);
```

---

## Types

### Task

```typescript
interface Task {
  id: string;
  contextId?: string;
  state: TaskState;
  message?: Message;
  artifacts?: Artifact[];
  history?: TaskEvent[];
  metadata?: Record<string, unknown>;
}

type TaskState =
  | 'SUBMITTED'
  | 'WORKING'
  | 'INPUT_REQUIRED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'AUTH_REQUIRED';
```

### Message

```typescript
interface Message {
  role: 'user' | 'agent';
  parts: Part[];
  metadata?: Record<string, unknown>;
}

type Part =
  | { type: 'text'; text: string }
  | { type: 'file'; file: FileData }
  | { type: 'data'; data: unknown };
```

### Skill

```typescript
interface Skill {
  id: string;
  name: string;
  description: string;
  inputModes: string[];
  outputModes: string[];
  parameters?: ParameterSchema;
}
```

### AgentCard

```typescript
interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  skills: Skill[];
  capabilities?: {
    streaming?: boolean;
    pushNotifications?: boolean;
    stateTransitionHistory?: boolean;
  };
  provider?: {
    organization?: string;
    url?: string;
  };
  documentationUrl?: string;
  iconUrl?: string;
}
```

### Error Types

```typescript
type NandaError =
  | JsonRpcError
  | AuthenticationError
  | DiscoveryError
  | TimeoutError
  | TaskError
  | RegistryError
  | ConnectionError
  | ValidationError;
```
