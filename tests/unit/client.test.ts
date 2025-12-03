/**
 * A2AClient Unit Tests
 *
 * Tests for the A2A protocol client.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { A2AClient } from '../../src/protocols/a2a/A2AClient';
import { AgentServer } from '../../src/server/AgentServer';

// Helper to get a random available port
function getRandomPort(): number {
  return 30000 + Math.floor(Math.random() * 10000);
}

describe('A2AClient Unit Tests', () => {
  let server: AgentServer;
  let client: A2AClient;
  let port: number;

  beforeEach(async () => {
    port = getRandomPort();
    server = new AgentServer({
      name: 'test-agent',
      description: 'Test agent for client tests',
      version: '1.0.0',
      provider: { organization: 'Test' },
      port,
      skills: [
        {
          id: 'echo',
          name: 'Echo',
          description: 'Echoes messages',
          tags: ['test'],
          inputModes: ['text'],
          outputModes: ['text'],
        },
      ],
    });

    server.onMessage(async (params, ctx) => {
      const textPart = params.message.parts.find((p) => p.type === 'text');
      const text = textPart?.type === 'text' ? textPart.text : '';

      // Use ctx.createTask to properly store the task
      const task = ctx.createTask(
        {
          role: 'agent',
          parts: [{ type: 'text', text: `Echo: ${text}` }],
        },
        params.contextId
      );
      ctx.updateTaskState(task.id, 'COMPLETED');
      return { ...task, state: 'COMPLETED' as const };
    });

    await server.start();
    client = new A2AClient({ agentUrl: `http://localhost:${port}` });
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('Connection Management', () => {
    it('should connect to agent and discover capabilities', async () => {
      const card = await client.discover();
      expect(card).toBeDefined();
      expect(card.name).toBe('test-agent');
      expect(card.skills).toHaveLength(1);
      expect(card.skills[0].id).toBe('echo');
    });

    it('should handle connection errors gracefully', async () => {
      const badClient = new A2AClient({ agentUrl: 'http://localhost:99999' });
      await expect(badClient.discover()).rejects.toThrow();
    });
  });

  describe('Request Handling', () => {
    it('should send message and receive response', async () => {
      const task = await client.sendMessage({
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'Hello, agent!' }],
        },
      });

      expect(task).toBeDefined();
      expect(task.state).toBe('COMPLETED');
      expect(task.message?.parts[0]).toEqual({
        type: 'text',
        text: 'Echo: Hello, agent!',
      });
    });

    it('should respect custom timeout', async () => {
      const timeoutClient = new A2AClient({
        agentUrl: `http://localhost:${port}`,
        timeout: 100,
      });

      // Should not timeout for fast responses
      const task = await timeoutClient.sendMessage({
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'Quick message' }],
        },
      });
      expect(task.state).toBe('COMPLETED');
    });

    it('should generate unique request IDs', async () => {
      const ids = new Set<string>();

      for (let i = 0; i < 10; i++) {
        const task = await client.sendMessage({
          message: {
            role: 'user',
            parts: [{ type: 'text', text: `Message ${i}` }],
          },
        });
        ids.add(task.id);
      }

      // All IDs should be unique
      expect(ids.size).toBe(10);
    });
  });

  describe('Task Operations', () => {
    it('should get task by ID', async () => {
      const created = await client.sendMessage({
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'Create task' }],
        },
      });

      // Use get (convenience method that takes just the id string)
      const retrieved = await client.get(created.id);
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.state).toBe(created.state);
    });

    it('should list tasks', async () => {
      // Create a few tasks
      await client.sendMessage({
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'Task 1' }],
        },
      });

      await client.sendMessage({
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'Task 2' }],
        },
      });

      // listTasks returns { tasks: Task[], total, hasMore }
      const response = await client.listTasks();
      expect(response.tasks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Context Management', () => {
    it('should maintain context across messages', async () => {
      const contextId = crypto.randomUUID();

      const task1 = await client.sendMessage({
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'First message' }],
        },
        contextId,
      });

      const task2 = await client.sendMessage({
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'Second message' }],
        },
        contextId,
      });

      expect(task1.contextId).toBe(contextId);
      expect(task2.contextId).toBe(contextId);
    });
  });
});

describe('A2AClient Edge Cases', () => {
  it('should handle malformed responses', async () => {
    const port = getRandomPort();

    // Create a raw server that returns invalid JSON-RPC
    const badServer = Bun.serve({
      port,
      fetch() {
        return new Response(JSON.stringify({ invalid: 'response' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    const client = new A2AClient({ agentUrl: `http://localhost:${port}` });

    try {
      await expect(client.discover()).rejects.toThrow();
    } finally {
      badServer.stop();
    }
  });

  it('should handle empty responses', async () => {
    const port = getRandomPort();

    const emptyServer = Bun.serve({
      port,
      fetch() {
        return new Response('', { status: 204 });
      },
    });

    const client = new A2AClient({ agentUrl: `http://localhost:${port}` });

    try {
      await expect(client.discover()).rejects.toThrow();
    } finally {
      emptyServer.stop();
    }
  });
});
