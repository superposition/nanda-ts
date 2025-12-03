/**
 * Mock Passport/Identity Helpers
 *
 * Provides mock identity and signature helpers for testing.
 */

import { encodeBase58 } from '../../src/crypto/keys';

/**
 * Mock identity for testing
 */
export interface MockIdentity {
  did: string;
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

/**
 * Generate a mock identity for testing
 */
export function generateMockIdentity(): MockIdentity {
  const privateKey = new Uint8Array(32);
  crypto.getRandomValues(privateKey);

  const publicKey = new Uint8Array(32);
  crypto.getRandomValues(publicKey);

  const did = `did:key:z6Mk${randomBase58(32)}`;

  return { did, privateKey, publicKey };
}

/**
 * Generate random base58 string
 */
export function randomBase58(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return encodeBase58(bytes).slice(0, length);
}

/**
 * Create a mock signature
 */
export function createMockSignature(did: string): string {
  return `mock-sig-${did.slice(-8)}-${Date.now()}`;
}

/**
 * Verify a mock signature (always returns true for mock signatures)
 */
export function verifyMockSignature(signature: string): boolean {
  return signature.startsWith('mock-sig-');
}

/**
 * Create mock agent credentials
 */
export function createMockCredentials(agentId: string): {
  identity: MockIdentity;
  signature: string;
} {
  const identity = generateMockIdentity();
  const signature = createMockSignature(identity.did);
  return { identity, signature };
}

/**
 * Generate a random UUID
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Generate a unique port for testing
 */
let portCounter = 9000;
export function getTestPort(): number {
  return portCounter++;
}

/**
 * Reset port counter (for test isolation)
 */
export function resetTestPort(): void {
  portCounter = 9000;
}
