/**
 * NandaClient - Unified client for the NANDA ecosystem
 *
 * Main entry point for interacting with A2A agents, registry, and protocols.
 */

import type {
  AgentCard,
  Task,
  TaskUpdate,
  SearchAgentsParams,
  SearchAgentsResult,
  FullyResolvedAgent,
} from '../types';
import { DiscoveryError, isUrl, isDid } from '../types';
import { A2AClient } from '../protocols/a2a/A2AClient';
import { IndexClient } from '../registry/IndexClient';
import { QuiltResolver } from '../registry/QuiltResolver';

/**
 * NandaClient configuration
 */
export interface NandaClientConfig {
  registryUrl?: string;
  apiKey?: string;
  cacheEnabled?: boolean;
  timeout?: number;
  additionalRegistries?: { baseUrl: string; apiKey?: string }[];
}

/**
 * Connection to an agent
 */
export class AgentConnection {
  constructor(
    private client: A2AClient,
    public readonly agentCard: AgentCard
  ) {}

  /**
   * Send a text message to the agent
   */
  async send(text: string, contextId?: string): Promise<Task> {
    return this.client.send(text, contextId);
  }

  /**
   * Send a message with streaming response
   */
  async *stream(
    text: string,
    contextId?: string
  ): AsyncGenerator<TaskUpdate, void, unknown> {
    yield* this.client.stream(text, contextId);
  }

  /**
   * Get task status
   */
  async getTask(taskId: string): Promise<Task> {
    return this.client.get(taskId);
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<Task> {
    return this.client.cancel(taskId);
  }

  /**
   * Subscribe to task updates
   */
  async *subscribe(taskId: string): AsyncGenerator<TaskUpdate, void, unknown> {
    yield* this.client.subscribeToTask(taskId);
  }

  /**
   * Get the underlying A2A client
   */
  getClient(): A2AClient {
    return this.client;
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    await this.client.close();
  }
}

/**
 * NandaClient - Main SDK client
 */
export class NandaClient {
  private indexClient: IndexClient;
  private quiltResolver: QuiltResolver;
  private agentClients: Map<string, A2AClient> = new Map();
  private config: Required<NandaClientConfig>;

  constructor(config: NandaClientConfig = {}) {
    this.config = {
      registryUrl: 'https://api.projectnanda.org/v1',
      apiKey: undefined as unknown as string,
      cacheEnabled: true,
      timeout: 30000,
      additionalRegistries: [],
      ...config,
    };

    this.indexClient = new IndexClient({
      baseUrl: this.config.registryUrl,
      apiKey: this.config.apiKey,
      cacheEnabled: this.config.cacheEnabled,
    });

    this.quiltResolver = new QuiltResolver({
      registries: [
        { baseUrl: this.config.registryUrl, apiKey: this.config.apiKey },
        ...this.config.additionalRegistries,
      ],
    });
  }

  /**
   * Connect to an agent by handle, URL, or DID
   */
  async connect(identifier: string): Promise<AgentConnection> {
    let endpoint: string;
    let agentCard: AgentCard;

    if (isUrl(identifier)) {
      // Direct URL
      endpoint = identifier;
      const client = this.getOrCreateClient(endpoint);
      agentCard = await client.discover();
    } else if (isDid(identifier)) {
      // DID - resolve through registry
      const resolved = await this.resolve(identifier);
      if (!resolved || !resolved.endpoints.a2a) {
        throw new DiscoveryError(`Agent not found: ${identifier}`, identifier);
      }
      endpoint = resolved.endpoints.a2a;
      agentCard = resolved.agentCard!;
    } else {
      // Handle (e.g., @org/agent)
      const resolved = await this.resolve(identifier);
      if (!resolved || !resolved.endpoints.a2a) {
        throw new DiscoveryError(`Agent not found: ${identifier}`, identifier);
      }
      endpoint = resolved.endpoints.a2a;
      agentCard =
        resolved.agentCard ??
        (await this.getOrCreateClient(endpoint).discover());
    }

    const client = this.getOrCreateClient(endpoint);
    return new AgentConnection(client, agentCard);
  }

  /**
   * Resolve an agent handle to its full details
   */
  async resolve(handle: string): Promise<FullyResolvedAgent | null> {
    return this.quiltResolver.resolve(handle);
  }

  /**
   * Search for agents in the registry
   */
  async search(params: SearchAgentsParams): Promise<SearchAgentsResult> {
    return this.indexClient.search(params);
  }

  /**
   * Discover agents by capability
   */
  async discover(capability: string): Promise<string[]> {
    const results = await this.search({ capabilities: [capability] });
    return results.agents.map((a) => a.agent_name);
  }

  /**
   * Register an agent in the registry
   */
  async register(handle: string, factsUrl: string): Promise<void> {
    await this.indexClient.register({ handle, facts_url: factsUrl });
  }

  /**
   * Get or create an A2A client for an endpoint
   */
  private getOrCreateClient(endpoint: string): A2AClient {
    let client = this.agentClients.get(endpoint);
    if (!client) {
      client = new A2AClient({
        agentUrl: endpoint,
        timeout: this.config.timeout,
      });
      this.agentClients.set(endpoint, client);
    }
    return client;
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    for (const client of this.agentClients.values()) {
      await client.close();
    }
    this.agentClients.clear();
    this.indexClient.close();
    this.quiltResolver.close();
  }
}

/**
 * Create a new NandaClient
 */
export function createNandaClient(config?: NandaClientConfig): NandaClient {
  return new NandaClient(config);
}
