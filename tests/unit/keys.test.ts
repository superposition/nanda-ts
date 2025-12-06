/**
 * Tests for crypto/keys.ts
 */

import { describe, it, expect } from 'bun:test';
import {
  generateKeyPair,
  encodeBase58,
  decodeBase58,
  generateDid,
  publicKeyToDid,
  didToPublicKey,
  isValidDid,
  randomHex,
} from '../../src/crypto/keys';

describe('generateKeyPair', () => {
  it('should generate a key pair with 32-byte keys', () => {
    const keyPair = generateKeyPair();

    expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
    expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
    expect(keyPair.privateKey.length).toBe(32);
    expect(keyPair.publicKey.length).toBe(32);
  });

  it('should generate unique key pairs', () => {
    const keyPair1 = generateKeyPair();
    const keyPair2 = generateKeyPair();

    expect(keyPair1.privateKey).not.toEqual(keyPair2.privateKey);
    expect(keyPair1.publicKey).not.toEqual(keyPair2.publicKey);
  });
});

describe('encodeBase58', () => {
  it('should return empty string for empty input', () => {
    expect(encodeBase58(new Uint8Array(0))).toBe('');
  });

  it('should encode bytes correctly', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const encoded = encodeBase58(bytes);

    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
  });

  it('should handle leading zeros', () => {
    const bytes = new Uint8Array([0, 0, 1, 2, 3]);
    const encoded = encodeBase58(bytes);

    expect(encoded.startsWith('11')).toBe(true);
  });
});

describe('decodeBase58', () => {
  it('should return empty array for empty string', () => {
    expect(decodeBase58('')).toEqual(new Uint8Array(0));
  });

  it('should decode encoded bytes correctly (round trip)', () => {
    const original = new Uint8Array([1, 2, 3, 4, 5]);
    const encoded = encodeBase58(original);
    const decoded = decodeBase58(encoded);

    expect(decoded).toEqual(original);
  });

  it('should throw error for invalid base58 character', () => {
    expect(() => decodeBase58('0OIl')).toThrow('Invalid base58 character: 0');
  });

  it('should handle leading 1s (leading zeros)', () => {
    const original = new Uint8Array([0, 0, 0, 1, 2, 3]);
    const encoded = encodeBase58(original);
    const decoded = decodeBase58(encoded);

    expect(decoded).toEqual(original);
  });
});

describe('generateDid', () => {
  it('should generate a valid did:key', () => {
    const did = generateDid();

    expect(did).toMatch(/^did:key:z/);
  });

  it('should generate unique DIDs', () => {
    const did1 = generateDid();
    const did2 = generateDid();

    expect(did1).not.toBe(did2);
  });
});

describe('publicKeyToDid', () => {
  it('should convert public key to did:key format', () => {
    const publicKey = new Uint8Array(32);
    crypto.getRandomValues(publicKey);

    const did = publicKeyToDid(publicKey);

    expect(did).toMatch(/^did:key:z/);
  });

  it('should produce consistent DID for same public key', () => {
    const publicKey = new Uint8Array(32).fill(1);

    const did1 = publicKeyToDid(publicKey);
    const did2 = publicKeyToDid(publicKey);

    expect(did1).toBe(did2);
  });
});

describe('didToPublicKey', () => {
  it('should extract public key from valid did:key', () => {
    const originalKey = new Uint8Array(32);
    crypto.getRandomValues(originalKey);
    const did = publicKeyToDid(originalKey);

    const extractedKey = didToPublicKey(did);

    expect(extractedKey).toEqual(originalKey);
  });

  it('should return null for non did:key DIDs', () => {
    expect(didToPublicKey('did:web:example.com')).toBeNull();
  });

  it('should return null for DIDs not starting with z', () => {
    expect(didToPublicKey('did:key:abc123')).toBeNull();
  });

  it('should return null for invalid base58 encoding', () => {
    expect(didToPublicKey('did:key:z0invalid')).toBeNull();
  });

  it('should return null for wrong multicodec prefix', () => {
    // Create a DID with wrong prefix (not 0xed01)
    const wrongPrefix = new Uint8Array([0x00, 0x00, ...new Uint8Array(32)]);
    const encoded = 'z' + encodeBase58(wrongPrefix);
    const did = `did:key:${encoded}`;

    expect(didToPublicKey(did)).toBeNull();
  });
});

describe('isValidDid', () => {
  it('should return true for valid did:key format', () => {
    // Generate a proper DID to test
    const did = generateDid();
    // Proper DIDs start with did:key:z6Mk...
    const validDid = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';

    expect(isValidDid(validDid)).toBe(true);
  });

  it('should return false for DIDs not starting with did:key:z6Mk', () => {
    expect(isValidDid('did:key:zabc')).toBe(false);
    expect(isValidDid('did:web:example.com')).toBe(false);
  });

  it('should return false for DIDs that are too short', () => {
    expect(isValidDid('did:key:z6Mk')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isValidDid('')).toBe(false);
  });
});

describe('randomHex', () => {
  it('should generate hex string of correct length', () => {
    const hex = randomHex(16);

    expect(hex.length).toBe(32); // 16 bytes = 32 hex chars
  });

  it('should generate valid hex characters only', () => {
    const hex = randomHex(32);

    expect(hex).toMatch(/^[0-9a-f]+$/);
  });

  it('should generate unique values', () => {
    const hex1 = randomHex(16);
    const hex2 = randomHex(16);

    expect(hex1).not.toBe(hex2);
  });

  it('should handle length of 0', () => {
    const hex = randomHex(0);

    expect(hex).toBe('');
  });
});
