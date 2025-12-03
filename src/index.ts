/**
 * nanda-ts - Bun-native TypeScript SDK for the NANDA ecosystem
 *
 * Implements A2A (Google), MCP (Anthropic), and NLWeb (Microsoft) protocols
 * for AI agent communication and discovery.
 *
 * @packageDocumentation
 */

// Re-export all types
export * from './types';

// These will be implemented in subsequent phases:
// export { NandaClient } from './client';
// export { AgentServer } from './server';
// export { A2AClient } from './protocols/a2a';
// export { MCPBridge } from './protocols/mcp';
// export { NLWebClient } from './protocols/nlweb';
// export { IndexClient, RegistryCache, QuiltResolver } from './registry';
// export { AgentIdentity, AgentFactsBuilder } from './agent';

/**
 * SDK version
 */
export const VERSION = '0.1.0';

/**
 * Default NANDA registry URL
 */
export const DEFAULT_REGISTRY_URL = 'https://api.projectnanda.org/v1';

/**
 * Default timeout for requests (30 seconds)
 */
export const DEFAULT_TIMEOUT = 30000;

/**
 * Default cache TTL (5 minutes)
 */
export const DEFAULT_CACHE_TTL = 300;
