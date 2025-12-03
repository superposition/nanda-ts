/**
 * A2A Agent Server
 *
 * Bun-native HTTP server for hosting A2A-compliant agents.
 */

type BunServer = ReturnType<typeof Bun.serve>;
import type {
  AgentCard,
  Skill,
  AgentCapabilities,
  Provider,
  Task,
  Message,
  MessageSendParams,
} from '../types';
import { createAgentCard } from '../types';
import { A2AHandler, type RequestContext, type MethodHandler } from './A2AHandler';
import { createHealthCheckHandler, type HealthCheckConfig } from './HealthCheck';
import { AGENT_CARD_PATH } from '../protocols/a2a/AgentCard';

/**
 * Agent Server configuration
 */
export interface AgentServerConfig {
  name: string;
  description: string;
  version?: string;
  port?: number;
  hostname?: string;
  skills?: Skill[];
  capabilities?: Partial<AgentCapabilities>;
  provider?: Provider;
  healthChecks?: HealthCheckConfig['checks'];
}

/**
 * Message handler function type
 */
export type MessageHandler = (
  params: MessageSendParams,
  context: MessageContext
) => Promise<Task>;

/**
 * Context provided to message handlers
 */
export interface MessageContext extends RequestContext {
  server: AgentServer;
  createTask: (message: Message, contextId?: string) => Task;
  updateTaskState: (taskId: string, state: Task['state']) => Task | undefined;
}

/**
 * A2A Agent Server
 *
 * Uses Bun.serve() to host an A2A-compliant agent.
 */
export class AgentServer {
  private config: Required<AgentServerConfig>;
  private server: BunServer | null = null;
  private a2aHandler: A2AHandler;
  private agentCard: AgentCard;
  private healthHandler: () => Promise<Response>;
  private isStarted = false;

  constructor(config: AgentServerConfig) {
    this.config = {
      version: '1.0.0',
      port: 3000,
      hostname: '0.0.0.0',
      skills: [],
      capabilities: {},
      provider: {},
      healthChecks: {},
      ...config,
    };

    this.a2aHandler = new A2AHandler();
    this.agentCard = createAgentCard(
      {
        name: this.config.name,
        description: this.config.description,
        version: this.config.version,
        skills: this.config.skills,
        capabilities: this.config.capabilities,
        provider: this.config.provider,
      },
      `http://${this.config.hostname}:${this.config.port}`
    );

    this.healthHandler = createHealthCheckHandler({
      agentName: this.config.name,
      version: this.config.version,
      checks: this.config.healthChecks,
    });
  }

  /**
   * Get the server port
   */
  get port(): number {
    return this.config.port;
  }

  /**
   * Get the Agent Card
   */
  getAgentCard(): AgentCard {
    return this.agentCard;
  }

  /**
   * Check if the server is running
   */
  isRunning(): boolean {
    return this.isStarted && this.server !== null;
  }

  /**
   * Register a method handler
   */
  on<TParams = unknown, TResult = unknown>(
    method: string,
    handler: MethodHandler<TParams, TResult>
  ): this {
    this.a2aHandler.register(method, handler);
    return this;
  }

  /**
   * Handle incoming messages - main entry point for agents
   */
  onMessage(handler: MessageHandler): this {
    this.a2aHandler.register('message/send', async (params, context) => {
      const messageParams = params as MessageSendParams;
      const messageContext: MessageContext = {
        ...context,
        server: this,
        createTask: (message, contextId) =>
          this.a2aHandler.createTask(message, contextId),
        updateTaskState: (taskId, state) =>
          this.a2aHandler.updateTaskState(taskId, state),
      };
      return handler(messageParams, messageContext);
    });
    return this;
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

    this.server = Bun.serve({
      port: this.config.port,
      hostname: this.config.hostname,
      fetch: this.handleRequest.bind(this),
    });

    this.isStarted = true;

    // Update agent card URL with actual server info
    this.agentCard.url = `http://${this.config.hostname}:${this.server.port}`;

    console.log(
      `Agent "${this.config.name}" listening on ${this.config.hostname}:${this.server.port}`
    );
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (this.server) {
      this.server.stop();
      this.server = null;
    }
    this.isStarted = false;
  }

  /**
   * Main request handler
   */
  private async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Add CORS headers to all responses
    const addCorsHeaders = (response: Response): Response => {
      response.headers.set('Access-Control-Allow-Origin', '*');
      return response;
    };

    try {
      // Agent Card discovery endpoint
      if (path === AGENT_CARD_PATH && method === 'GET') {
        return addCorsHeaders(Response.json(this.agentCard));
      }

      // Health check endpoints
      if (path === '/health' && method === 'GET') {
        return addCorsHeaders(await this.healthHandler());
      }

      if (path === '/healthz' && method === 'GET') {
        return addCorsHeaders(Response.json({ status: 'ok' }));
      }

      if (path === '/readyz' && method === 'GET') {
        return addCorsHeaders(
          Response.json({ status: this.isStarted ? 'ok' : 'not ready' })
        );
      }

      // A2A JSON-RPC endpoint
      if (path === '/rpc' && method === 'POST') {
        const accept = request.headers.get('Accept') || '';
        if (accept.includes('text/event-stream')) {
          return addCorsHeaders(await this.a2aHandler.handleStream(request));
        }
        return addCorsHeaders(await this.a2aHandler.handle(request));
      }

      // A2A JSON-RPC with explicit streaming endpoint
      if (path === '/rpc/stream' && method === 'POST') {
        return addCorsHeaders(await this.a2aHandler.handleStream(request));
      }

      // Not found
      return addCorsHeaders(
        new Response('Not Found', { status: 404 })
      );
    } catch (error) {
      console.error('Request error:', error);
      return addCorsHeaders(
        Response.json(
          {
            error: {
              code: -32603,
              message: 'Internal server error',
            },
          },
          { status: 500 }
        )
      );
    }
  }
}

/**
 * Create a new agent server
 */
export function createAgentServer(config: AgentServerConfig): AgentServer {
  return new AgentServer(config);
}
