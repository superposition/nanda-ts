/**
 * Agent Identity management
 */

import type { CoreIdentity } from '../types';
import {
  generateKeyPair,
  publicKeyToDid,
  type KeyPair,
} from '../crypto/keys';
import { sign, signJson, createSignature, type Signature } from '../crypto/signatures';

/**
 * Agent Identity configuration
 */
export interface AgentIdentityConfig {
  name: string;
  description: string;
  version?: string;
  provider: string;
  privateKey?: Uint8Array;
}

/**
 * Agent Identity class
 *
 * Manages DID-based identity for agents.
 */
export class AgentIdentity {
  public readonly did: string;
  public readonly coreIdentity: CoreIdentity;
  private keyPair: KeyPair;

  constructor(config: AgentIdentityConfig) {
    if (config.privateKey) {
      // Use provided private key
      this.keyPair = {
        privateKey: config.privateKey,
        publicKey: new Uint8Array(32), // Would derive from private key
      };
      // Generate random public key for mock
      crypto.getRandomValues(this.keyPair.publicKey);
    } else {
      // Generate new key pair
      this.keyPair = generateKeyPair();
    }

    this.did = publicKeyToDid(this.keyPair.publicKey);

    this.coreIdentity = {
      agent_id: this.did,
      agent_name: `@${config.provider}/${config.name}`,
      version: config.version ?? '1.0.0',
      description: config.description,
      provider: config.provider,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Sign data with the agent's private key
   */
  async sign(data: Uint8Array): Promise<Uint8Array> {
    return sign(this.keyPair.privateKey, data);
  }

  /**
   * Sign a JSON object
   */
  async signJson(obj: unknown): Promise<string> {
    return signJson(this.keyPair.privateKey, obj);
  }

  /**
   * Create a detached signature
   */
  async createSignature(data: unknown): Promise<Signature> {
    return createSignature(this.keyPair.privateKey, this.did, data);
  }

  /**
   * Get the public key
   */
  getPublicKey(): Uint8Array {
    return this.keyPair.publicKey;
  }

  /**
   * Get the private key (use carefully)
   */
  getPrivateKey(): Uint8Array {
    return this.keyPair.privateKey;
  }

  /**
   * Export identity for serialization
   */
  export(): {
    did: string;
    publicKey: string;
    coreIdentity: CoreIdentity;
  } {
    return {
      did: this.did,
      publicKey: Buffer.from(this.keyPair.publicKey).toString('base64'),
      coreIdentity: this.coreIdentity,
    };
  }
}

/**
 * Create a new agent identity
 */
export function createAgentIdentity(
  config: AgentIdentityConfig
): AgentIdentity {
  return new AgentIdentity(config);
}

/**
 * Generate a mock identity for testing
 */
export function generateMockIdentity(): {
  did: string;
  privateKey: Uint8Array;
  publicKey: Uint8Array;
} {
  const keyPair = generateKeyPair();
  return {
    did: publicKeyToDid(keyPair.publicKey),
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
  };
}
