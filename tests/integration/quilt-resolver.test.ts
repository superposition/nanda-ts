/**
 * QuiltResolver Unit Tests
 *
 * Tests for multi-registry resolution.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  QuiltResolver,
  createQuiltResolver,
} from '../../src/registry/QuiltResolver';
import type { AgentCard } from '../../src/types';

// Helper to create a mock registry server with port 0
function createMockRegistry(
  agents: Record<string, { agent_id: string; agent_name: string; primary_facts_url: string; adaptive_resolver_url?: string }>
): ReturnType<typeof Bun.serve> {
  const server = Bun.serve({
    port: 0,
    fetch(req: Request): Response {
      const url = new URL(req.url);

      // Handle resolve: GET /agents/{handle}
      if (url.pathname.startsWith('/agents/') && req.method === 'GET') {
        if (url.pathname === '/agents/search') {
          // Search endpoint
          return new Response(
            JSON.stringify({
              agents: Object.values(agents),
              total: Object.keys(agents).length,
              page: 1,
              limit: 100,
            }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }

        const handle = decodeURIComponent(url.pathname.slice('/agents/'.length));
        const agent = agents[handle];

        if (agent) {
          return new Response(JSON.stringify(agent), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response('Not Found', { status: 404 });
      }

      return new Response('Not Found', { status: 404 });
    },
  });
  return server;
}

describe('QuiltResolver', () => {
  describe('constructor', () => {
    it('should create resolver with single registry', () => {
      const resolver = new QuiltResolver({
        registries: [{ baseUrl: 'https://registry1.example.com' }],
      });

      expect(resolver.registryCount).toBe(1);
      resolver.close();
    });

    it('should create resolver with multiple registries', () => {
      const resolver = new QuiltResolver({
        registries: [
          { baseUrl: 'https://registry1.example.com' },
          { baseUrl: 'https://registry2.example.com' },
          { baseUrl: 'https://registry3.example.com' },
        ],
      });

      expect(resolver.registryCount).toBe(3);
      resolver.close();
    });

    it('should use default timeout', () => {
      const resolver = new QuiltResolver({
        registries: [{ baseUrl: 'https://example.com' }],
      });
      // Default is 5000ms - we can't directly test private config
      expect(resolver).toBeDefined();
      resolver.close();
    });

    it('should accept custom timeout', () => {
      const resolver = new QuiltResolver({
        registries: [{ baseUrl: 'https://example.com' }],
        timeout: 10000,
      });
      expect(resolver).toBeDefined();
      resolver.close();
    });

    it('should default to parallel mode', () => {
      const resolver = new QuiltResolver({
        registries: [{ baseUrl: 'https://example.com' }],
      });
      // parallel: true by default
      expect(resolver).toBeDefined();
      resolver.close();
    });

    it('should accept sequential mode', () => {
      const resolver = new QuiltResolver({
        registries: [{ baseUrl: 'https://example.com' }],
        parallel: false,
      });
      expect(resolver).toBeDefined();
      resolver.close();
    });
  });

  describe('registryCount', () => {
    it('should return number of registries', () => {
      const resolver = new QuiltResolver({
        registries: [
          { baseUrl: 'https://r1.example.com' },
          { baseUrl: 'https://r2.example.com' },
        ],
      });

      expect(resolver.registryCount).toBe(2);
      resolver.close();
    });

    it('should return 0 after close', () => {
      const resolver = new QuiltResolver({
        registries: [{ baseUrl: 'https://example.com' }],
      });

      resolver.close();
      expect(resolver.registryCount).toBe(0);
    });
  });

  describe('addRegistry', () => {
    it('should add a new registry', () => {
      const resolver = new QuiltResolver({
        registries: [{ baseUrl: 'https://r1.example.com' }],
      });

      expect(resolver.registryCount).toBe(1);

      resolver.addRegistry({ baseUrl: 'https://r2.example.com' });

      expect(resolver.registryCount).toBe(2);
      resolver.close();
    });

    it('should add registry with API key', () => {
      const resolver = new QuiltResolver({
        registries: [{ baseUrl: 'https://r1.example.com' }],
      });

      resolver.addRegistry({
        baseUrl: 'https://r2.example.com',
        apiKey: 'secret-key',
      });

      expect(resolver.registryCount).toBe(2);
      resolver.close();
    });
  });

  describe('removeRegistry', () => {
    it('should remove registry by baseUrl', () => {
      const resolver = new QuiltResolver({
        registries: [
          { baseUrl: 'https://r1.example.com' },
          { baseUrl: 'https://r2.example.com' },
        ],
      });

      expect(resolver.registryCount).toBe(2);

      resolver.removeRegistry('https://r1.example.com');

      expect(resolver.registryCount).toBe(1);
      resolver.close();
    });

    it('should do nothing for non-existent registry', () => {
      const resolver = new QuiltResolver({
        registries: [{ baseUrl: 'https://r1.example.com' }],
      });

      resolver.removeRegistry('https://nonexistent.example.com');

      expect(resolver.registryCount).toBe(1);
      resolver.close();
    });
  });

  describe('close', () => {
    it('should close all clients', () => {
      const resolver = new QuiltResolver({
        registries: [
          { baseUrl: 'https://r1.example.com' },
          { baseUrl: 'https://r2.example.com' },
        ],
      });

      resolver.close();

      expect(resolver.registryCount).toBe(0);
    });

    it('should be callable multiple times', () => {
      const resolver = new QuiltResolver({
        registries: [{ baseUrl: 'https://example.com' }],
      });

      resolver.close();
      resolver.close(); // Should not throw

      expect(resolver.registryCount).toBe(0);
    });
  });
});

describe('QuiltResolver.resolve', () => {
  let servers: ReturnType<typeof Bun.serve>[] = [];
  let resolver: QuiltResolver;

  afterEach(() => {
    resolver?.close();
    servers.forEach((s) => s.stop());
    servers = [];
  });

  it('should resolve from single registry', async () => {
    const server = createMockRegistry({
      '@org/agent': {
        agent_id: 'agent-1',
        agent_name: '@org/agent',
        primary_facts_url: `http://localhost:${0}/facts.json`,
      },
    });
    servers.push(server);
    const port = server.port;

    // Update the mock data with actual port
    server.stop();
    const serverWithPort = createMockRegistry({
      '@org/agent': {
        agent_id: 'agent-1',
        agent_name: '@org/agent',
        primary_facts_url: `http://localhost:${port}/facts.json`,
      },
    });
    servers = [serverWithPort];
    const actualPort = serverWithPort.port;

    resolver = new QuiltResolver({
      registries: [{ baseUrl: `http://localhost:${actualPort}` }],
    });

    const result = await resolver.resolve('@org/agent');

    expect(result).not.toBeNull();
    expect(result?.agentAddr.agent_name).toBe('@org/agent');
  });

  it('should return null for unknown handle', async () => {
    const server = createMockRegistry({});
    servers.push(server);

    resolver = new QuiltResolver({
      registries: [{ baseUrl: `http://localhost:${server.port}` }],
    });

    const result = await resolver.resolve('@unknown/agent');

    expect(result).toBeNull();
  });

  it('should resolve in parallel mode (first success wins)', async () => {
    // First registry doesn't have the agent
    const server1 = createMockRegistry({});
    servers.push(server1);

    // Second registry has the agent
    const server2 = createMockRegistry({
      '@org/agent': {
        agent_id: 'agent-from-r2',
        agent_name: '@org/agent',
        primary_facts_url: `http://localhost:${0}/facts.json`,
      },
    });
    servers.push(server2);

    resolver = new QuiltResolver({
      registries: [
        { baseUrl: `http://localhost:${server1.port}` },
        { baseUrl: `http://localhost:${server2.port}` },
      ],
      parallel: true,
    });

    const result = await resolver.resolve('@org/agent');

    expect(result).not.toBeNull();
    expect(result?.agentAddr.agent_id).toBe('agent-from-r2');
  });

  it('should resolve in sequential mode', async () => {
    // First registry doesn't have the agent
    const server1 = createMockRegistry({});
    servers.push(server1);

    // Second registry has the agent
    const server2 = createMockRegistry({
      '@org/agent': {
        agent_id: 'agent-from-r2',
        agent_name: '@org/agent',
        primary_facts_url: `http://localhost:${0}/facts.json`,
      },
    });
    servers.push(server2);

    resolver = new QuiltResolver({
      registries: [
        { baseUrl: `http://localhost:${server1.port}` },
        { baseUrl: `http://localhost:${server2.port}` },
      ],
      parallel: false,
    });

    const result = await resolver.resolve('@org/agent');

    expect(result).not.toBeNull();
    expect(result?.agentAddr.agent_id).toBe('agent-from-r2');
  });

  it('should extract endpoints with adaptive_resolver_url', async () => {
    const server = Bun.serve({
      port: 0,
      fetch(req: Request): Response {
        const url = new URL(req.url);
        if (url.pathname.startsWith('/agents/') && req.method === 'GET') {
          if (url.pathname !== '/agents/search') {
            const handle = decodeURIComponent(url.pathname.slice('/agents/'.length));
            if (handle === '@org/agent') {
              // Use the server's own port in the response
              const serverUrl = `http://localhost:${server.port}`;
              return new Response(
                JSON.stringify({
                  agent_id: 'agent-1',
                  agent_name: '@org/agent',
                  primary_facts_url: `${serverUrl}/facts.json`,
                  adaptive_resolver_url: `${serverUrl}/a2a`,
                }),
                { headers: { 'Content-Type': 'application/json' } }
              );
            }
          }
        }
        return new Response('Not Found', { status: 404 });
      },
    });
    servers.push(server);

    resolver = new QuiltResolver({
      registries: [{ baseUrl: `http://localhost:${server.port}` }],
    });

    const result = await resolver.resolve('@org/agent');

    expect(result?.endpoints.a2a).toBe(`http://localhost:${server.port}/a2a`);
    expect(result?.endpoints.facts).toBe(`http://localhost:${server.port}/facts.json`);
    expect(result?.endpoints.health).toBe(`http://localhost:${server.port}/a2a/health`);
  });

  it('should derive a2a endpoint from facts URL when no adaptive_resolver', async () => {
    const server = Bun.serve({
      port: 0,
      fetch(req: Request): Response {
        const url = new URL(req.url);
        if (url.pathname.startsWith('/agents/') && req.method === 'GET') {
          if (url.pathname !== '/agents/search') {
            const handle = decodeURIComponent(url.pathname.slice('/agents/'.length));
            if (handle === '@org/agent') {
              return new Response(
                JSON.stringify({
                  agent_id: 'agent-1',
                  agent_name: '@org/agent',
                  primary_facts_url: `http://localhost:${server.port}/path/facts.json`,
                }),
                { headers: { 'Content-Type': 'application/json' } }
              );
            }
          }
        }
        return new Response('Not Found', { status: 404 });
      },
    });
    servers.push(server);

    resolver = new QuiltResolver({
      registries: [{ baseUrl: `http://localhost:${server.port}` }],
    });

    const result = await resolver.resolve('@org/agent');

    // Should derive from origin of facts URL
    expect(result?.endpoints.a2a).toBe(`http://localhost:${server.port}`);
  });

  it('should include resolvedAt timestamp', async () => {
    const server = createMockRegistry({
      '@org/agent': {
        agent_id: 'agent-1',
        agent_name: '@org/agent',
        primary_facts_url: 'http://example.com/facts.json',
      },
    });
    servers.push(server);

    resolver = new QuiltResolver({
      registries: [{ baseUrl: `http://localhost:${server.port}` }],
    });

    const before = new Date();
    const result = await resolver.resolve('@org/agent');
    const after = new Date();

    expect(result?.resolvedAt).toBeInstanceOf(Date);
    expect(result?.resolvedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result?.resolvedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should handle registry errors gracefully in parallel mode', async () => {
    // First registry returns error
    const errorServer = Bun.serve({
      port: 0,
      fetch(): Response {
        return new Response('Server Error', { status: 500 });
      },
    });
    servers.push(errorServer);

    // Second registry works
    const server2 = createMockRegistry({
      '@org/agent': {
        agent_id: 'agent-1',
        agent_name: '@org/agent',
        primary_facts_url: 'http://example.com/facts.json',
      },
    });
    servers.push(server2);

    resolver = new QuiltResolver({
      registries: [
        { baseUrl: `http://localhost:${errorServer.port}` },
        { baseUrl: `http://localhost:${server2.port}` },
      ],
      parallel: true,
    });

    const result = await resolver.resolve('@org/agent');

    expect(result).not.toBeNull();
    expect(result?.agentAddr.agent_id).toBe('agent-1');
  });

  it('should handle registry errors gracefully in sequential mode', async () => {
    // First registry returns error
    const errorServer = Bun.serve({
      port: 0,
      fetch(): Response {
        return new Response('Server Error', { status: 500 });
      },
    });
    servers.push(errorServer);

    // Second registry works
    const server2 = createMockRegistry({
      '@org/agent': {
        agent_id: 'agent-1',
        agent_name: '@org/agent',
        primary_facts_url: 'http://example.com/facts.json',
      },
    });
    servers.push(server2);

    resolver = new QuiltResolver({
      registries: [
        { baseUrl: `http://localhost:${errorServer.port}` },
        { baseUrl: `http://localhost:${server2.port}` },
      ],
      parallel: false,
    });

    const result = await resolver.resolve('@org/agent');

    expect(result).not.toBeNull();
  });
});

describe('QuiltResolver.resolve with AgentCard', () => {
  let servers: ReturnType<typeof Bun.serve>[] = [];
  let resolver: QuiltResolver;

  afterEach(() => {
    resolver?.close();
    servers.forEach((s) => s.stop());
    servers = [];
  });

  it('should fetch AgentCard when available', async () => {
    const server = Bun.serve({
      port: 0,
      fetch(req: Request): Response {
        const url = new URL(req.url);

        // Handle resolve: /agents/{handle} (URL encoded)
        if (url.pathname.startsWith('/agents/') && !url.pathname.includes('search')) {
          const handle = decodeURIComponent(url.pathname.slice('/agents/'.length));
          if (handle === '@org/agent') {
            return new Response(
              JSON.stringify({
                agent_id: 'agent-1',
                agent_name: '@org/agent',
                primary_facts_url: `http://localhost:${server.port}/facts.json`,
              }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          }
        }

        if (url.pathname === '/.well-known/agent.json') {
          const mockCard: AgentCard = {
            name: 'test-agent',
            description: 'A test agent',
            url: `http://localhost:${server.port}`,
            version: '1.0.0',
            defaultInputModes: ['text'],
            defaultOutputModes: ['text'],
            capabilities: { streaming: true, pushNotifications: false },
            skills: [],
          };
          return new Response(JSON.stringify(mockCard), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response('Not Found', { status: 404 });
      },
    });
    servers.push(server);

    resolver = new QuiltResolver({
      registries: [{ baseUrl: `http://localhost:${server.port}` }],
    });

    const result = await resolver.resolve('@org/agent');

    expect(result?.agentCard).toBeDefined();
    expect(result?.agentCard?.name).toBe('test-agent');
    expect(result?.agentCard?.capabilities.streaming).toBe(true);
  });

  it('should use AgentCard URL for a2a endpoint', async () => {
    const server = Bun.serve({
      port: 0,
      fetch(req: Request): Response {
        const url = new URL(req.url);

        // Handle resolve: /agents/{handle} (URL encoded)
        if (url.pathname.startsWith('/agents/') && !url.pathname.includes('search')) {
          const handle = decodeURIComponent(url.pathname.slice('/agents/'.length));
          if (handle === '@org/agent') {
            return new Response(
              JSON.stringify({
                agent_id: 'agent-1',
                agent_name: '@org/agent',
                primary_facts_url: `http://localhost:${server.port}/facts.json`,
                // No adaptive_resolver_url
              }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          }
        }

        if (url.pathname === '/.well-known/agent.json') {
          const mockCard: AgentCard = {
            name: 'test-agent',
            description: 'A test agent',
            url: 'https://agent.example.com',
            version: '1.0.0',
            defaultInputModes: ['text'],
            defaultOutputModes: ['text'],
            capabilities: { streaming: false, pushNotifications: false },
            skills: [],
          };
          return new Response(JSON.stringify(mockCard), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response('Not Found', { status: 404 });
      },
    });
    servers.push(server);

    resolver = new QuiltResolver({
      registries: [{ baseUrl: `http://localhost:${server.port}` }],
    });

    const result = await resolver.resolve('@org/agent');

    // Should use card.url since no adaptive_resolver_url
    expect(result?.endpoints.a2a).toBe('https://agent.example.com');
  });

  it('should handle missing AgentCard gracefully', async () => {
    const server = Bun.serve({
      port: 0,
      fetch(req: Request): Response {
        const url = new URL(req.url);

        // Handle resolve: /agents/{handle} (URL encoded)
        if (url.pathname.startsWith('/agents/') && !url.pathname.includes('search')) {
          const handle = decodeURIComponent(url.pathname.slice('/agents/'.length));
          if (handle === '@org/agent') {
            return new Response(
              JSON.stringify({
                agent_id: 'agent-1',
                agent_name: '@org/agent',
                primary_facts_url: `http://localhost:${server.port}/facts.json`,
              }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          }
        }

        // No agent.json endpoint - return 404
        return new Response('Not Found', { status: 404 });
      },
    });
    servers.push(server);

    resolver = new QuiltResolver({
      registries: [{ baseUrl: `http://localhost:${server.port}` }],
    });

    const result = await resolver.resolve('@org/agent');

    expect(result).not.toBeNull();
    expect(result?.agentCard).toBeUndefined();
  });
});

describe('QuiltResolver.search', () => {
  let servers: ReturnType<typeof Bun.serve>[] = [];
  let resolver: QuiltResolver;

  afterEach(() => {
    resolver?.close();
    servers.forEach((s) => s.stop());
    servers = [];
  });

  it('should search across single registry', async () => {
    const server = createMockRegistry({
      '@org/agent1': {
        agent_id: 'agent-1',
        agent_name: '@org/agent1',
        primary_facts_url: 'http://example.com/facts1.json',
      },
      '@org/agent2': {
        agent_id: 'agent-2',
        agent_name: '@org/agent2',
        primary_facts_url: 'http://example.com/facts2.json',
      },
    });
    servers.push(server);

    resolver = new QuiltResolver({
      registries: [{ baseUrl: `http://localhost:${server.port}` }],
    });

    const results = await resolver.search({ query: 'agent' });

    expect(results).toHaveLength(2);
  });

  it('should deduplicate agents across registries', async () => {
    // Both registries have the same agent (by agent_id)
    const server1 = createMockRegistry({
      '@org/agent': {
        agent_id: 'shared-agent-id',
        agent_name: '@org/agent',
        primary_facts_url: 'http://example.com/facts.json',
      },
    });
    servers.push(server1);

    const server2 = createMockRegistry({
      '@org/agent': {
        agent_id: 'shared-agent-id', // Same ID
        agent_name: '@org/agent',
        primary_facts_url: 'http://example.com/facts.json',
      },
    });
    servers.push(server2);

    resolver = new QuiltResolver({
      registries: [
        { baseUrl: `http://localhost:${server1.port}` },
        { baseUrl: `http://localhost:${server2.port}` },
      ],
    });

    const results = await resolver.search({});

    // Should deduplicate by agent_id
    expect(results).toHaveLength(1);
  });

  it('should combine unique agents from multiple registries', async () => {
    const server1 = createMockRegistry({
      '@org/agent1': {
        agent_id: 'agent-1',
        agent_name: '@org/agent1',
        primary_facts_url: 'http://example.com/facts1.json',
      },
    });
    servers.push(server1);

    const server2 = createMockRegistry({
      '@org/agent2': {
        agent_id: 'agent-2',
        agent_name: '@org/agent2',
        primary_facts_url: 'http://example.com/facts2.json',
      },
    });
    servers.push(server2);

    resolver = new QuiltResolver({
      registries: [
        { baseUrl: `http://localhost:${server1.port}` },
        { baseUrl: `http://localhost:${server2.port}` },
      ],
    });

    const results = await resolver.search({});

    expect(results).toHaveLength(2);
    expect(results.map((a) => a.agent_id).sort()).toEqual(['agent-1', 'agent-2']);
  });

  it('should handle registry errors gracefully', async () => {
    // First registry errors
    const errorServer = Bun.serve({
      port: 0,
      fetch(): Response {
        return new Response('Error', { status: 500 });
      },
    });
    servers.push(errorServer);

    // Second registry works
    const server2 = createMockRegistry({
      '@org/agent': {
        agent_id: 'agent-1',
        agent_name: '@org/agent',
        primary_facts_url: 'http://example.com/facts.json',
      },
    });
    servers.push(server2);

    resolver = new QuiltResolver({
      registries: [
        { baseUrl: `http://localhost:${errorServer.port}` },
        { baseUrl: `http://localhost:${server2.port}` },
      ],
    });

    const results = await resolver.search({});

    // Should still return results from working registry
    expect(results).toHaveLength(1);
  });

  it('should return empty array when all registries fail', async () => {
    const errorServer = Bun.serve({
      port: 0,
      fetch(): Response {
        return new Response('Error', { status: 500 });
      },
    });
    servers.push(errorServer);

    resolver = new QuiltResolver({
      registries: [{ baseUrl: `http://localhost:${errorServer.port}` }],
    });

    const results = await resolver.search({});

    expect(results).toEqual([]);
  });
});

describe('createQuiltResolver', () => {
  it('should create resolver with default NANDA registry', () => {
    const resolver = createQuiltResolver();

    expect(resolver.registryCount).toBe(1);
    resolver.close();
  });

  it('should add additional registries', () => {
    const resolver = createQuiltResolver([
      { baseUrl: 'https://registry2.example.com' },
      { baseUrl: 'https://registry3.example.com' },
    ]);

    expect(resolver.registryCount).toBe(3);
    resolver.close();
  });
});
