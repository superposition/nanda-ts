/**
 * NandaClient Unit Tests
 *
 * Tests for the unified NANDA ecosystem client.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  NandaClient,
  AgentConnection,
  createNandaClient,
} from '../../src/client/NandaClient';
import { AgentServer } from '../../src/server/AgentServer';
import { DiscoveryError } from '../../src/types';

// Helper to get port from AgentServer after start
function getServerPort(server: AgentServer): number {
  const url = new URL(server.getAgentCard().url);
  return parseInt(url.port, 10);
}

describe('NandaClient', () => {
  describe('constructor', () => {
    it('should create client with default config', () => {
      const client = new NandaClient();
      expect(client).toBeInstanceOf(NandaClient);
    });

    it('should accept custom registry URL', () => {
      const client = new NandaClient({
        registryUrl: 'https://custom-registry.example.com',
      });
      expect(client).toBeDefined();
    });

    it('should accept API key', () => {
      const client = new NandaClient({
        apiKey: 'test-api-key',
      });
      expect(client).toBeDefined();
    });

    it('should accept cache enabled flag', () => {
      const client = new NandaClient({
        cacheEnabled: false,
      });
      expect(client).toBeDefined();
    });

    it('should accept custom timeout', () => {
      const client = new NandaClient({
        timeout: 5000,
      });
      expect(client).toBeDefined();
    });

    it('should accept additional registries', () => {
      const client = new NandaClient({
        additionalRegistries: [
          { baseUrl: 'https://registry2.example.com' },
          { baseUrl: 'https://registry3.example.com', apiKey: 'key3' },
        ],
      });
      expect(client).toBeDefined();
    });

    it('should accept full config', () => {
      const client = new NandaClient({
        registryUrl: 'https://custom.example.com',
        apiKey: 'my-key',
        cacheEnabled: true,
        timeout: 10000,
        additionalRegistries: [{ baseUrl: 'https://alt.example.com' }],
      });
      expect(client).toBeDefined();
    });
  });

  describe('close', () => {
    it('should close without error', async () => {
      const client = new NandaClient();
      await expect(client.close()).resolves.toBeUndefined();
    });

    it('should be callable multiple times', async () => {
      const client = new NandaClient();
      await client.close();
      await expect(client.close()).resolves.toBeUndefined();
    });
  });
});

describe('NandaClient.connect with URL', () => {
  let server: AgentServer;
  let client: NandaClient;
  let port: number;

  beforeEach(async () => {
    server = new AgentServer({
      name: 'test-agent',
      description: 'Test agent for NandaClient',
      version: '1.0.0',
      port: 0,
      skills: [
        {
          id: 'echo',
          name: 'Echo',
          description: 'Echo messages',
          inputModes: ['text'],
          outputModes: ['text'],
        },
      ],
    });

    server.onMessage(async (params, ctx) => {
      const textPart = params.message.parts.find((p) => p.type === 'text');
      const text = textPart?.type === 'text' ? textPart.text : '';
      const task = ctx.createTask(
        { role: 'agent', parts: [{ type: 'text', text: `Echo: ${text}` }] },
        params.contextId
      );
      ctx.updateTaskState(task.id, 'COMPLETED');
      return { ...task, state: 'COMPLETED' as const };
    });

    await server.start();
    port = getServerPort(server);
    client = new NandaClient({ timeout: 5000 });
  });

  afterEach(async () => {
    await client.close();
    await server.stop();
  });

  it('should connect to agent by URL', async () => {
    const connection = await client.connect(`http://localhost:${port}`);

    expect(connection).toBeInstanceOf(AgentConnection);
    expect(connection.agentCard.name).toBe('test-agent');
  });

  it('should reuse client for same endpoint', async () => {
    const conn1 = await client.connect(`http://localhost:${port}`);
    const conn2 = await client.connect(`http://localhost:${port}`);

    // Both should have same underlying client (connection reuse)
    expect(conn1.getClient()).toBe(conn2.getClient());
  });

  it('should throw on connection error', async () => {
    await expect(client.connect('http://localhost:99999')).rejects.toThrow();
  });
});

describe('AgentConnection', () => {
  let server: AgentServer;
  let client: NandaClient;
  let connection: AgentConnection;
  let port: number;

  beforeEach(async () => {
    server = new AgentServer({
      name: 'connection-test-agent',
      description: 'Test agent for AgentConnection',
      version: '1.0.0',
      port: 0,
      skills: [
        {
          id: 'test',
          name: 'Test',
          description: 'Test skill',
          inputModes: ['text'],
          outputModes: ['text'],
        },
      ],
    });

    server.onMessage(async (params, ctx) => {
      const textPart = params.message.parts.find((p) => p.type === 'text');
      const text = textPart?.type === 'text' ? textPart.text : '';
      const task = ctx.createTask(
        { role: 'agent', parts: [{ type: 'text', text: `Response: ${text}` }] },
        params.contextId
      );
      ctx.updateTaskState(task.id, 'COMPLETED');
      return { ...task, state: 'COMPLETED' as const };
    });

    await server.start();
    port = getServerPort(server);
    client = new NandaClient({ timeout: 5000 });
    connection = await client.connect(`http://localhost:${port}`);
  });

  afterEach(async () => {
    await connection.close();
    await client.close();
    await server.stop();
  });

  describe('agentCard', () => {
    it('should expose agent card', () => {
      expect(connection.agentCard).toBeDefined();
      expect(connection.agentCard.name).toBe('connection-test-agent');
    });
  });

  describe('send', () => {
    it('should send message and receive task', async () => {
      const task = await connection.send('Hello');

      expect(task).toBeDefined();
      expect(task.state).toBe('COMPLETED');
      expect(task.message?.parts[0]).toEqual({
        type: 'text',
        text: 'Response: Hello',
      });
    });

    it('should accept contextId', async () => {
      const contextId = 'test-context-123';
      const task = await connection.send('With context', contextId);

      expect(task.contextId).toBe(contextId);
    });
  });

  describe('getTask', () => {
    it('should get task by ID', async () => {
      const created = await connection.send('Create task');
      const retrieved = await connection.getTask(created.id);

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.state).toBe('COMPLETED');
    });
  });

  describe('getClient', () => {
    it('should return underlying A2A client', () => {
      const a2aClient = connection.getClient();

      expect(a2aClient).toBeDefined();
      expect(typeof a2aClient.discover).toBe('function');
    });
  });

  describe('close', () => {
    it('should close without error', async () => {
      await expect(connection.close()).resolves.toBeUndefined();
    });
  });
});

describe('NandaClient with mock registry', () => {
  let registryServer: ReturnType<typeof Bun.serve>;
  let agentServer: AgentServer;
  let client: NandaClient;
  let agentPort: number;

  beforeEach(async () => {
    // Create agent server first
    agentServer = new AgentServer({
      name: 'registry-test-agent',
      description: 'Agent for registry tests',
      version: '1.0.0',
      port: 0,
      skills: [],
    });

    agentServer.onMessage(async (params, ctx) => {
      const task = ctx.createTask(
        { role: 'agent', parts: [{ type: 'text', text: 'OK' }] },
        params.contextId
      );
      ctx.updateTaskState(task.id, 'COMPLETED');
      return { ...task, state: 'COMPLETED' as const };
    });

    await agentServer.start();
    agentPort = getServerPort(agentServer);

    // Create mock registry server with port 0
    registryServer = Bun.serve({
      port: 0,
      fetch(req: Request): Response {
        const url = new URL(req.url);

        // Handle resolve endpoint: GET /agents/{handle}
        if (url.pathname.startsWith('/agents/') && req.method === 'GET') {
          // Check if it's the search endpoint
          if (url.pathname === '/agents/search') {
            return new Response(
              JSON.stringify({
                agents: [
                  {
                    agent_id: 'agent-1',
                    agent_name: '@org/agent-1',
                    primary_facts_url: 'https://example.com/facts.json',
                  },
                ],
                total: 1,
                page: 1,
                limit: 10,
              }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          }

          const handle = decodeURIComponent(url.pathname.slice('/agents/'.length));

          if (handle === 'test-org/test-agent' || handle === '@test-org/test-agent') {
            return new Response(
              JSON.stringify({
                agent_id: 'agent-123',
                agent_name: '@test-org/test-agent',
                primary_facts_url: `http://localhost:${agentPort}/facts.json`,
                adaptive_resolver_url: `http://localhost:${agentPort}`,
              }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          }

          return new Response('Not Found', { status: 404 });
        }

        // Handle register endpoint: POST /agents
        if (url.pathname === '/agents' && req.method === 'POST') {
          return new Response(
            JSON.stringify({ success: true, agent_id: 'new-agent-id' }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response('Not Found', { status: 404 });
      },
    });

    client = new NandaClient({
      registryUrl: `http://localhost:${registryServer.port}`,
      timeout: 5000,
    });
  });

  afterEach(async () => {
    await client.close();
    await agentServer.stop();
    registryServer.stop();
  });

  describe('connect with handle', () => {
    it('should resolve handle and connect', async () => {
      const connection = await client.connect('@test-org/test-agent');

      expect(connection).toBeInstanceOf(AgentConnection);
      expect(connection.agentCard.name).toBe('registry-test-agent');
    });

    it('should throw DiscoveryError for unknown handle', async () => {
      try {
        await client.connect('@unknown/agent');
        expect(true).toBe(false); // Should not reach
      } catch (error) {
        expect(error).toBeInstanceOf(DiscoveryError);
        expect((error as DiscoveryError).message).toContain('Agent not found');
      }
    });
  });

  describe('search', () => {
    it('should search agents by query', async () => {
      const results = await client.search({ query: 'test' });

      expect(results.agents).toHaveLength(1);
      expect(results.agents[0].agent_name).toBe('@org/agent-1');
    });
  });

  describe('discover', () => {
    it('should discover agents by capability', async () => {
      const agents = await client.discover('translation');

      expect(agents).toBeInstanceOf(Array);
      expect(agents).toContain('@org/agent-1');
    });
  });

  describe('register', () => {
    it('should register agent without error', async () => {
      await expect(
        client.register('my-agent', 'https://example.com/facts.json')
      ).resolves.toBeUndefined();
    });
  });
});

describe('NandaClient.connect with DID', () => {
  let registryServer: ReturnType<typeof Bun.serve>;
  let agentServer: AgentServer;
  let client: NandaClient;
  let agentPort: number;

  beforeEach(async () => {
    // Create agent server first
    agentServer = new AgentServer({
      name: 'did-test-agent',
      description: 'Agent for DID tests',
      version: '1.0.0',
      port: 0,
      skills: [],
    });

    agentServer.onMessage(async (params, ctx) => {
      const task = ctx.createTask(
        { role: 'agent', parts: [{ type: 'text', text: 'DID OK' }] },
        params.contextId
      );
      ctx.updateTaskState(task.id, 'COMPLETED');
      return { ...task, state: 'COMPLETED' as const };
    });

    await agentServer.start();
    agentPort = getServerPort(agentServer);

    // Create mock registry that resolves DIDs
    registryServer = Bun.serve({
      port: 0,
      fetch(req: Request): Response {
        const url = new URL(req.url);

        // Handle resolve endpoint: GET /agents/{identifier}
        if (url.pathname.startsWith('/agents/') && req.method === 'GET') {
          const identifier = decodeURIComponent(url.pathname.slice('/agents/'.length));

          if (identifier.startsWith('did:key:z')) {
            return new Response(
              JSON.stringify({
                agent_id: 'did-agent',
                agent_name: '@did/agent',
                primary_facts_url: `http://localhost:${agentPort}/facts.json`,
                adaptive_resolver_url: `http://localhost:${agentPort}`,
              }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          }

          return new Response('Not Found', { status: 404 });
        }

        return new Response('Not Found', { status: 404 });
      },
    });

    client = new NandaClient({
      registryUrl: `http://localhost:${registryServer.port}`,
      timeout: 5000,
    });
  });

  afterEach(async () => {
    await client.close();
    await agentServer.stop();
    registryServer.stop();
  });

  it('should resolve DID and connect', async () => {
    const connection = await client.connect('did:key:z6MkTestDid123');

    expect(connection).toBeInstanceOf(AgentConnection);
    expect(connection.agentCard.name).toBe('did-test-agent');
  });

  it('should throw for unresolvable DID', async () => {
    try {
      await client.connect('did:unknown:xyz');
      expect(true).toBe(false); // Should not reach
    } catch (error) {
      expect(error).toBeInstanceOf(DiscoveryError);
    }
  });
});

describe('createNandaClient', () => {
  it('should create NandaClient instance', () => {
    const client = createNandaClient();
    expect(client).toBeInstanceOf(NandaClient);
  });

  it('should accept config', () => {
    const client = createNandaClient({
      registryUrl: 'https://custom.example.com',
      timeout: 10000,
    });
    expect(client).toBeInstanceOf(NandaClient);
  });
});
