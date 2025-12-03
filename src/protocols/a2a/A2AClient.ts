/**
 * A2A (Agent-to-Agent) Protocol Client
 *
 * Implements Google's A2A protocol v0.3.0 for agent communication.
 */

import type {
  AgentCard,
  JsonRpcRequest,
  JsonRpcResponse,
  Task,
  TaskUpdate,
  MessageSendParams,
  TasksGetParams,
  TasksListParams,
  TasksCancelParams,
  TasksListResponse,
} from '../../types';
import {
  DiscoveryError,
  JsonRpcError,
  TimeoutError,
  ConnectionError,
} from '../../types';
import { parseSSEStream } from './streaming';
import { getAgentCardUrl, parseAgentCard } from './AgentCard';

/**
 * A2A Client configuration
 */
export interface A2AClientConfig {
  agentUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
  onError?: (error: Error) => void;
}

/**
 * Default configuration values
 */
const DEFAULT_TIMEOUT = 30000;

/**
 * A2A Protocol Client
 *
 * Provides methods to communicate with A2A-compliant agents.
 */
export class A2AClient {
  private config: Required<A2AClientConfig>;
  private agentCard: AgentCard | null = null;
  private requestIdCounter = 0;

  constructor(config: A2AClientConfig) {
    this.config = {
      timeout: DEFAULT_TIMEOUT,
      headers: {},
      onError: console.error,
      ...config,
    };
  }

  /**
   * Get the agent URL
   */
  get url(): string {
    return this.config.agentUrl;
  }

  /**
   * Discover agent capabilities by fetching Agent Card
   */
  async discover(): Promise<AgentCard> {
    const url = getAgentCardUrl(this.config.agentUrl);

    try {
      const response = await fetch(url, {
        headers: this.config.headers,
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new DiscoveryError(
          `Failed to fetch agent card: ${response.status} ${response.statusText}`,
          this.config.agentUrl
        );
      }

      const data = await response.json();
      this.agentCard = parseAgentCard(data);
      return this.agentCard;
    } catch (error) {
      if (error instanceof DiscoveryError) throw error;
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new TimeoutError(
          `Agent card fetch timed out after ${this.config.timeout}ms`,
          this.config.timeout
        );
      }
      throw new ConnectionError(
        `Failed to connect to agent: ${error instanceof Error ? error.message : String(error)}`,
        this.config.agentUrl
      );
    }
  }

  /**
   * Get the cached Agent Card (call discover() first)
   */
  getAgentCard(): AgentCard | null {
    return this.agentCard;
  }

  /**
   * Send a message to the agent (message/send method)
   */
  async sendMessage(params: MessageSendParams): Promise<Task> {
    return this.rpc<Task>('message/send', params);
  }

  /**
   * Send a text message (convenience method)
   */
  async send(text: string, contextId?: string): Promise<Task> {
    return this.sendMessage({
      message: {
        role: 'user',
        parts: [{ type: 'text', text }],
      },
      contextId,
    });
  }

  /**
   * Send a message with streaming response
   */
  async *sendMessageStream(
    params: MessageSendParams
  ): AsyncGenerator<TaskUpdate, void, unknown> {
    const url = new URL('/rpc', this.config.agentUrl);
    const request: JsonRpcRequest<MessageSendParams> = {
      jsonrpc: '2.0',
      method: 'message/send',
      params: {
        ...params,
        configuration: {
          ...params.configuration,
          streaming: true,
        },
      },
      id: this.generateRequestId(),
    };

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...this.config.headers,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new ConnectionError(
        `Stream request failed: ${response.status} ${response.statusText}`,
        this.config.agentUrl
      );
    }

    if (!response.body) {
      throw new ConnectionError('No response body for streaming', this.config.agentUrl);
    }

    yield* parseSSEStream<TaskUpdate>(response.body);
  }

  /**
   * Stream a text message (convenience method)
   */
  async *stream(
    text: string,
    contextId?: string
  ): AsyncGenerator<TaskUpdate, void, unknown> {
    yield* this.sendMessageStream({
      message: {
        role: 'user',
        parts: [{ type: 'text', text }],
      },
      contextId,
    });
  }

  /**
   * Get task by ID (tasks/get method)
   */
  async getTask(params: TasksGetParams): Promise<Task> {
    return this.rpc<Task>('tasks/get', params);
  }

  /**
   * Get task by ID (convenience method)
   */
  async get(taskId: string): Promise<Task> {
    return this.getTask({ taskId });
  }

  /**
   * List tasks (tasks/list method)
   */
  async listTasks(params?: TasksListParams): Promise<TasksListResponse> {
    return this.rpc<TasksListResponse>('tasks/list', params);
  }

  /**
   * Cancel a task (tasks/cancel method)
   */
  async cancelTask(params: TasksCancelParams): Promise<Task> {
    return this.rpc<Task>('tasks/cancel', params);
  }

  /**
   * Cancel a task (convenience method)
   */
  async cancel(taskId: string): Promise<Task> {
    return this.cancelTask({ taskId });
  }

  /**
   * Subscribe to task updates (tasks/subscribe method - SSE)
   */
  async *subscribeToTask(taskId: string): AsyncGenerator<TaskUpdate, void, unknown> {
    const url = new URL('/rpc', this.config.agentUrl);
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method: 'tasks/subscribe',
      params: { taskId },
      id: this.generateRequestId(),
    };

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...this.config.headers,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new ConnectionError(
        `Subscribe request failed: ${response.status}`,
        this.config.agentUrl
      );
    }

    if (!response.body) {
      throw new ConnectionError('No response body for subscription', this.config.agentUrl);
    }

    yield* parseSSEStream<TaskUpdate>(response.body);
  }

  /**
   * Make a raw JSON-RPC call
   */
  async rpc<TResult>(method: string, params?: unknown): Promise<TResult> {
    const url = new URL('/rpc', this.config.agentUrl);
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: this.generateRequestId(),
    };

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new ConnectionError(
          `RPC request failed: ${response.status} ${response.statusText}`,
          this.config.agentUrl
        );
      }

      const jsonResponse: JsonRpcResponse<TResult> = await response.json();

      if (jsonResponse.error) {
        throw new JsonRpcError(
          jsonResponse.error.message,
          jsonResponse.error.code,
          jsonResponse.error.data
        );
      }

      return jsonResponse.result!;
    } catch (error) {
      if (
        error instanceof JsonRpcError ||
        error instanceof ConnectionError
      ) {
        throw error;
      }
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new TimeoutError(
          `RPC request timed out after ${this.config.timeout}ms`,
          this.config.timeout
        );
      }
      throw new ConnectionError(
        `RPC request failed: ${error instanceof Error ? error.message : String(error)}`,
        this.config.agentUrl
      );
    }
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req-${++this.requestIdCounter}-${Date.now()}`;
  }

  /**
   * Close the client (cleanup)
   */
  async close(): Promise<void> {
    // Currently stateless, but included for future connection pooling
    this.agentCard = null;
  }
}

/**
 * Create a new A2A client
 */
export function createA2AClient(config: A2AClientConfig): A2AClient {
  return new A2AClient(config);
}
