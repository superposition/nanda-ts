/**
 * Tests for AgentIdentity class
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  AgentIdentity,
  createAgentIdentity,
  generateMockIdentity,
  type AgentIdentityConfig,
} from '../../src/agent/Identity';

describe('AgentIdentity', () => {
  const baseConfig: AgentIdentityConfig = {
    name: 'test-agent',
    description: 'A test agent',
    provider: 'test-org',
  };

  describe('constructor', () => {
    it('should generate new key pair when no privateKey provided', () => {
      const identity = new AgentIdentity(baseConfig);

      expect(identity.did).toMatch(/^did:key:z/);
      expect(identity.coreIdentity.agent_name).toBe('@test-org/test-agent');
      expect(identity.getPublicKey()).toBeInstanceOf(Uint8Array);
      expect(identity.getPublicKey().length).toBe(32);
    });

    it('should use provided privateKey', () => {
      const privateKey = new Uint8Array(32);
      crypto.getRandomValues(privateKey);

      const identity = new AgentIdentity({ ...baseConfig, privateKey });

      expect(identity.did).toMatch(/^did:key:z/);
      expect(identity.getPrivateKey()).toBe(privateKey);
    });

    it('should set default version to 1.0.0', () => {
      const identity = new AgentIdentity(baseConfig);

      expect(identity.coreIdentity.version).toBe('1.0.0');
    });

    it('should use provided version', () => {
      const identity = new AgentIdentity({ ...baseConfig, version: '2.0.0' });

      expect(identity.coreIdentity.version).toBe('2.0.0');
    });

    it('should set created_at and updated_at timestamps', () => {
      const before = new Date().toISOString();
      const identity = new AgentIdentity(baseConfig);
      const after = new Date().toISOString();

      expect(identity.coreIdentity.created_at).toBeDefined();
      expect(identity.coreIdentity.updated_at).toBeDefined();
      expect(identity.coreIdentity.created_at >= before).toBe(true);
      expect(identity.coreIdentity.created_at <= after).toBe(true);
    });

    it('should set coreIdentity fields correctly', () => {
      const identity = new AgentIdentity(baseConfig);

      expect(identity.coreIdentity.agent_id).toBe(identity.did);
      expect(identity.coreIdentity.description).toBe('A test agent');
      expect(identity.coreIdentity.provider).toBe('test-org');
    });
  });

  describe('sign()', () => {
    it('should sign data and return Uint8Array', async () => {
      const identity = new AgentIdentity(baseConfig);
      const data = new TextEncoder().encode('test data');

      const signature = await identity.sign(data);

      expect(signature).toBeInstanceOf(Uint8Array);
      expect(signature.length).toBeGreaterThan(0);
    });

    it('should produce different signatures for different data', async () => {
      const identity = new AgentIdentity(baseConfig);
      const data1 = new TextEncoder().encode('data1');
      const data2 = new TextEncoder().encode('data2');

      const sig1 = await identity.sign(data1);
      const sig2 = await identity.sign(data2);

      expect(sig1).not.toEqual(sig2);
    });
  });

  describe('signJson()', () => {
    it('should sign JSON object and return string', async () => {
      const identity = new AgentIdentity(baseConfig);
      const obj = { foo: 'bar', num: 42 };

      const signature = await identity.signJson(obj);

      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
    });

    it('should produce consistent signatures for same object', async () => {
      const identity = new AgentIdentity(baseConfig);
      const obj = { a: 1, b: 2 };

      const sig1 = await identity.signJson(obj);
      const sig2 = await identity.signJson(obj);

      expect(sig1).toBe(sig2);
    });

    it('should produce different signatures for different objects', async () => {
      const identity = new AgentIdentity(baseConfig);

      const sig1 = await identity.signJson({ a: 1 });
      const sig2 = await identity.signJson({ a: 2 });

      expect(sig1).not.toBe(sig2);
    });
  });

  describe('createSignature()', () => {
    it('should create detached signature with correct structure', async () => {
      const identity = new AgentIdentity(baseConfig);
      const data = { message: 'hello' };

      const signature = await identity.createSignature(data);

      expect(signature).toHaveProperty('type');
      expect(signature).toHaveProperty('created');
      expect(signature).toHaveProperty('verificationMethod');
      expect(signature).toHaveProperty('proofPurpose');
      expect(signature).toHaveProperty('proofValue');
      expect(typeof signature.proofValue).toBe('string');
    });

    it('should include timestamp in signature', async () => {
      const before = new Date().toISOString();
      const identity = new AgentIdentity(baseConfig);
      const signature = await identity.createSignature({ test: true });
      const after = new Date().toISOString();

      expect(signature.created >= before).toBe(true);
      expect(signature.created <= after).toBe(true);
    });
  });

  describe('getPublicKey()', () => {
    it('should return public key as Uint8Array', () => {
      const identity = new AgentIdentity(baseConfig);

      const publicKey = identity.getPublicKey();

      expect(publicKey).toBeInstanceOf(Uint8Array);
      expect(publicKey.length).toBe(32);
    });

    it('should return same public key on multiple calls', () => {
      const identity = new AgentIdentity(baseConfig);

      const key1 = identity.getPublicKey();
      const key2 = identity.getPublicKey();

      expect(key1).toBe(key2);
    });
  });

  describe('getPrivateKey()', () => {
    it('should return private key as Uint8Array', () => {
      const identity = new AgentIdentity(baseConfig);

      const privateKey = identity.getPrivateKey();

      expect(privateKey).toBeInstanceOf(Uint8Array);
      expect(privateKey.length).toBe(32);
    });

    it('should return provided private key', () => {
      const privateKey = new Uint8Array(32);
      crypto.getRandomValues(privateKey);
      const identity = new AgentIdentity({ ...baseConfig, privateKey });

      expect(identity.getPrivateKey()).toBe(privateKey);
    });
  });

  describe('export()', () => {
    it('should export identity with all required fields', () => {
      const identity = new AgentIdentity(baseConfig);

      const exported = identity.export();

      expect(exported).toHaveProperty('did');
      expect(exported).toHaveProperty('publicKey');
      expect(exported).toHaveProperty('coreIdentity');
      expect(exported.did).toBe(identity.did);
    });

    it('should export publicKey as base64 string', () => {
      const identity = new AgentIdentity(baseConfig);

      const exported = identity.export();

      expect(typeof exported.publicKey).toBe('string');
      // Verify it's valid base64
      const decoded = Buffer.from(exported.publicKey, 'base64');
      expect(decoded.length).toBe(32);
    });

    it('should include full coreIdentity', () => {
      const identity = new AgentIdentity(baseConfig);

      const exported = identity.export();

      expect(exported.coreIdentity.agent_name).toBe('@test-org/test-agent');
      expect(exported.coreIdentity.description).toBe('A test agent');
      expect(exported.coreIdentity.provider).toBe('test-org');
    });
  });
});

describe('createAgentIdentity()', () => {
  it('should create AgentIdentity instance', () => {
    const identity = createAgentIdentity({
      name: 'my-agent',
      description: 'My agent',
      provider: 'my-org',
    });

    expect(identity).toBeInstanceOf(AgentIdentity);
    expect(identity.coreIdentity.agent_name).toBe('@my-org/my-agent');
  });

  it('should pass all config options', () => {
    const privateKey = new Uint8Array(32);
    crypto.getRandomValues(privateKey);

    const identity = createAgentIdentity({
      name: 'agent',
      description: 'desc',
      provider: 'org',
      version: '3.0.0',
      privateKey,
    });

    expect(identity.coreIdentity.version).toBe('3.0.0');
    expect(identity.getPrivateKey()).toBe(privateKey);
  });
});

describe('generateMockIdentity()', () => {
  it('should generate mock identity with all fields', () => {
    const mock = generateMockIdentity();

    expect(mock).toHaveProperty('did');
    expect(mock).toHaveProperty('privateKey');
    expect(mock).toHaveProperty('publicKey');
  });

  it('should generate valid DID', () => {
    const mock = generateMockIdentity();

    expect(mock.did).toMatch(/^did:key:z/);
  });

  it('should generate valid key pair', () => {
    const mock = generateMockIdentity();

    expect(mock.privateKey).toBeInstanceOf(Uint8Array);
    expect(mock.publicKey).toBeInstanceOf(Uint8Array);
    expect(mock.privateKey.length).toBe(32);
    expect(mock.publicKey.length).toBe(32);
  });

  it('should generate unique identities each call', () => {
    const mock1 = generateMockIdentity();
    const mock2 = generateMockIdentity();

    expect(mock1.did).not.toBe(mock2.did);
    expect(mock1.privateKey).not.toEqual(mock2.privateKey);
  });
});
