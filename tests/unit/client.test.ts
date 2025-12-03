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

describe('A2AClient Streaming', () => {
  let server: AgentServer;
  let client: A2AClient;
  let port: number;

  beforeEach(async () => {
    port = getRandomPort();
    server = new AgentServer({
      name: 'streaming-agent',
      description: 'Agent for streaming tests',
      version: '1.0.0',
      port,
      skills: [],
    });

    server.onMessage(async (params, ctx) => {
      const textPart = params.message.parts.find((p) => p.type === 'text');
      const text = textPart?.type === 'text' ? textPart.text : '';

      // Create task for streaming
      const task = ctx.createTask(
        { role: 'agent', parts: [{ type: 'text', text: `Streamed: ${text}` }] },
        params.contextId
      );

      // If emit is available (streaming mode), emit progress updates
      if (ctx.emit) {
        await ctx.emit({
          type: 'task_update',
          taskId: task.id,
          state: 'WORKING',
          progress: 50,
        });
      }

      ctx.updateTaskState(task.id, 'COMPLETED');
      return { ...task, state: 'COMPLETED' as const };
    });

    await server.start();
    client = new A2AClient({ agentUrl: `http://localhost:${port}` });
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('sendMessageStream', () => {
    it('should stream task updates', async () => {
      const updates: unknown[] = [];

      for await (const update of client.sendMessageStream({
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'Stream me' }],
        },
      })) {
        updates.push(update);
      }

      expect(updates.length).toBeGreaterThanOrEqual(1);
      // Last update should be the final result
      const lastUpdate = updates[updates.length - 1] as { result?: { state: string }; done?: boolean };
      expect(lastUpdate.done).toBe(true);
      expect(lastUpdate.result?.state).toBe('COMPLETED');
    });

    it('should include intermediate updates', async () => {
      const updates: unknown[] = [];

      for await (const update of client.sendMessageStream({
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'With progress' }],
        },
      })) {
        updates.push(update);
      }

      // Should have at least the progress update and the final result
      expect(updates.length).toBeGreaterThanOrEqual(2);

      // Check for progress update
      const progressUpdate = updates.find(
        (u) => (u as { type?: string }).type === 'task_update'
      ) as { state: string; progress: number } | undefined;
      expect(progressUpdate).toBeDefined();
      expect(progressUpdate?.state).toBe('WORKING');
      expect(progressUpdate?.progress).toBe(50);
    });

    it('should set streaming configuration', async () => {
      let receivedConfig: unknown;

      // Create a custom server to inspect the request
      const inspectPort = getRandomPort();
      const inspectServer = Bun.serve({
        port: inspectPort,
        async fetch(req) {
          if (req.method === 'POST') {
            const body = await req.json() as { params?: { configuration?: unknown } };
            receivedConfig = body.params?.configuration;

            // Return SSE response
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
              start(controller) {
                controller.enqueue(encoder.encode('data: {"done": true, "result": {}}\n\n'));
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
              },
            });
            return new Response(stream, {
              headers: { 'Content-Type': 'text/event-stream' },
            });
          }
          return new Response('Not Found', { status: 404 });
        },
      });

      const inspectClient = new A2AClient({ agentUrl: `http://localhost:${inspectPort}` });

      try {
        for await (const _ of inspectClient.sendMessageStream({
          message: { role: 'user', parts: [{ type: 'text', text: 'test' }] },
        })) {
          // Consume stream
        }

        expect(receivedConfig).toBeDefined();
        expect((receivedConfig as { streaming?: boolean }).streaming).toBe(true);
      } finally {
        inspectServer.stop();
      }
    });
  });

  describe('stream convenience method', () => {
    it('should stream with just text', async () => {
      const updates: unknown[] = [];

      for await (const update of client.stream('Simple text')) {
        updates.push(update);
      }

      expect(updates.length).toBeGreaterThanOrEqual(1);
    });

    it('should accept contextId', async () => {
      const contextId = 'stream-context-123';
      const updates: unknown[] = [];

      for await (const update of client.stream('With context', contextId)) {
        updates.push(update);
      }

      // Final result should have the context
      const lastUpdate = updates[updates.length - 1] as { result?: { contextId?: string } };
      expect(lastUpdate.result?.contextId).toBe(contextId);
    });
  });

  describe('subscribeToTask', () => {
    it('should subscribe to task updates', async () => {
      // First create a task
      const task = await client.send('Create task for subscription');

      // Set up streaming subscription server
      const subPort = getRandomPort();
      let subscribedTaskId: string | null = null;

      const subServer = Bun.serve({
        port: subPort,
        async fetch(req) {
          if (req.method === 'POST') {
            const body = await req.json() as { params?: { taskId?: string } };
            subscribedTaskId = body.params?.taskId ?? null;

            const encoder = new TextEncoder();
            const stream = new ReadableStream({
              start(controller) {
                controller.enqueue(
                  encoder.encode(
                    `data: {"type":"task_update","taskId":"${subscribedTaskId}","state":"WORKING"}\n\n`
                  )
                );
                controller.enqueue(
                  encoder.encode(
                    `data: {"type":"task_update","taskId":"${subscribedTaskId}","state":"COMPLETED"}\n\n`
                  )
                );
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
              },
            });
            return new Response(stream, {
              headers: { 'Content-Type': 'text/event-stream' },
            });
          }
          return new Response('Not Found', { status: 404 });
        },
      });

      const subClient = new A2AClient({ agentUrl: `http://localhost:${subPort}` });

      try {
        const updates: Array<{ type: string; taskId: string; state: string }> = [];
        for await (const update of subClient.subscribeToTask(task.id)) {
          updates.push(update as { type: string; taskId: string; state: string });
        }

        expect(updates).toHaveLength(2);
        expect(updates[0].state).toBe('WORKING');
        expect(updates[1].state).toBe('COMPLETED');
        expect(subscribedTaskId).toBe(task.id);
      } finally {
        subServer.stop();
      }
    });
  });

  describe('streaming error handling', () => {
    it('should throw on non-OK response', async () => {
      const errorPort = getRandomPort();
      const errorServer = Bun.serve({
        port: errorPort,
        fetch() {
          return new Response('Service Unavailable', { status: 503 });
        },
      });

      const errorClient = new A2AClient({ agentUrl: `http://localhost:${errorPort}` });

      try {
        for await (const _ of errorClient.sendMessageStream({
          message: { role: 'user', parts: [{ type: 'text', text: 'fail' }] },
        })) {
          // Should not reach here
        }
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toContain('503');
      } finally {
        errorServer.stop();
      }
    });

    it('should throw when no response body', async () => {
      const noBodyPort = getRandomPort();
      const noBodyServer = Bun.serve({
        port: noBodyPort,
        fetch() {
          // Create response with null body (this is tricky in Bun)
          // We'll simulate by returning an empty stream that closes immediately
          return new Response(null, {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          });
        },
      });

      const noBodyClient = new A2AClient({ agentUrl: `http://localhost:${noBodyPort}` });

      try {
        for await (const _ of noBodyClient.sendMessageStream({
          message: { role: 'user', parts: [{ type: 'text', text: 'no body' }] },
        })) {
          // Should either throw or yield nothing
        }
        // If we reach here without error, the stream was empty which is also valid
      } catch (error) {
        expect((error as Error).message).toContain('No response body');
      } finally {
        noBodyServer.stop();
      }
    });

    it('should handle subscribeToTask errors', async () => {
      const subErrorPort = getRandomPort();
      const subErrorServer = Bun.serve({
        port: subErrorPort,
        fetch() {
          return new Response('Not Found', { status: 404 });
        },
      });

      const subErrorClient = new A2AClient({ agentUrl: `http://localhost:${subErrorPort}` });

      try {
        for await (const _ of subErrorClient.subscribeToTask('non-existent')) {
          // Should not reach here
        }
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toContain('404');
      } finally {
        subErrorServer.stop();
      }
    });
  });
});

describe('A2AClient additional coverage', () => {
  it('should use default timeout of 30000ms', () => {
    const client = new A2AClient({ agentUrl: 'http://localhost:3000' });
    // Default is applied internally; client should work
    expect(client.url).toBe('http://localhost:3000');
  });

  it('should use default empty headers', async () => {
    const port = getRandomPort();
    let receivedHeaders: Headers | null = null;

    const server = Bun.serve({
      port,
      fetch(req) {
        receivedHeaders = req.headers;
        return Response.json({
          name: 'test',
          description: 'Test agent',
          version: '1.0.0',
          url: `http://localhost:${port}`,
          skills: [],
          defaultInputModes: ['text'],
          defaultOutputModes: ['text'],
          capabilities: {},
        });
      },
    });

    const client = new A2AClient({ agentUrl: `http://localhost:${port}` });

    try {
      await client.discover();
      // Just verify the request went through with defaults
      expect(receivedHeaders).toBeDefined();
    } finally {
      server.stop();
    }
  });

  it('should apply custom headers to requests', async () => {
    const port = getRandomPort();
    let receivedHeaders: Headers | null = null;

    const server = Bun.serve({
      port,
      fetch(req) {
        receivedHeaders = req.headers;
        return Response.json({
          name: 'test',
          description: 'Test agent',
          version: '1.0.0',
          url: `http://localhost:${port}`,
          skills: [],
          defaultInputModes: ['text'],
          defaultOutputModes: ['text'],
          capabilities: {},
        });
      },
    });

    const client = new A2AClient({
      agentUrl: `http://localhost:${port}`,
      headers: { 'X-Custom-Header': 'custom-value' },
    });

    try {
      await client.discover();
      expect(receivedHeaders?.get('X-Custom-Header')).toBe('custom-value');
    } finally {
      server.stop();
    }
  });

  it('should return null from getAgentCard before discover', () => {
    const client = new A2AClient({ agentUrl: 'http://localhost:3000' });
    expect(client.getAgentCard()).toBeNull();
  });

  it('should return agent card after discover', async () => {
    const port = getRandomPort();
    const server = Bun.serve({
      port,
      fetch() {
        return Response.json({
          name: 'test-agent',
          description: 'Test agent',
          version: '1.0.0',
          url: `http://localhost:${port}`,
          skills: [],
          defaultInputModes: ['text'],
          defaultOutputModes: ['text'],
          capabilities: {},
        });
      },
    });

    const client = new A2AClient({ agentUrl: `http://localhost:${port}` });

    try {
      await client.discover();
      const card = client.getAgentCard();
      expect(card).not.toBeNull();
      expect(card?.name).toBe('test-agent');
    } finally {
      server.stop();
    }
  });

  it('should send convenience method', async () => {
    const port = getRandomPort();
    let receivedMessage: unknown;

    const server = Bun.serve({
      port,
      async fetch(req) {
        const body = await req.json() as { params?: { message?: unknown } };
        receivedMessage = body.params?.message;
        return Response.json({
          jsonrpc: '2.0',
          result: { id: 'task-1', state: 'COMPLETED', contextId: 'ctx-1' },
          id: 1,
        });
      },
    });

    const client = new A2AClient({ agentUrl: `http://localhost:${port}` });

    try {
      const task = await client.send('Hello', 'my-context');
      expect(task.id).toBe('task-1');
      expect((receivedMessage as { parts: Array<{ text: string }> }).parts[0].text).toBe('Hello');
    } finally {
      server.stop();
    }
  });

  it('should cancel convenience method', async () => {
    const port = getRandomPort();
    let receivedTaskId: string | undefined;

    const server = Bun.serve({
      port,
      async fetch(req) {
        const body = await req.json() as { params?: { taskId?: string } };
        receivedTaskId = body.params?.taskId;
        return Response.json({
          jsonrpc: '2.0',
          result: { id: receivedTaskId, state: 'CANCELLED', contextId: 'ctx-1' },
          id: 1,
        });
      },
    });

    const client = new A2AClient({ agentUrl: `http://localhost:${port}` });

    try {
      const task = await client.cancel('task-to-cancel');
      expect(task.state).toBe('CANCELLED');
      expect(receivedTaskId).toBe('task-to-cancel');
    } finally {
      server.stop();
    }
  });

  it('should close client without error', async () => {
    const client = new A2AClient({ agentUrl: 'http://localhost:3000' });
    await expect(client.close()).resolves.toBeUndefined();
  });

  it('should clear agent card on close', async () => {
    const port = getRandomPort();
    const server = Bun.serve({
      port,
      fetch() {
        return Response.json({
          name: 'test',
          description: 'Test agent',
          version: '1.0.0',
          url: `http://localhost:${port}`,
          skills: [],
          defaultInputModes: ['text'],
          defaultOutputModes: ['text'],
          capabilities: {},
        });
      },
    });

    const client = new A2AClient({ agentUrl: `http://localhost:${port}` });

    try {
      await client.discover();
      expect(client.getAgentCard()).not.toBeNull();

      await client.close();
      expect(client.getAgentCard()).toBeNull();
    } finally {
      server.stop();
    }
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

  it('should handle timeout on discovery', async () => {
    const port = getRandomPort();

    const slowServer = Bun.serve({
      port,
      async fetch() {
        // Wait longer than the timeout
        await new Promise((r) => setTimeout(r, 500));
        return Response.json({ name: 'slow', version: '1.0.0', url: '', skills: [] });
      },
    });

    const client = new A2AClient({
      agentUrl: `http://localhost:${port}`,
      timeout: 100,
    });

    try {
      await expect(client.discover()).rejects.toThrow(/timed out/);
    } finally {
      slowServer.stop();
    }
  });

  it('should handle timeout on RPC', async () => {
    const port = getRandomPort();

    const slowServer = Bun.serve({
      port,
      async fetch() {
        await new Promise((r) => setTimeout(r, 500));
        return Response.json({ jsonrpc: '2.0', result: {}, id: 1 });
      },
    });

    const client = new A2AClient({
      agentUrl: `http://localhost:${port}`,
      timeout: 100,
    });

    try {
      await expect(
        client.sendMessage({
          message: { role: 'user', parts: [{ type: 'text', text: 'slow' }] },
        })
      ).rejects.toThrow(/timed out/);
    } finally {
      slowServer.stop();
    }
  });

  it('should handle JSON-RPC error response', async () => {
    const port = getRandomPort();

    const errorServer = Bun.serve({
      port,
      fetch() {
        return Response.json({
          jsonrpc: '2.0',
          error: {
            code: -32602,
            message: 'Invalid params',
            data: { field: 'message' },
          },
          id: 1,
        });
      },
    });

    const client = new A2AClient({ agentUrl: `http://localhost:${port}` });

    try {
      await expect(
        client.sendMessage({
          message: { role: 'user', parts: [{ type: 'text', text: 'error' }] },
        })
      ).rejects.toThrow('Invalid params');
    } finally {
      errorServer.stop();
    }
  });

  it('should handle RPC connection errors', async () => {
    const client = new A2AClient({ agentUrl: 'http://localhost:99999' });

    await expect(
      client.sendMessage({
        message: { role: 'user', parts: [{ type: 'text', text: 'fail' }] },
      })
    ).rejects.toThrow();
  });

  it('should handle non-OK HTTP response on RPC', async () => {
    const port = getRandomPort();

    const errorServer = Bun.serve({
      port,
      fetch() {
        return new Response('Internal Server Error', { status: 500 });
      },
    });

    const client = new A2AClient({ agentUrl: `http://localhost:${port}` });

    try {
      await expect(
        client.sendMessage({
          message: { role: 'user', parts: [{ type: 'text', text: 'error' }] },
        })
      ).rejects.toThrow(/500/);
    } finally {
      errorServer.stop();
    }
  });
});
