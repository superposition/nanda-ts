/**
 * Crypto exports
 */

export {
  generateKeyPair,
  generateDid,
  publicKeyToDid,
  didToPublicKey,
  isValidDid,
  encodeBase58,
  decodeBase58,
  randomHex,
  type KeyPair,
} from './keys';

export {
  sign,
  signToBase58,
  signJson,
  verify,
  verifyBase58,
  createSignature,
  verifySignature,
  type Signature,
} from './signatures';
