/**
 * Key generation and management utilities
 */

/**
 * Key pair structure
 */
export interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

/**
 * Base58btc alphabet for encoding
 */
const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Generate a random key pair
 *
 * NOTE: For production use, consider using @noble/ed25519
 */
export function generateKeyPair(): KeyPair {
  const privateKey = new Uint8Array(32);
  crypto.getRandomValues(privateKey);

  // For a proper implementation, derive the public key using Ed25519
  // This is a simplified version that generates random bytes
  const publicKey = new Uint8Array(32);
  crypto.getRandomValues(publicKey);

  return { privateKey, publicKey };
}

/**
 * Encode bytes as base58btc
 */
export function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';

  // Convert bytes to a big integer
  let num = BigInt(0);
  for (const byte of bytes) {
    num = num * BigInt(256) + BigInt(byte);
  }

  // Convert to base58
  let result = '';
  while (num > 0) {
    result = BASE58_ALPHABET[Number(num % BigInt(58))] + result;
    num = num / BigInt(58);
  }

  // Add leading 1s for leading zero bytes
  for (const byte of bytes) {
    if (byte === 0) {
      result = '1' + result;
    } else {
      break;
    }
  }

  return result;
}

/**
 * Decode base58btc to bytes
 */
export function decodeBase58(str: string): Uint8Array {
  if (str.length === 0) return new Uint8Array(0);

  // Convert from base58
  let num = BigInt(0);
  for (const char of str) {
    const index = BASE58_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid base58 character: ${char}`);
    }
    num = num * BigInt(58) + BigInt(index);
  }

  // Convert to bytes
  const bytes: number[] = [];
  while (num > 0) {
    bytes.unshift(Number(num % BigInt(256)));
    num = num / BigInt(256);
  }

  // Add leading zero bytes for leading 1s
  for (const char of str) {
    if (char === '1') {
      bytes.unshift(0);
    } else {
      break;
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Generate a random DID using did:key method
 */
export function generateDid(): string {
  const keyPair = generateKeyPair();
  return publicKeyToDid(keyPair.publicKey);
}

/**
 * Convert a public key to a DID
 */
export function publicKeyToDid(publicKey: Uint8Array): string {
  // Multicodec prefix for Ed25519 public key (0xed01)
  const multicodec = new Uint8Array([0xed, 0x01, ...publicKey]);
  const encoded = 'z' + encodeBase58(multicodec);
  return `did:key:${encoded}`;
}

/**
 * Extract public key bytes from a did:key DID
 */
export function didToPublicKey(did: string): Uint8Array | null {
  if (!did.startsWith('did:key:z')) {
    return null;
  }

  try {
    const encoded = did.slice(9); // Remove 'did:key:z'
    const bytes = decodeBase58(encoded);

    // Check multicodec prefix
    if (bytes[0] !== 0xed || bytes[1] !== 0x01) {
      return null;
    }

    return bytes.slice(2);
  } catch {
    return null;
  }
}

/**
 * Validate a DID format
 */
export function isValidDid(did: string): boolean {
  if (!did.startsWith('did:key:z6Mk')) {
    return false;
  }
  if (did.length < 20) {
    return false;
  }
  return true;
}

/**
 * Generate a random hex string
 */
export function randomHex(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
