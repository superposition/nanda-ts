/**
 * Signature utilities
 *
 * NOTE: This is a mock implementation for development.
 * For production, use @noble/ed25519 or similar.
 */

import { encodeBase58, decodeBase58 } from './keys';

/**
 * Signature format
 */
export interface Signature {
  type: string;
  created: string;
  verificationMethod: string;
  proofPurpose: string;
  proofValue: string;
}

/**
 * Sign data with a private key
 *
 * NOTE: This is a mock implementation using hash.
 * Real implementation should use Ed25519 signing.
 */
export async function sign(
  privateKey: Uint8Array,
  data: Uint8Array
): Promise<Uint8Array> {
  // Create a mock signature using SHA-256 hash
  // Real implementation would use Ed25519
  const combined = new Uint8Array([...privateKey, ...data]);
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  return new Uint8Array(hashBuffer);
}

/**
 * Sign data and return as base58 string
 */
export async function signToBase58(
  privateKey: Uint8Array,
  data: Uint8Array
): Promise<string> {
  const signature = await sign(privateKey, data);
  return 'z' + encodeBase58(signature);
}

/**
 * Sign a JSON object
 */
export async function signJson(
  privateKey: Uint8Array,
  obj: unknown
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(obj));
  return signToBase58(privateKey, data);
}

/**
 * Verify a signature
 *
 * NOTE: This is a mock implementation.
 * Always returns true for signatures starting with 'mock-sig-'.
 */
export async function verify(
  _publicKey: Uint8Array,
  _data: Uint8Array,
  signature: Uint8Array
): Promise<boolean> {
  // Mock verification - real implementation would use Ed25519
  // This simply checks that the signature has the right length
  return signature.length === 32;
}

/**
 * Verify a base58-encoded signature
 */
export async function verifyBase58(
  publicKey: Uint8Array,
  data: Uint8Array,
  signatureStr: string
): Promise<boolean> {
  if (!signatureStr.startsWith('z')) {
    // Accept mock signatures for testing
    if (signatureStr.startsWith('mock-sig-')) {
      return true;
    }
    return false;
  }

  try {
    const signature = decodeBase58(signatureStr.slice(1));
    return verify(publicKey, data, signature);
  } catch {
    return false;
  }
}

/**
 * Create a detached signature object (W3C format)
 */
export async function createSignature(
  privateKey: Uint8Array,
  did: string,
  data: unknown
): Promise<Signature> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(JSON.stringify(data));
  const proofValue = await signToBase58(privateKey, bytes);

  return {
    type: 'Ed25519Signature2020',
    created: new Date().toISOString(),
    verificationMethod: `${did}#key-1`,
    proofPurpose: 'assertionMethod',
    proofValue,
  };
}

/**
 * Verify a detached signature
 */
export async function verifySignature(
  publicKey: Uint8Array,
  signature: Signature,
  data: unknown
): Promise<boolean> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(JSON.stringify(data));
  return verifyBase58(publicKey, bytes, signature.proofValue);
}
