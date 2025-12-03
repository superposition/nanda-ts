/**
 * NANDA Index Client
 *
 * Client for interacting with the NANDA registry.
 */

import type {
  RegistryConfig,
  AgentAddr,
  RegisterAgentRequest,
  RegisterAgentResponse,
  SearchAgentsParams,
  SearchAgentsResult,
} from '../types';
import { RegistryError } from '../types';
import { RegistryCache } from './cache';

/**
 * Default NANDA registry URL
 */
export const DEFAULT_REGISTRY_URL = 'https://api.projectnanda.org/v1';

/**
 * NANDA Index Client
 */
export class IndexClient {
  private config: Required<RegistryConfig>;
  private cache: RegistryCache | null;

  constructor(config: Partial<RegistryConfig> = {}) {
    this.config = {
      baseUrl: DEFAULT_REGISTRY_URL,
      apiKey: undefined as unknown as string,
      cacheEnabled: true,
      cacheTTL: 300, // 5 minutes
      ...config,
    };

    this.cache = this.config.cacheEnabled
      ? new RegistryCache({ ttl: this.config.cacheTTL })
      : null;
  }

  /**
   * Get the registry base URL
   */
  get baseUrl(): string {
    return this.config.baseUrl;
  }

  /**
   * Register an agent in the NANDA registry
   */
  async register(request: RegisterAgentRequest): Promise<RegisterAgentResponse> {
    const response = await fetch(`${this.config.baseUrl}/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && {
          Authorization: `Bearer ${this.config.apiKey}`,
        }),
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new RegistryError(
        `Registration failed: ${response.status} - ${error}`,
        request.handle
      );
    }

    return response.json();
  }

  /**
   * Resolve an agent by handle
   */
  async resolve(handle: string): Promise<AgentAddr | null> {
    // Check cache first
    if (this.cache) {
      const cached = this.cache.get<AgentAddr>(`resolve:${handle}`);
      if (cached) return cached;
    }

    const response = await fetch(
      `${this.config.baseUrl}/agents/${encodeURIComponent(handle)}`,
      {
        headers: this.config.apiKey
          ? { Authorization: `Bearer ${this.config.apiKey}` }
          : {},
      }
    );

    if (response.status === 404) return null;

    if (!response.ok) {
      throw new RegistryError(
        `Resolution failed: ${response.status}`,
        handle
      );
    }

    const agentAddr: AgentAddr = await response.json();

    // Cache the result
    if (this.cache) {
      this.cache.set(`resolve:${handle}`, agentAddr, agentAddr.ttl);
    }

    return agentAddr;
  }

  /**
   * Search for agents
   */
  async search(params: SearchAgentsParams = {}): Promise<SearchAgentsResult> {
    const queryParams = new URLSearchParams();

    if (params.query) queryParams.set('q', params.query);
    if (params.capabilities) {
      params.capabilities.forEach((c) => queryParams.append('capability', c));
    }
    if (params.protocols) {
      params.protocols.forEach((p) => queryParams.append('protocol', p));
    }
    if (params.domain) queryParams.set('domain', params.domain);
    if (params.provider) queryParams.set('provider', params.provider);
    if (params.verified !== undefined) {
      queryParams.set('verified', String(params.verified));
    }
    if (params.limit) queryParams.set('limit', String(params.limit));
    if (params.offset) queryParams.set('offset', String(params.offset));

    const url = `${this.config.baseUrl}/agents/search?${queryParams}`;

    // Check cache for search results
    const cacheKey = `search:${url}`;
    if (this.cache) {
      const cached = this.cache.get<SearchAgentsResult>(cacheKey);
      if (cached) return cached;
    }

    const response = await fetch(url, {
      headers: this.config.apiKey
        ? { Authorization: `Bearer ${this.config.apiKey}` }
        : {},
    });

    if (!response.ok) {
      throw new RegistryError(`Search failed: ${response.status}`);
    }

    const result: SearchAgentsResult = await response.json();

    // Cache search results (shorter TTL)
    if (this.cache) {
      this.cache.set(cacheKey, result, 60); // 1 minute cache for searches
    }

    return result;
  }

  /**
   * List all agents (paginated)
   */
  async list(limit = 100, offset = 0): Promise<SearchAgentsResult> {
    return this.search({ limit, offset });
  }

  /**
   * Get agent by ID
   */
  async getById(agentId: string): Promise<AgentAddr | null> {
    const response = await fetch(
      `${this.config.baseUrl}/agents/id/${encodeURIComponent(agentId)}`,
      {
        headers: this.config.apiKey
          ? { Authorization: `Bearer ${this.config.apiKey}` }
          : {},
      }
    );

    if (response.status === 404) return null;

    if (!response.ok) {
      throw new RegistryError(`Get by ID failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache?.clear();
  }

  /**
   * Close the client (cleanup)
   */
  close(): void {
    this.cache?.close();
  }
}

/**
 * Create a new index client
 */
export function createIndexClient(config?: Partial<RegistryConfig>): IndexClient {
  return new IndexClient(config);
}
