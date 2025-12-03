/**
 * Registry Client Unit Tests
 *
 * Tests for the NANDA registry client.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { IndexClient, createIndexClient } from '../../src/registry/IndexClient';
import { MOCK_REGISTRY_AGENTS, findMockAgent, searchMockAgents } from '../__mocks__/registry';

describe('IndexClient Unit Tests', () => {
  let mockRegistryServer: ReturnType<typeof Bun.serve>;
  let client: IndexClient;

  beforeEach(() => {
    // Create a mock registry server with port 0 for OS-assigned port
    mockRegistryServer = Bun.serve({
      port: 0,
      fetch(req: Request): Response {
        const url = new URL(req.url);
        const path = url.pathname;

        // Handle resolve endpoint: /agents/{handle}
        if (path.startsWith('/agents/') && !path.includes('/search') && !path.includes('/id/')) {
          const handle = decodeURIComponent(path.split('/').pop() || '');
          const agent = findMockAgent(handle);

          if (agent) {
            return Response.json({
              handle: agent.handle,
              agentId: agent.agentId,
              agentName: agent.agentName,
              description: agent.description,
              factsUrl: agent.factsUrl,
            });
          }

          return Response.json({ error: 'Agent not found' }, { status: 404 });
        }

        // Handle search endpoint: /agents/search?q=...
        if (path === '/agents/search') {
          const query = url.searchParams.get('q') || '';
          const results = searchMockAgents(query);

          return Response.json(
            results.map((a) => ({
              handle: a.handle,
              agentId: a.agentId,
              agentName: a.agentName,
              description: a.description,
              factsUrl: a.factsUrl,
            }))
          );
        }

        // Handle register endpoint: POST /agents
        if (path === '/agents' && req.method === 'POST') {
          return Response.json({
            handle: 'new-agent',
            agentId: 'agent-new',
            registered: true,
          });
        }

        return Response.json({ error: 'Not found' }, { status: 404 });
      },
    });

    client = createIndexClient({
      baseUrl: `http://localhost:${mockRegistryServer.port}`,
      cacheEnabled: false, // Disable cache for tests
    });
  });

  afterEach(() => {
    mockRegistryServer.stop();
    client.close();
  });

  describe('Resolution', () => {
    it('should resolve agent by handle', async () => {
      const result = await client.resolve('test-agent-1');

      expect(result).not.toBeNull();
      expect(result?.handle).toBe('test-agent-1');
      expect(result?.agentId).toBe('agent-test-agent-1');
    });

    it('should return null for non-existent handle', async () => {
      const result = await client.resolve('nonexistent-agent');
      expect(result).toBeNull();
    });

    it('should handle network errors', async () => {
      const badClient = createIndexClient({
        baseUrl: 'http://localhost:59999',
        cacheEnabled: false,
      });

      await expect(badClient.resolve('test')).rejects.toThrow();
    });
  });

  describe('Search', () => {
    it('should search agents by query', async () => {
      const results = await client.search({ query: 'test' });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].handle).toContain('test');
    });

    it('should return empty array for no matches', async () => {
      const results = await client.search({ query: 'xyznonexistent' });

      expect(results).toHaveLength(0);
    });

    it('should search by partial match', async () => {
      const results = await client.search({ query: 'echo' });

      expect(results.some((r) => r.handle === 'echo-agent')).toBe(true);
    });
  });

  describe('Registration', () => {
    it('should register new agent', async () => {
      const result = await client.register({
        handle: 'new-agent',
        factsUrl: 'https://example.com/facts.json',
      });

      expect(result.handle).toBe('new-agent');
    });
  });

  describe('Configuration', () => {
    it('should use default NANDA registry URL', () => {
      const defaultClient = createIndexClient();
      expect(defaultClient.baseUrl).toBe('https://api.projectnanda.org/v1');
      defaultClient.close();
    });
  });
});

describe('IndexClient Error Handling', () => {
  it('should handle server errors', async () => {
    const errorServer = Bun.serve({
      port: 0,
      fetch(): Response {
        return Response.json({ error: 'Internal error' }, { status: 500 });
      },
    });

    const client = createIndexClient({
      baseUrl: `http://localhost:${errorServer.port}`,
      cacheEnabled: false,
    });

    try {
      await expect(client.resolve('test')).rejects.toThrow();
    } finally {
      errorServer.stop();
      client.close();
    }
  });

  it('should handle invalid JSON responses', async () => {
    const badJsonServer = Bun.serve({
      port: 0,
      fetch(): Response {
        return new Response('not json', {
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    const client = createIndexClient({
      baseUrl: `http://localhost:${badJsonServer.port}`,
      cacheEnabled: false,
    });

    try {
      await expect(client.resolve('test')).rejects.toThrow();
    } finally {
      badJsonServer.stop();
      client.close();
    }
  });
});
