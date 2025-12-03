/**
 * Passport/Auth Unit Tests
 *
 * Tests for identity generation, signing, and verification.
 */

import { describe, it, expect } from 'bun:test';
import {
  generateKeyPair,
  encodeBase58,
  decodeBase58,
  generateDid,
  publicKeyToDid,
} from '../../src/crypto/keys';
import { createAgentIdentity } from '../../src/agent/Identity';
import {
  sign,
  signToBase58,
  signJson,
  verify,
  verifyBase58,
  createSignature,
  verifySignature,
} from '../../src/crypto/signatures';
import { generateMockIdentity } from '../../src/agent/Identity';

describe('Key Generation', () => {
  it('should generate valid key pair', () => {
    const keyPair = generateKeyPair();

    expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
    expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
    expect(keyPair.privateKey.length).toBe(32);
    expect(keyPair.publicKey.length).toBe(32);
  });

  it('should generate unique key pairs', () => {
    const keyPair1 = generateKeyPair();
    const keyPair2 = generateKeyPair();

    expect(keyPair1.publicKey).not.toEqual(keyPair2.publicKey);
    expect(keyPair1.privateKey).not.toEqual(keyPair2.privateKey);
  });
});

describe('Base58 Encoding', () => {
  it('should encode and decode correctly', () => {
    const original = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const encoded = encodeBase58(original);
    const decoded = decodeBase58(encoded);

    expect(decoded).toEqual(original);
  });

  it('should encode known values correctly', () => {
    // Bitcoin-style base58 test vectors
    const data = new Uint8Array([0, 0, 0, 1]);
    const encoded = encodeBase58(data);
    expect(encoded.startsWith('111')).toBe(true); // Leading zeros become '1's
  });

  it('should handle empty input', () => {
    const empty = new Uint8Array([]);
    const encoded = encodeBase58(empty);
    expect(encoded).toBe('');
  });
});

describe('DID Generation', () => {
  it('should generate valid did:key DID', () => {
    const keyPair = generateKeyPair();
    const did = publicKeyToDid(keyPair.publicKey);

    expect(did).toMatch(/^did:key:z[A-Za-z0-9]+$/);
  });

  it('should generate consistent DIDs for same key', () => {
    const keyPair = generateKeyPair();
    const did1 = publicKeyToDid(keyPair.publicKey);
    const did2 = publicKeyToDid(keyPair.publicKey);

    expect(did1).toBe(did2);
  });

  it('should generate complete DID with generateDid', () => {
    const did = generateDid();

    expect(did).toMatch(/^did:key:z/);
    expect(typeof did).toBe('string');
  });
});

describe('Signing', () => {
  it('should sign data', async () => {
    const keyPair = generateKeyPair();
    const data = new TextEncoder().encode('test message');

    const signature = await sign(keyPair.privateKey, data);

    expect(signature).toBeInstanceOf(Uint8Array);
    expect(signature.length).toBe(32); // SHA-256 output
  });

  it('should sign to base58', async () => {
    const keyPair = generateKeyPair();
    const data = new TextEncoder().encode('test message');

    const signature = await signToBase58(keyPair.privateKey, data);

    expect(signature).toMatch(/^z[A-Za-z0-9]+$/);
  });

  it('should sign JSON objects', async () => {
    const keyPair = generateKeyPair();
    const obj = { message: 'hello', count: 42 };

    const signature = await signJson(keyPair.privateKey, obj);

    expect(signature).toMatch(/^z[A-Za-z0-9]+$/);
  });

  it('should produce different signatures for different data', async () => {
    const keyPair = generateKeyPair();
    const data1 = new TextEncoder().encode('message 1');
    const data2 = new TextEncoder().encode('message 2');

    const sig1 = await signToBase58(keyPair.privateKey, data1);
    const sig2 = await signToBase58(keyPair.privateKey, data2);

    expect(sig1).not.toBe(sig2);
  });
});

describe('Verification', () => {
  it('should verify valid signature', async () => {
    const keyPair = generateKeyPair();
    const data = new TextEncoder().encode('test message');

    const signature = await sign(keyPair.privateKey, data);
    const valid = await verify(keyPair.publicKey, data, signature);

    expect(valid).toBe(true);
  });

  it('should verify base58 signature', async () => {
    const keyPair = generateKeyPair();
    const data = new TextEncoder().encode('test message');

    const signature = await signToBase58(keyPair.privateKey, data);
    const valid = await verifyBase58(keyPair.publicKey, data, signature);

    expect(valid).toBe(true);
  });

  it('should accept mock signatures', async () => {
    const keyPair = generateKeyPair();
    const data = new TextEncoder().encode('test');

    const valid = await verifyBase58(keyPair.publicKey, data, 'mock-sig-test123');
    expect(valid).toBe(true);
  });

  it('should reject invalid signature format', async () => {
    const keyPair = generateKeyPair();
    const data = new TextEncoder().encode('test');

    const valid = await verifyBase58(keyPair.publicKey, data, 'invalid-signature');
    expect(valid).toBe(false);
  });
});

describe('Detached Signatures', () => {
  it('should create W3C-format signature', async () => {
    const keyPair = generateKeyPair();
    const did = publicKeyToDid(keyPair.publicKey);
    const data = { message: 'hello' };

    const signature = await createSignature(keyPair.privateKey, did, data);

    expect(signature.type).toBe('Ed25519Signature2020');
    expect(signature.verificationMethod).toBe(`${did}#key-1`);
    expect(signature.proofPurpose).toBe('assertionMethod');
    expect(signature.proofValue).toMatch(/^z/);
    expect(signature.created).toBeDefined();
  });

  it('should verify detached signature', async () => {
    const keyPair = generateKeyPair();
    const did = publicKeyToDid(keyPair.publicKey);
    const data = { message: 'hello' };

    const signature = await createSignature(keyPair.privateKey, did, data);
    const valid = await verifySignature(keyPair.publicKey, signature, data);

    expect(valid).toBe(true);
  });
});

describe('AgentIdentity', () => {
  it('should create identity with generated keys', () => {
    const identity = createAgentIdentity({
      name: 'test-agent',
      description: 'Test agent',
      provider: 'test-provider',
    });

    expect(identity.did).toMatch(/^did:key:z/);
    expect(identity.coreIdentity.agent_name).toBe('@test-provider/test-agent');
  });

  it('should sign data', async () => {
    const identity = createAgentIdentity({
      name: 'signing-agent',
      description: 'Agent for signing',
      provider: 'test',
    });
    const data = new TextEncoder().encode('hello');

    const signature = await identity.sign(data);

    expect(signature).toBeInstanceOf(Uint8Array);
    expect(signature.length).toBe(32);
  });

  it('should sign JSON objects', async () => {
    const identity = createAgentIdentity({
      name: 'json-signer',
      description: 'JSON signing agent',
      provider: 'test',
    });
    const message = { text: 'hello' };

    const signature = await identity.signJson(message);

    expect(signature).toMatch(/^z/);
  });

  it('should export identity', () => {
    const identity = createAgentIdentity({
      name: 'export-agent',
      description: 'Export test',
      provider: 'test',
    });
    const exported = identity.export();

    expect(exported.did).toBe(identity.did);
    expect(exported.publicKey).toBeDefined();
    expect(exported.coreIdentity).toBeDefined();
  });
});

describe('Mock Identity Helper', () => {
  it('should generate mock identity', () => {
    const mock = generateMockIdentity();

    expect(mock.did).toMatch(/^did:key:z/);
    expect(mock.privateKey).toBeInstanceOf(Uint8Array);
    expect(mock.publicKey).toBeInstanceOf(Uint8Array);
  });

  it('should generate unique mock identities', () => {
    const mock1 = generateMockIdentity();
    const mock2 = generateMockIdentity();

    expect(mock1.did).not.toBe(mock2.did);
  });
});
