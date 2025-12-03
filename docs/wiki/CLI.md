# CLI

NANDA-TS includes a command-line interface for common operations.

## Installation

The CLI is included with the SDK:

```bash
bun add nanda-ts
```

Run commands using:

```bash
bunx nanda-ts <command>
```

Or install globally:

```bash
bun add -g nanda-ts
nanda-ts <command>
```

---

## Commands

### init

Create a new agent project.

```bash
bunx nanda-ts init <project-name> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--template <name>` | Template to use (default: basic) |
| `--port <number>` | Default port (default: 3000) |
| `--no-git` | Skip git initialization |

**Examples:**

```bash
# Create basic agent
bunx nanda-ts init my-agent

# Create with custom port
bunx nanda-ts init my-agent --port 8080

# Create without git
bunx nanda-ts init my-agent --no-git
```

**Generated Structure:**

```
my-agent/
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

---

### dev

Run agent in development mode with hot reload.

```bash
bunx nanda-ts dev [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--port <number>` | Port to listen on |
| `--entry <file>` | Entry file (default: src/index.ts) |

**Examples:**

```bash
# Run with defaults
bunx nanda-ts dev

# Custom port
bunx nanda-ts dev --port 8080

# Custom entry
bunx nanda-ts dev --entry src/server.ts
```

---

### register

Register your agent with the NANDA registry.

```bash
bunx nanda-ts register <handle> <facts-url> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--registry <url>` | Registry URL |
| `--api-key <key>` | API key (or use NANDA_API_KEY env) |

**Examples:**

```bash
# Basic registration
bunx nanda-ts register my-agent https://example.com/facts.json

# With API key
bunx nanda-ts register my-agent https://example.com/facts.json --api-key sk-xxx

# Custom registry
bunx nanda-ts register my-agent https://example.com/facts.json \
  --registry https://custom-registry.example.com
```

---

### resolve

Resolve an agent by handle.

```bash
bunx nanda-ts resolve <handle> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--registry <url>` | Registry URL |
| `--json` | Output as JSON |
| `--full` | Include full agent card |

**Examples:**

```bash
# Basic resolve
bunx nanda-ts resolve my-agent

# JSON output
bunx nanda-ts resolve my-agent --json

# Full details
bunx nanda-ts resolve my-agent --full
```

**Output:**

```
Agent: my-agent
Name: My Agent
Description: A helpful agent
URL: https://agent.example.com
Version: 1.0.0
Capabilities: chat, translate
```

---

### search

Search for agents in the registry.

```bash
bunx nanda-ts search <query> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--capabilities <list>` | Filter by capabilities (comma-separated) |
| `--protocols <list>` | Filter by protocols |
| `--limit <number>` | Max results (default: 10) |
| `--json` | Output as JSON |

**Examples:**

```bash
# Basic search
bunx nanda-ts search translation

# With filters
bunx nanda-ts search language --capabilities translate,summarize

# JSON output
bunx nanda-ts search ai --limit 5 --json
```

**Output:**

```
Found 3 agents:

1. translation-bot
   Description: AI-powered translation
   Capabilities: translate, language-detection

2. lang-helper
   Description: Language assistant
   Capabilities: translate, grammar-check

3. polyglot-agent
   Description: Multilingual agent
   Capabilities: translate, transcribe
```

---

### call

Send a message to an agent.

```bash
bunx nanda-ts call <agent> <message> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--stream` | Stream the response |
| `--timeout <ms>` | Request timeout |
| `--json` | Output as JSON |

**Examples:**

```bash
# Direct call by URL
bunx nanda-ts call http://localhost:3000 "Hello!"

# Call by handle
bunx nanda-ts call my-agent "Translate 'hello' to Spanish"

# Stream response
bunx nanda-ts call my-agent "Tell me a story" --stream

# With timeout
bunx nanda-ts call my-agent "Complex task" --timeout 60000
```

---

### discover

Fetch and display an agent's card.

```bash
bunx nanda-ts discover <agent-url> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

**Examples:**

```bash
# Discover agent
bunx nanda-ts discover http://localhost:3000

# JSON output
bunx nanda-ts discover http://localhost:3000 --json
```

**Output:**

```
Agent Card: my-agent
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Name:        My Agent
Description: A helpful agent
Version:     1.0.0
URL:         http://localhost:3000

Skills:
  • chat
    General conversation
    Input: text | Output: text

Capabilities:
  ✓ Streaming
  ✗ Push Notifications
  ✓ State History

Provider:
  Organization: My Org
  URL: https://example.com
```

---

### identity

Manage agent identity.

```bash
bunx nanda-ts identity <subcommand> [options]
```

**Subcommands:**

#### generate

Generate a new identity:

```bash
bunx nanda-ts identity generate [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--output <file>` | Save to file |
| `--format <type>` | Output format (json, env) |

**Examples:**

```bash
# Generate and display
bunx nanda-ts identity generate

# Save to file
bunx nanda-ts identity generate --output .identity.json

# As environment variables
bunx nanda-ts identity generate --format env >> .env
```

**Output:**

```
Generated new agent identity:

DID: did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK

Public Key (hex):
  8a7e9f2d...

⚠️  Keep your private key secure!
```

#### show

Show identity details:

```bash
bunx nanda-ts identity show [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--input <file>` | Read from file |

---

### facts

Work with AgentFacts.

```bash
bunx nanda-ts facts <subcommand> [options]
```

**Subcommands:**

#### generate

Generate an AgentFacts template:

```bash
bunx nanda-ts facts generate [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--output <file>` | Output file |
| `--name <name>` | Agent name |
| `--description <desc>` | Agent description |

**Example:**

```bash
bunx nanda-ts facts generate \
  --name "My Agent" \
  --description "A helpful agent" \
  --output agent-facts.json
```

#### validate

Validate an AgentFacts document:

```bash
bunx nanda-ts facts validate <file>
```

**Example:**

```bash
bunx nanda-ts facts validate agent-facts.json
```

#### sign

Sign AgentFacts with identity:

```bash
bunx nanda-ts facts sign <facts-file> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--identity <file>` | Identity file |
| `--output <file>` | Output file |

---

## Environment Variables

The CLI respects these environment variables:

| Variable | Description |
|----------|-------------|
| `NANDA_REGISTRY_URL` | Default registry URL |
| `NANDA_API_KEY` | Registry API key |
| `NANDA_CACHE_ENABLED` | Enable caching (true/false) |
| `NANDA_TIMEOUT` | Default request timeout |

**Example .env:**

```bash
NANDA_REGISTRY_URL=https://registry.nanda.ai
NANDA_API_KEY=sk-xxxxxxxxxxxxx
NANDA_CACHE_ENABLED=true
NANDA_TIMEOUT=30000
```

---

## Configuration File

You can create a `nanda.config.ts` or `nanda.config.json`:

```typescript
// nanda.config.ts
export default {
  name: 'my-agent',
  description: 'My agent',
  port: 3000,
  registry: {
    url: 'https://registry.nanda.ai',
    apiKey: process.env.NANDA_API_KEY,
  },
  identity: {
    path: './.identity.json',
  },
};
```

---

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Connection error |
| 4 | Authentication error |
| 5 | Not found |

---

## Tips

### Scripting

```bash
# Get agent URL as variable
AGENT_URL=$(bunx nanda-ts resolve my-agent --json | jq -r '.url')

# Call and process response
bunx nanda-ts call $AGENT_URL "Hello" --json | jq '.message.parts[0].text'
```

### Aliases

Add to your shell profile:

```bash
alias nts='bunx nanda-ts'
alias nts-dev='bunx nanda-ts dev'
alias nts-call='bunx nanda-ts call'
```

### Debugging

```bash
# Enable verbose output
DEBUG=nanda:* bunx nanda-ts call my-agent "Hello"

# Show request/response details
bunx nanda-ts call my-agent "Hello" --verbose
```
