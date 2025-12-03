/**
 * Integration Test: Agent Registration Flow
 *
 * Tests the complete agent registration, discovery, and connection flow.
 * Each test is fully self-contained to avoid concurrency issues.
 */

import { describe, it, expect } from 'bun:test';
import { AgentServer } from '../../src/server/AgentServer';
import { NandaClient } from '../../src/client/NandaClient';
import { createMinimalAgentFacts } from '../../src/agent/AgentFacts';
import type { AgentFacts } from '../../src/types';

interface TestContext {
  agentServer: AgentServer;
  registryServer: ReturnType<typeof Bun.serve>;
  factsServer: ReturnType<typeof Bun.serve>;
  client: NandaClient;
  agentPort: number;
  registryPort: number;
  factsPort: number;
  localRegistry: Map<string, {
    agent_id: string;
    agent_name: string;
    primary_facts_url: string;
    adaptive_resolver_url: string;
  }>;
  agentFacts: AgentFacts;
}

async function createTestContext(): Promise<TestContext> {
  // Create isolated registry for this test
  const localRegistry = new Map<string, {
    agent_id: string;
    agent_name: string;
    primary_facts_url: string;
    adaptive_resolver_url: string;
  }>();

  // Create AgentFacts
  const agentFacts = createMinimalAgentFacts(
    'test-agent-001',
    '@test-org/my-agent',
    'A test agent for registration flow',
    'Test Organization',
    'gpt-4'
  );

  // Create AgentFacts server with port 0 (OS assigns available port)
  const factsServer = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === '/facts.json') {
        return Response.json(agentFacts);
      }
      return new Response('Not Found', { status: 404 });
    },
  });
  const factsPort = factsServer.port;

  // Create agent server with port 0
  const agentServer = new AgentServer({
    name: 'my-agent',
    description: 'A test agent',
    version: '1.0.0',
    port: 0,
    skills: [
      {
        id: 'greet',
        name: 'Greeting',
        description: 'Greet users',
        inputModes: ['text'],
        outputModes: ['text'],
      },
    ],
  });

  agentServer.onMessage(async (params, ctx) => {
    const textPart = params.message.parts.find((p) => p.type === 'text');
    const text = textPart?.type === 'text' ? textPart.text : '';

    const task = ctx.createTask(
      {
        role: 'agent',
        parts: [{ type: 'text', text: `Hello! You said: ${text}` }],
      },
      params.contextId
    );
    ctx.updateTaskState(task.id, 'COMPLETED');
    return { ...task, state: 'COMPLETED' as const };
  });

  await agentServer.start();
  // Get actual port from agentCard URL after server starts
  const agentCardUrl = new URL(agentServer.getAgentCard().url);
  const agentPort = parseInt(agentCardUrl.port, 10);

  // Create mock registry server with port 0
  const registryServer = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);

      // POST /agents - Register agent
      if (url.pathname === '/agents' && req.method === 'POST') {
        const body = await req.json() as {
          handle: string;
          facts_url: string;
        };

        const agentData = {
          agent_id: `agent-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          agent_name: body.handle,
          primary_facts_url: body.facts_url,
          adaptive_resolver_url: `http://localhost:${agentPort}`,
        };

        localRegistry.set(body.handle, agentData);

        return Response.json({ success: true, agent_id: agentData.agent_id });
      }

      // GET /agents/search - Search agents
      if (url.pathname === '/agents/search' && req.method === 'GET') {
        // IndexClient uses 'q' as the query parameter name
        const query = url.searchParams.get('q') || '';
        const agents = Array.from(localRegistry.values()).filter(
          (a) => query === '' || a.agent_name.toLowerCase().includes(query.toLowerCase())
        );

        return Response.json({
          agents,
          total: agents.length,
          page: 1,
          limit: 10,
        });
      }

      // GET /agents/{handle} - Resolve agent
      if (url.pathname.startsWith('/agents/') && req.method === 'GET') {
        const handle = decodeURIComponent(url.pathname.slice('/agents/'.length));

        // Check both with and without @ prefix
        const agent = localRegistry.get(handle) || localRegistry.get(`@${handle}`);

        if (agent) {
          return Response.json(agent);
        }

        return new Response('Agent not found', { status: 404 });
      }

      return new Response('Not Found', { status: 404 });
    },
  });
  const registryPort = registryServer.port;

  // Create client with mock registry
  const client = new NandaClient({
    registryUrl: `http://localhost:${registryPort}`,
    timeout: 5000,
  });

  return {
    agentServer,
    registryServer,
    factsServer,
    client,
    agentPort,
    registryPort,
    factsPort,
    localRegistry,
    agentFacts,
  };
}

async function destroyTestContext(ctx: TestContext): Promise<void> {
  await ctx.client.close();
  await ctx.agentServer.stop();
  ctx.registryServer.stop();
  ctx.factsServer.stop();
}

// Helper to run test with isolated context
async function withContext(
  testFn: (ctx: TestContext) => Promise<void>
): Promise<void> {
  const ctx = await createTestContext();
  try {
    await testFn(ctx);
  } finally {
    await destroyTestContext(ctx);
  }
}

describe('Agent Registration Flow', () => {
  describe('Complete Flow', () => {
    it('should register agent and allow discovery', async () => {
      await withContext(async (ctx) => {
        // Step 1: Register agent with registry
        await ctx.client.register(
          '@test-org/my-agent',
          `http://localhost:${ctx.factsPort}/facts.json`
        );

        // Verify registration
        expect(ctx.localRegistry.has('@test-org/my-agent')).toBe(true);

        // Step 2: Search for agent
        const searchResults = await ctx.client.search({ query: 'my-agent' });

        expect(searchResults.agents).toHaveLength(1);
        expect(searchResults.agents[0].agent_name).toBe('@test-org/my-agent');

        // Step 3: Connect to agent by handle
        const connection = await ctx.client.connect('@test-org/my-agent');

        expect(connection).toBeDefined();
        expect(connection.agentCard.name).toBe('my-agent');

        // Step 4: Send message and get response
        const task = await connection.send('Hello, agent!');

        expect(task.state).toBe('COMPLETED');
        expect(task.message?.parts[0]).toEqual({
          type: 'text',
          text: 'Hello! You said: Hello, agent!',
        });
      });
    });

    it('should discover agent capabilities', async () => {
      await withContext(async (ctx) => {
        // Register agent
        await ctx.client.register(
          '@test-org/my-agent',
          `http://localhost:${ctx.factsPort}/facts.json`
        );

        // Connect and check capabilities
        const connection = await ctx.client.connect('@test-org/my-agent');
        const card = connection.agentCard;

        expect(card.skills).toHaveLength(1);
        expect(card.skills[0].id).toBe('greet');
        expect(card.skills[0].name).toBe('Greeting');
      });
    });

    it('should maintain context across messages', async () => {
      await withContext(async (ctx) => {
        await ctx.client.register(
          '@test-org/my-agent',
          `http://localhost:${ctx.factsPort}/facts.json`
        );

        const connection = await ctx.client.connect('@test-org/my-agent');
        const contextId = 'session-123';

        // Send multiple messages with same context
        const task1 = await connection.send('First message', contextId);
        const task2 = await connection.send('Second message', contextId);

        expect(task1.contextId).toBe(contextId);
        expect(task2.contextId).toBe(contextId);
      });
    });
  });

  describe('Registration', () => {
    it('should register agent with facts URL', async () => {
      await withContext(async (ctx) => {
        await ctx.client.register(
          '@org/agent',
          `http://localhost:${ctx.factsPort}/facts.json`
        );

        const agent = ctx.localRegistry.get('@org/agent');
        expect(agent).toBeDefined();
        expect(agent?.primary_facts_url).toBe(`http://localhost:${ctx.factsPort}/facts.json`);
      });
    });

    it('should allow re-registration (update)', async () => {
      await withContext(async (ctx) => {
        await ctx.client.register('@org/agent', 'http://old-url/facts.json');
        await ctx.client.register('@org/agent', 'http://new-url/facts.json');

        const agent = ctx.localRegistry.get('@org/agent');
        expect(agent?.primary_facts_url).toBe('http://new-url/facts.json');
      });
    });
  });

  describe('Discovery', () => {
    it('should search agents by query', async () => {
      await withContext(async (ctx) => {
        await ctx.client.register('@org/alpha-agent', 'http://a/facts.json');
        await ctx.client.register('@org/beta-agent', 'http://b/facts.json');

        const results = await ctx.client.search({ query: 'alpha' });

        expect(results.agents).toHaveLength(1);
        expect(results.agents[0].agent_name).toBe('@org/alpha-agent');
      });
    });

    it('should return empty results for no matches', async () => {
      await withContext(async (ctx) => {
        await ctx.client.register('@org/some-agent', 'http://a/facts.json');

        const results = await ctx.client.search({ query: 'zzz-nonexistent-zzz' });

        expect(results.agents).toHaveLength(0);
      });
    });

    it('should discover agents by capability', async () => {
      await withContext(async (ctx) => {
        await ctx.client.register(
          '@test-org/my-agent',
          `http://localhost:${ctx.factsPort}/facts.json`
        );

        const handles = await ctx.client.discover('greet');

        expect(handles).toContain('@test-org/my-agent');
      });
    });
  });

  describe('Connection', () => {
    it('should connect by URL directly', async () => {
      await withContext(async (ctx) => {
        const connection = await ctx.client.connect(`http://localhost:${ctx.agentPort}`);

        expect(connection.agentCard.name).toBe('my-agent');
      });
    });

    it('should connect by handle after registration', async () => {
      await withContext(async (ctx) => {
        await ctx.client.register(
          '@test-org/my-agent',
          `http://localhost:${ctx.factsPort}/facts.json`
        );

        const connection = await ctx.client.connect('@test-org/my-agent');

        expect(connection.agentCard.name).toBe('my-agent');
      });
    });

    it('should reuse connections to same agent', async () => {
      await withContext(async (ctx) => {
        await ctx.client.register(
          '@test-org/my-agent',
          `http://localhost:${ctx.factsPort}/facts.json`
        );

        const conn1 = await ctx.client.connect('@test-org/my-agent');
        const conn2 = await ctx.client.connect('@test-org/my-agent');

        // Should return same underlying client
        expect(conn1.getClient()).toBe(conn2.getClient());
      });
    });

    it('should throw for unregistered handle', async () => {
      await withContext(async (ctx) => {
        try {
          await ctx.client.connect('@unknown/agent');
          expect(true).toBe(false); // Should not reach
        } catch (error) {
          expect((error as Error).message).toContain('not found');
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle registry unavailable', async () => {
      const badClient = new NandaClient({
        registryUrl: 'http://localhost:99999',
        timeout: 1000,
      });

      try {
        await badClient.search({ query: 'test' });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      } finally {
        await badClient.close();
      }
    });

    it('should handle agent server down after registration', async () => {
      await withContext(async (ctx) => {
        await ctx.client.register(
          '@test-org/temp-agent',
          `http://localhost:${ctx.factsPort}/facts.json`
        );

        // Stop agent server
        await ctx.agentServer.stop();

        try {
          await ctx.client.connect('@test-org/temp-agent');
          expect(true).toBe(false);
        } catch (error) {
          expect(error).toBeDefined();
        }
      });
    });
  });
});
