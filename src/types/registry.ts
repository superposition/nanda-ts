/**
 * Registry and NANDA Index types
 */

import type { AgentCard, AgentFacts, AgentEndpoints } from './agent';

/**
 * Registry client configuration
 */
export interface RegistryConfig {
  baseUrl: string;
  apiKey?: string;
  cacheEnabled?: boolean;
  cacheTTL?: number; // seconds
}

/**
 * Agent address record from NANDA Index
 */
export interface AgentAddr {
  agent_id: string;
  agent_name: string; // URN format: @org/agent-name
  primary_facts_url: string;
  private_facts_url?: string;
  adaptive_resolver_url?: string;
  ttl: number; // seconds
  signature?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Request to register an agent
 */
export interface RegisterAgentRequest {
  handle: string; // @org/agent format
  facts_url: string;
}

/**
 * Response from agent registration
 */
export interface RegisterAgentResponse {
  agent_id: string;
  handle: string;
  status: 'registered' | 'pending' | 'verified';
  message?: string;
}

/**
 * Parameters for searching agents
 */
export interface SearchAgentsParams {
  query?: string;
  capabilities?: string[];
  protocols?: string[];
  domain?: string;
  provider?: string;
  verified?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Result from agent search
 */
export interface SearchAgentsResult {
  agents: AgentAddr[];
  total: number;
  hasMore: boolean;
}

/**
 * Fully resolved agent with all details
 */
export interface FullyResolvedAgent {
  agentAddr: AgentAddr;
  agentCard?: AgentCard;
  agentFacts?: AgentFacts;
  endpoints: AgentEndpoints;
  resolvedAt: Date;
}

/**
 * Cache entry structure
 */
export interface CacheEntry<T> {
  key: string;
  value: T;
  expiresAt: number;
  createdAt: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  ttl: number; // Default TTL in seconds
  dbPath?: string; // Database path, defaults to :memory:
  maxSize?: number; // Max cache entries
}

/**
 * Registry quilt (federated registries) configuration
 */
export interface QuiltConfig {
  registries: RegistryConfig[];
  timeout?: number;
  parallel?: boolean;
}

/**
 * Agent metadata for discovery
 */
export interface AgentMetadata {
  did: string;
  name: string;
  description?: string;
  capabilities: {
    name: string;
    version?: string;
  }[];
  endpoints: AgentEndpoints;
}

/**
 * Discovery search criteria
 */
export interface DiscoveryCriteria {
  capability?: string;
  name?: string;
  protocol?: string;
}

/**
 * Parse a NANDA handle into org and agent name
 */
export function parseHandle(handle: string): { org: string; name: string } | null {
  const match = handle.match(/^@([^/]+)\/(.+)$/);
  if (!match) return null;
  return { org: match[1], name: match[2] };
}

/**
 * Create a NANDA handle from org and agent name
 */
export function createHandle(org: string, name: string): string {
  return `@${org}/${name}`;
}

/**
 * Check if a string is a valid NANDA handle
 */
export function isValidHandle(handle: string): boolean {
  return /^@[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(handle);
}

/**
 * Check if a string is a URL
 */
export function isUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

/**
 * Check if a string is a DID
 */
export function isDid(value: string): boolean {
  return value.startsWith('did:');
}
