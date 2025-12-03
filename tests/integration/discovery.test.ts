/**
 * Discovery Module Tests
 *
 * Tests for agent discovery functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { AgentServer } from '../../src/server/AgentServer';
import { A2AClient } from '../../src/protocols/a2a/A2AClient';

// Helper to get port from AgentServer after start
function getServerPort(server: AgentServer): number {
  const url = new URL(server.getAgentCard().url);
  return parseInt(url.port, 10);
}

describe('Discovery Module Tests', () => {
  let server: AgentServer;
  let port: number;

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('Agent Card Discovery', () => {
    it('should discover agent card from well-known URL', async () => {
      server = new AgentServer({
        name: 'discoverable-agent',
        description: 'An agent to discover',
        version: '1.0.0',
        provider: { organization: 'Discovery Test' },
        port: 0,
        skills: [
          {
            id: 'search',
            name: 'Search',
            description: 'Search capability',
            tags: ['search'],
            inputModes: ['text'],
            outputModes: ['text'],
          },
        ],
      });

      await server.start();
      port = getServerPort(server);

      const client = new A2AClient({ agentUrl: `http://localhost:${port}` });
      const card = await client.discover();

      expect(card.name).toBe('discoverable-agent');
      expect(card.description).toBe('An agent to discover');
      expect(card.skills).toHaveLength(1);
    });

    it('should handle discovery timeout', async () => {
      // Connect to non-existent server
      const client = new A2AClient({
        agentUrl: 'http://localhost:59999',
        timeout: 100,
      });

      await expect(client.discover()).rejects.toThrow();
    });
  });

  describe('Capability Search', () => {
    it('should discover agents with specific skills', async () => {
      server = new AgentServer({
        name: 'multi-skill-agent',
        description: 'Agent with multiple skills',
        version: '1.0.0',
        provider: { organization: 'Test' },
        port: 0,
        skills: [
          {
            id: 'translate',
            name: 'Translate',
            description: 'Translation service',
            tags: ['language', 'translation'],
            inputModes: ['text'],
            outputModes: ['text'],
          },
          {
            id: 'summarize',
            name: 'Summarize',
            description: 'Text summarization',
            tags: ['text', 'summary'],
            inputModes: ['text'],
            outputModes: ['text'],
          },
        ],
      });

      await server.start();
      port = getServerPort(server);

      const client = new A2AClient({ agentUrl: `http://localhost:${port}` });
      const card = await client.discover();

      // Find skill by tag
      const translationSkill = card.skills.find(
        (s) => s.tags?.includes('translation')
      );
      expect(translationSkill).toBeDefined();
      expect(translationSkill?.id).toBe('translate');

      // Find skill by input mode
      const textSkills = card.skills.filter(
        (s) => s.inputModes?.includes('text')
      );
      expect(textSkills).toHaveLength(2);
    });
  });

  describe('Metadata Retrieval', () => {
    it('should retrieve agent provider information', async () => {
      server = new AgentServer({
        name: 'metadata-agent',
        description: 'Agent with full metadata',
        version: '2.1.0',
        provider: {
          organization: 'Metadata Corp',
          url: 'https://metadata.example.com',
        },
        port: 0,
        skills: [],
      });

      await server.start();
      port = getServerPort(server);

      const client = new A2AClient({ agentUrl: `http://localhost:${port}` });
      const card = await client.discover();

      expect(card.provider?.organization).toBe('Metadata Corp');
      expect(card.provider?.url).toBe('https://metadata.example.com');
      expect(card.version).toBe('2.1.0');
    });

    it('should retrieve capabilities information', async () => {
      server = new AgentServer({
        name: 'capabilities-agent',
        description: 'Agent with specific capabilities',
        version: '1.0.0',
        provider: { organization: 'Test' },
        port: 0,
        skills: [],
        capabilities: {
          streaming: true,
          pushNotifications: false,
          stateTransitionHistory: true,
        },
      });

      await server.start();
      port = getServerPort(server);

      const client = new A2AClient({ agentUrl: `http://localhost:${port}` });
      const card = await client.discover();

      expect(card.capabilities?.streaming).toBe(true);
      expect(card.capabilities?.pushNotifications).toBe(false);
      expect(card.capabilities?.stateTransitionHistory).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 from agent card URL', async () => {
      // Create a server without the well-known endpoint
      const badServer = Bun.serve({
        port: 0,
        fetch(req: Request): Response {
          const url = new URL(req.url);
          if (url.pathname === '/.well-known/agent.json') {
            return new Response('Not Found', { status: 404 });
          }
          return new Response('OK');
        },
      });

      const client = new A2AClient({ agentUrl: `http://localhost:${badServer.port}` });

      try {
        await expect(client.discover()).rejects.toThrow();
      } finally {
        badServer.stop();
      }
    });

    it('should handle invalid JSON in agent card', async () => {
      const badServer = Bun.serve({
        port: 0,
        fetch(req: Request): Response {
          const url = new URL(req.url);
          if (url.pathname === '/.well-known/agent.json') {
            return new Response('{ invalid json }', {
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return new Response('OK');
        },
      });

      const client = new A2AClient({ agentUrl: `http://localhost:${badServer.port}` });

      try {
        await expect(client.discover()).rejects.toThrow();
      } finally {
        badServer.stop();
      }
    });
  });
});
