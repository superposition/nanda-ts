# Registry

The NANDA Registry enables agent discovery, registration, and resolution across the ecosystem.

## Overview

The registry provides:
- **Agent Registration** - Register your agent with a unique handle
- **Agent Resolution** - Look up agents by handle, URL, or DID
- **Agent Search** - Find agents by capabilities, protocols, or keywords
- **Caching** - SQLite-backed caching for fast resolution

## Quick Start

```typescript
import { createIndexClient } from 'nanda-ts';

const registry = createIndexClient();

// Resolve an agent
const agent = await registry.resolve('my-agent');

// Search for agents
const results = await registry.search({ query: 'translation' });

// Register your agent
await registry.register({
  handle: 'my-agent',
  factsUrl: 'https://example.com/facts.json',
});
```

---

## IndexClient

The main interface to the NANDA registry.

### Configuration

```typescript
import { createIndexClient } from 'nanda-ts';

const registry = createIndexClient({
  baseUrl: 'https://registry.nanda.ai',  // Registry URL
  apiKey: 'your-api-key',                 // Optional API key
  cacheEnabled: true,                     // Enable caching
  cacheTtl: 300,                          // Cache TTL in seconds
});
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NANDA_REGISTRY_URL` | Registry base URL | https://registry.nanda.ai |
| `NANDA_API_KEY` | Registry API key | - |
| `NANDA_CACHE_TTL` | Cache TTL (seconds) | 300 |
| `NANDA_CACHE_ENABLED` | Enable caching | true |

---

## Registration

### Basic Registration

```typescript
await registry.register({
  handle: 'my-agent',
  factsUrl: 'https://example.com/facts.json',
});
```

### With Metadata

```typescript
await registry.register({
  handle: 'my-agent',
  factsUrl: 'https://example.com/facts.json',
  metadata: {
    category: 'utility',
    tags: ['translation', 'language'],
  },
});
```

### AgentFacts Document

Your `factsUrl` should point to a valid AgentFacts document:

```json
{
  "name": "My Agent",
  "description": "A helpful translation agent",
  "version": "1.0.0",
  "provider": {
    "organization": "My Org",
    "url": "https://example.com"
  },
  "capabilities": ["translation", "summarization"],
  "protocols": ["a2a"],
  "classification": {
    "category": "utility",
    "subcategory": "language"
  },
  "endpoints": {
    "a2a": "https://agent.example.com"
  }
}
```

---

## Resolution

### By Handle

```typescript
const agent = await registry.resolve('my-agent');
console.log(agent.name, agent.url);
```

### Resolution Result

```typescript
interface ResolvedAgent {
  handle: string;
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: string[];
  protocols: string[];
  provider?: {
    organization?: string;
    url?: string;
  };
  factsUrl: string;
  agentCard?: AgentCard;
}
```

### With Full Agent Card

```typescript
const agent = await registry.resolve('my-agent', {
  includeAgentCard: true,
});

console.log(agent.agentCard.skills);
```

---

## Search

### Basic Search

```typescript
const results = await registry.search({
  query: 'translation',
});

for (const agent of results) {
  console.log(`${agent.handle}: ${agent.description}`);
}
```

### Filtered Search

```typescript
const results = await registry.search({
  query: 'language',
  capabilities: ['translation', 'summarization'],
  protocols: ['a2a'],
  category: 'utility',
  limit: 10,
  offset: 0,
});
```

### Search Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | `string` | Free-text search query |
| `capabilities` | `string[]` | Required capabilities |
| `protocols` | `string[]` | Required protocols |
| `category` | `string` | Category filter |
| `tags` | `string[]` | Tag filter |
| `limit` | `number` | Max results (default: 20) |
| `offset` | `number` | Pagination offset |

---

## QuiltResolver

For federated multi-registry resolution.

### Configuration

```typescript
import { QuiltResolver } from 'nanda-ts';

const resolver = new QuiltResolver({
  registries: [
    { baseUrl: 'https://registry.nanda.ai' },
    { baseUrl: 'https://registry.example.com', apiKey: 'key' },
  ],
  strategy: 'first-match',  // or 'all', 'priority'
});
```

### Usage

```typescript
// Resolve across all registries
const agent = await resolver.resolve('my-agent');

// Search across all registries
const results = await resolver.search({ query: 'translation' });
```

### Resolution Strategies

| Strategy | Description |
|----------|-------------|
| `first-match` | Return first successful resolution |
| `all` | Query all registries, merge results |
| `priority` | Query in order, stop on first match |

---

## Caching

NANDA-TS includes SQLite-backed caching for registry operations.

### Cache Configuration

```typescript
const registry = createIndexClient({
  cacheEnabled: true,
  cacheTtl: 300,  // 5 minutes
  cachePath: './cache.db',  // Optional custom path
});
```

### Cache Operations

```typescript
// Clear cache
await registry.clearCache();

// Invalidate specific entry
await registry.invalidate('my-agent');

// Get cache stats
const stats = await registry.getCacheStats();
console.log(`Entries: ${stats.entries}, Size: ${stats.size}`);
```

### Cache Behavior

- **Resolution** - Cached for TTL duration
- **Search** - Not cached (always fresh)
- **Registration** - Invalidates related cache entries

---

## Agent Handles

### Handle Format

Handles follow a specific format:
- Lowercase alphanumeric
- Hyphens allowed
- 3-64 characters
- Unique across registry

**Valid:**
- `my-agent`
- `translation-bot-v2`
- `company-support`

**Invalid:**
- `My_Agent` (uppercase, underscore)
- `a` (too short)
- `agent@company` (special character)

### Handle Resolution Flow

```
Handle → Registry → AgentAddr → AgentCard → AgentFacts
                      ↓
                   Agent URL
```

---

## Error Handling

### Common Errors

```typescript
import { RegistryError, NotFoundError, ValidationError } from 'nanda-ts';

try {
  await registry.resolve('unknown-agent');
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log('Agent not found');
  } else if (error instanceof ValidationError) {
    console.log('Invalid handle format');
  } else if (error instanceof RegistryError) {
    console.log('Registry error:', error.message);
  }
}
```

### Error Types

| Error | Description |
|-------|-------------|
| `NotFoundError` | Agent not found |
| `ValidationError` | Invalid input format |
| `AuthenticationError` | Invalid or missing API key |
| `RateLimitError` | Too many requests |
| `RegistryError` | General registry error |

---

## Best Practices

### 1. Cache Appropriately

```typescript
// Enable caching for production
const registry = createIndexClient({
  cacheEnabled: process.env.NODE_ENV === 'production',
  cacheTtl: 300,
});
```

### 2. Handle Errors Gracefully

```typescript
async function findAgent(handle: string) {
  try {
    return await registry.resolve(handle);
  } catch (error) {
    if (error instanceof NotFoundError) {
      // Try alternative resolution
      return await registry.search({ query: handle });
    }
    throw error;
  }
}
```

### 3. Use Environment Variables

```bash
export NANDA_REGISTRY_URL=https://registry.nanda.ai
export NANDA_API_KEY=your-api-key
export NANDA_CACHE_TTL=300
```

### 4. Validate Before Registration

```typescript
import { validateHandle, validateFactsUrl } from 'nanda-ts';

const handle = 'my-agent';
const factsUrl = 'https://example.com/facts.json';

if (!validateHandle(handle)) {
  throw new Error('Invalid handle format');
}

if (!validateFactsUrl(factsUrl)) {
  throw new Error('Invalid facts URL');
}

await registry.register({ handle, factsUrl });
```

---

## Registry API

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/resolve/:handle` | Resolve agent by handle |
| GET | `/search` | Search for agents |
| POST | `/register` | Register an agent |
| DELETE | `/unregister/:handle` | Unregister an agent |

### Rate Limits

| Operation | Limit |
|-----------|-------|
| Resolve | 100/minute |
| Search | 30/minute |
| Register | 10/minute |

Rate limits are per API key. Unauthenticated requests have stricter limits.
