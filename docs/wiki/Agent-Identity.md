# Agent Identity

NANDA-TS uses Decentralized Identifiers (DIDs) and Ed25519 cryptography for secure agent identity management.

## Overview

Agent identity in NANDA provides:
- **Unique Identification** - Every agent has a unique DID
- **Cryptographic Signing** - Sign messages and verify authenticity
- **Decentralized Trust** - No central authority required
- **Self-Sovereign Identity** - Agents control their own keys

---

## Decentralized Identifiers (DIDs)

### DID Format

NANDA uses the `did:key` method:

```
did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK
        └───────────────────────────────────────────────┘
                    Base58btc-encoded public key
```

### Creating a DID

```typescript
import { AgentIdentity } from 'nanda-ts';

// Generate new identity
const identity = await AgentIdentity.create();
const did = identity.getDid();
console.log(did);
// did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK
```

### DID Resolution

```typescript
// Extract public key from DID
import { didToPublicKey } from 'nanda-ts/crypto';

const publicKey = didToPublicKey(did);
```

---

## AgentIdentity Class

### Creating Identity

```typescript
import { AgentIdentity } from 'nanda-ts';

// Generate new identity
const identity = await AgentIdentity.create();

// From existing key pair
const identity = AgentIdentity.fromKeyPair(publicKey, privateKey);

// From private key only
const identity = AgentIdentity.fromPrivateKey(privateKey);
```

### Identity Methods

```typescript
// Get DID
const did = identity.getDid();

// Get public key
const publicKey = identity.getPublicKey();

// Check if identity has private key (can sign)
const canSign = identity.canSign();
```

### Persistence

```typescript
// Export for storage
const exported = identity.export();
// { publicKey: Uint8Array, privateKey?: Uint8Array }

// Store securely
await secureStorage.save('agent-identity', exported);

// Restore
const stored = await secureStorage.load('agent-identity');
const identity = AgentIdentity.fromKeyPair(stored.publicKey, stored.privateKey);
```

---

## Signing

### Sign Data

```typescript
// Sign arbitrary bytes
const data = new TextEncoder().encode('Hello, World!');
const signature = await identity.sign(data);
```

### Sign JSON

```typescript
// Sign a JSON object
const message = { action: 'transfer', amount: 100 };
const signed = await identity.signJson(message);

console.log(signed);
// {
//   payload: { action: 'transfer', amount: 100 },
//   signature: 'base64-signature...',
//   signer: 'did:key:z6Mk...'
// }
```

### Detached Signatures

```typescript
// Create detached signature (separate from data)
const signature = await identity.createDetachedSignature(data);

// Later verify with just signature and data
const valid = await identity.verifyDetached(data, signature);
```

---

## Verification

### Verify Signature

```typescript
// Verify with identity instance
const valid = await identity.verify(data, signature);

// Verify with public key
import { verifySignature } from 'nanda-ts/crypto';
const valid = await verifySignature(data, signature, publicKey);
```

### Verify Signed JSON

```typescript
import { verifySignedJson } from 'nanda-ts/crypto';

const signed = {
  payload: { action: 'transfer', amount: 100 },
  signature: 'base64-signature...',
  signer: 'did:key:z6Mk...'
};

const { valid, payload } = await verifySignedJson(signed);
if (valid) {
  console.log('Verified payload:', payload);
}
```

---

## Cryptography Functions

### Key Generation

```typescript
import { generateKeyPair } from 'nanda-ts/crypto';

const { publicKey, privateKey } = await generateKeyPair();
// publicKey: Uint8Array (32 bytes)
// privateKey: Uint8Array (64 bytes)
```

### DID Operations

```typescript
import {
  publicKeyToDid,
  didToPublicKey,
  isValidDid
} from 'nanda-ts/crypto';

// Public key to DID
const did = publicKeyToDid(publicKey);

// DID to public key
const key = didToPublicKey(did);

// Validate DID format
const valid = isValidDid(did);
```

### Encoding

```typescript
import {
  encodeBase58btc,
  decodeBase58btc,
  encodeBase64,
  decodeBase64
} from 'nanda-ts/crypto';

// Base58btc (for DIDs)
const encoded = encodeBase58btc(bytes);
const decoded = decodeBase58btc(encoded);

// Base64 (for signatures)
const b64 = encodeBase64(bytes);
const bytes = decodeBase64(b64);
```

---

## AgentFacts

AgentFacts provides verifiable metadata about an agent.

### Building AgentFacts

```typescript
import { AgentFacts } from 'nanda-ts';

const facts = new AgentFacts()
  .setName('Translation Agent')
  .setDescription('AI-powered translation service')
  .setVersion('2.0.0')
  .setProvider({
    organization: 'LangTech Inc.',
    url: 'https://langtech.example.com',
  })
  .addCapability('translation')
  .addCapability('language-detection')
  .setSupportedLanguages(['en', 'es', 'fr', 'de', 'zh'])
  .setClassification({
    category: 'utility',
    subcategory: 'language',
  })
  .build();
```

### Signing AgentFacts

```typescript
// Sign facts with agent identity
const signedFacts = await identity.signJson(facts);

// Host at your facts URL
// https://example.com/agent-facts.json
```

### AgentFacts Schema

```typescript
interface AgentFacts {
  // Core identity
  name: string;
  description: string;
  version: string;

  // Provider information
  provider?: {
    organization?: string;
    url?: string;
    contact?: string;
  };

  // Capabilities
  capabilities?: string[];
  protocols?: string[];

  // Classification
  classification?: {
    category?: string;
    subcategory?: string;
    tags?: string[];
  };

  // Compliance
  compliance?: {
    gdpr?: boolean;
    hipaa?: boolean;
    certifications?: string[];
  };

  // Endpoints
  endpoints?: {
    a2a?: string;
    mcp?: string;
    nlweb?: string;
  };

  // Supply chain
  supplyChain?: {
    baseModel?: string;
    finetuning?: string;
    dataSource?: string;
  };

  // Verification
  verification?: {
    did?: string;
    signature?: string;
  };
}
```

---

## Security Best Practices

### 1. Secure Key Storage

```typescript
// DON'T store keys in plain text
const identity = await AgentIdentity.create();
fs.writeFileSync('keys.json', JSON.stringify(identity.export())); // BAD

// DO use secure storage
import { SecureStorage } from './secure-storage';
await SecureStorage.save('agent-identity', identity.export(), {
  encryption: true,
  accessControl: 'biometric',
});
```

### 2. Key Rotation

```typescript
// Create new identity
const newIdentity = await AgentIdentity.create();

// Update registry
await registry.register({
  handle: 'my-agent',
  factsUrl: 'https://example.com/facts.json',
  did: newIdentity.getDid(),
});

// Securely delete old keys
await SecureStorage.delete('old-identity');
```

### 3. Verify Before Trust

```typescript
async function processSignedMessage(signed: SignedObject) {
  // Always verify signatures
  const { valid, payload } = await verifySignedJson(signed);

  if (!valid) {
    throw new Error('Invalid signature');
  }

  // Verify signer is authorized
  const authorizedDids = await getAuthorizedDids();
  if (!authorizedDids.includes(signed.signer)) {
    throw new Error('Unauthorized signer');
  }

  return payload;
}
```

### 4. Don't Expose Private Keys

```typescript
// DON'T include private key in responses
app.get('/agent-info', (req, res) => {
  res.json({
    did: identity.getDid(),
    publicKey: identity.getPublicKey(), // OK
    // privateKey: identity.getPrivateKey(), // NEVER
  });
});
```

---

## Use Cases

### Message Signing

```typescript
const message = {
  from: identity.getDid(),
  to: 'did:key:z6Mk...',
  content: 'Hello!',
  timestamp: Date.now(),
};

const signed = await identity.signJson(message);
await sendToAgent(signed);
```

### Capability Attestation

```typescript
const attestation = {
  subject: 'did:key:z6Mk...',
  capability: 'translate',
  attestedBy: identity.getDid(),
  issuedAt: Date.now(),
  expiresAt: Date.now() + 86400000, // 24 hours
};

const signed = await identity.signJson(attestation);
```

### Request Authentication

```typescript
// Client side
const request = {
  method: 'message/send',
  params: { ... },
  nonce: crypto.randomUUID(),
  timestamp: Date.now(),
};

const signed = await identity.signJson(request);
await fetch('/rpc', {
  method: 'POST',
  headers: {
    'X-Signature': signed.signature,
    'X-Signer': signed.signer,
  },
  body: JSON.stringify(request),
});

// Server side
server.onMessage(async (params, ctx) => {
  const signature = ctx.headers['x-signature'];
  const signer = ctx.headers['x-signer'];

  if (!await verifyRequest(params, signature, signer)) {
    throw new AuthenticationError('Invalid signature');
  }

  // Process authenticated request
});
```
