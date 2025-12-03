/**
 * Quilt Resolver
 *
 * Multi-registry resolution for federated NANDA registries.
 */

import type {
  QuiltConfig,
  RegistryConfig,
  AgentAddr,
  AgentCard,
  AgentFacts,
  FullyResolvedAgent,
  AgentEndpoints,
} from '../types';
import { IndexClient } from './IndexClient';
import { getAgentCardUrl, parseAgentCard } from '../protocols/a2a/AgentCard';

/**
 * Default timeout for resolution (5 seconds)
 */
const DEFAULT_TIMEOUT = 5000;

/**
 * Quilt Resolver for multi-registry resolution
 */
export class QuiltResolver {
  private clients: IndexClient[];
  private config: Required<QuiltConfig>;

  constructor(config: QuiltConfig) {
    this.config = {
      timeout: DEFAULT_TIMEOUT,
      parallel: true,
      ...config,
    };

    this.clients = config.registries.map((r) => new IndexClient(r));
  }

  /**
   * Resolve agent across all registries
   */
  async resolve(handle: string): Promise<FullyResolvedAgent | null> {
    const agentAddr = await this.resolveHandle(handle);
    if (!agentAddr) return null;

    // Fetch additional details
    const [agentCard, agentFacts] = await Promise.all([
      this.fetchAgentCard(agentAddr),
      agentAddr.primary_facts_url
        ? this.fetchAgentFacts(agentAddr.primary_facts_url)
        : Promise.resolve(undefined),
    ]);

    return {
      agentAddr,
      agentCard,
      agentFacts,
      endpoints: this.extractEndpoints(agentAddr, agentCard),
      resolvedAt: new Date(),
    };
  }

  /**
   * Resolve handle from registries
   */
  private async resolveHandle(handle: string): Promise<AgentAddr | null> {
    if (this.config.parallel) {
      // Try all registries in parallel
      const results = await Promise.allSettled(
        this.clients.map((client) => client.resolve(handle))
      );

      // Return first successful result
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          return result.value;
        }
      }
      return null;
    } else {
      // Try registries sequentially
      for (const client of this.clients) {
        try {
          const result = await client.resolve(handle);
          if (result) return result;
        } catch {
          // Continue to next registry
        }
      }
      return null;
    }
  }

  /**
   * Search across all registries
   */
  async search(
    params: Parameters<IndexClient['search']>[0]
  ): Promise<AgentAddr[]> {
    const results = await Promise.allSettled(
      this.clients.map((client) => client.search(params))
    );

    const agents: AgentAddr[] = [];
    const seenIds = new Set<string>();

    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const agent of result.value.agents) {
          if (!seenIds.has(agent.agent_id)) {
            seenIds.add(agent.agent_id);
            agents.push(agent);
          }
        }
      }
    }

    return agents;
  }

  /**
   * Fetch Agent Card from agent's endpoint
   */
  private async fetchAgentCard(
    agentAddr: AgentAddr
  ): Promise<AgentCard | undefined> {
    try {
      // Try to derive base URL from facts URL
      const baseUrl = new URL(agentAddr.primary_facts_url).origin;
      const cardUrl = getAgentCardUrl(baseUrl);

      const response = await fetch(cardUrl, {
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (response.ok) {
        const data = await response.json();
        return parseAgentCard(data);
      }
    } catch {
      // Agent Card is optional
    }
    return undefined;
  }

  /**
   * Fetch AgentFacts from facts URL
   */
  private async fetchAgentFacts(
    factsUrl: string
  ): Promise<AgentFacts | undefined> {
    try {
      const response = await fetch(factsUrl, {
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (response.ok) {
        return response.json();
      }
    } catch {
      // AgentFacts is optional
    }
    return undefined;
  }

  /**
   * Extract endpoints from agent data
   */
  private extractEndpoints(
    agentAddr: AgentAddr,
    card?: AgentCard
  ): AgentEndpoints {
    const endpoints: AgentEndpoints = {
      facts: agentAddr.primary_facts_url,
    };

    // Use adaptive resolver if available
    if (agentAddr.adaptive_resolver_url) {
      endpoints.a2a = agentAddr.adaptive_resolver_url;
    } else if (card?.url) {
      endpoints.a2a = card.url;
    } else {
      // Derive from facts URL
      endpoints.a2a = new URL(agentAddr.primary_facts_url).origin;
    }

    // Add health endpoint
    if (endpoints.a2a) {
      endpoints.health = `${endpoints.a2a}/health`;
    }

    return endpoints;
  }

  /**
   * Add a registry to the quilt
   */
  addRegistry(config: RegistryConfig): void {
    this.clients.push(new IndexClient(config));
  }

  /**
   * Remove a registry from the quilt
   */
  removeRegistry(baseUrl: string): void {
    const index = this.clients.findIndex((c) => c.baseUrl === baseUrl);
    if (index !== -1) {
      this.clients[index].close();
      this.clients.splice(index, 1);
    }
  }

  /**
   * Get the number of registries
   */
  get registryCount(): number {
    return this.clients.length;
  }

  /**
   * Close all clients
   */
  close(): void {
    for (const client of this.clients) {
      client.close();
    }
    this.clients = [];
  }
}

/**
 * Create a quilt resolver with default NANDA registry
 */
export function createQuiltResolver(
  additionalRegistries: RegistryConfig[] = []
): QuiltResolver {
  return new QuiltResolver({
    registries: [
      { baseUrl: 'https://api.projectnanda.org/v1' },
      ...additionalRegistries,
    ],
  });
}
