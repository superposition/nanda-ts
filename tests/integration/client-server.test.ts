/**
 * Client-Server Integration Tests
 *
 * Full integration tests for A2A client-server communication.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { AgentServer } from '../../src/server/AgentServer';
import { A2AClient } from '../../src/protocols/a2a/A2AClient';
import type { Task, MessageSendParams } from '../../src/types';

// Helper to get a random available port
function getRandomPort(): number {
  return 20000 + Math.floor(Math.random() * 40000);
}

describe('Client-Server Integration', () => {
  let server: AgentServer;
  let client: A2AClient;
  let port: number;

  beforeEach(async () => {
    port = getRandomPort();
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('Basic Communication', () => {
    it('should complete full request-response cycle', async () => {
      server = new AgentServer({
        name: 'integration-agent',
        description: 'Integration test agent',
        version: '1.0.0',
        provider: { organization: 'Integration Test' },
        port,
        skills: [
          {
            id: 'greet',
            name: 'Greet',
            description: 'Greets users',
            tags: ['greeting'],
            inputModes: ['text'],
            outputModes: ['text'],
          },
        ],
      });

      server.onMessage(async (params: MessageSendParams): Promise<Task> => {
        const textPart = params.message.parts.find((p) => p.type === 'text');
        const text = textPart?.type === 'text' ? textPart.text : '';

        return {
          id: crypto.randomUUID(),
          contextId: params.contextId || crypto.randomUUID(),
          state: 'COMPLETED',
          message: {
            role: 'agent',
            parts: [{ type: 'text', text: `Hello! You said: ${text}` }],
          },
          artifacts: [],
          history: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      await server.start();

      client = new A2AClient({ agentUrl: `http://localhost:${port}` });

      // Discover agent
      const card = await client.discover();
      expect(card.name).toBe('integration-agent');

      // Send message
      const task = await client.sendMessage({
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'Testing!' }],
        },
      });

      expect(task.state).toBe('COMPLETED');
      expect(task.message?.parts[0]).toEqual({
        type: 'text',
        text: 'Hello! You said: Testing!',
      });
    });
  });

  describe('Multi-turn Conversation', () => {
    it('should maintain context across multiple messages', async () => {
      const conversationHistory: string[] = [];

      server = new AgentServer({
        name: 'conversation-agent',
        description: 'Multi-turn conversation agent',
        version: '1.0.0',
        provider: { organization: 'Test' },
        port,
        skills: [],
      });

      server.onMessage(async (params: MessageSendParams): Promise<Task> => {
        const textPart = params.message.parts.find((p) => p.type === 'text');
        const text = textPart?.type === 'text' ? textPart.text : '';

        conversationHistory.push(text);

        return {
          id: crypto.randomUUID(),
          contextId: params.contextId || crypto.randomUUID(),
          state: 'COMPLETED',
          message: {
            role: 'agent',
            parts: [
              {
                type: 'text',
                text: `Message ${conversationHistory.length}: ${text}`,
              },
            ],
          },
          artifacts: [],
          history: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      await server.start();

      client = new A2AClient({ agentUrl: `http://localhost:${port}` });
      const contextId = crypto.randomUUID();

      // Send multiple messages in same context
      const task1 = await client.sendMessage({
        message: { role: 'user', parts: [{ type: 'text', text: 'First' }] },
        contextId,
      });

      const task2 = await client.sendMessage({
        message: { role: 'user', parts: [{ type: 'text', text: 'Second' }] },
        contextId,
      });

      const task3 = await client.sendMessage({
        message: { role: 'user', parts: [{ type: 'text', text: 'Third' }] },
        contextId,
      });

      expect(task1.contextId).toBe(contextId);
      expect(task2.contextId).toBe(contextId);
      expect(task3.contextId).toBe(contextId);

      expect(conversationHistory).toEqual(['First', 'Second', 'Third']);
    });
  });

  describe('Task State Transitions', () => {
    it('should handle WORKING state with eventual completion', async () => {
      let taskState: 'WORKING' | 'COMPLETED' = 'WORKING';

      server = new AgentServer({
        name: 'async-agent',
        description: 'Asynchronous processing agent',
        version: '1.0.0',
        provider: { organization: 'Test' },
        port,
        skills: [],
      });

      server.onMessage(async (params: MessageSendParams): Promise<Task> => {
        const taskId = crypto.randomUUID();

        // Simulate async processing
        setTimeout(() => {
          taskState = 'COMPLETED';
        }, 100);

        return {
          id: taskId,
          contextId: params.contextId || crypto.randomUUID(),
          state: taskState,
          message:
            taskState === 'COMPLETED'
              ? {
                  role: 'agent',
                  parts: [{ type: 'text', text: 'Done!' }],
                }
              : undefined,
          artifacts: [],
          history: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      await server.start();

      client = new A2AClient({ agentUrl: `http://localhost:${port}` });

      const task = await client.sendMessage({
        message: { role: 'user', parts: [{ type: 'text', text: 'Process this' }] },
      });

      // Initial state should be WORKING
      expect(task.state).toBe('WORKING');
    });

    it('should handle INPUT_REQUIRED state', async () => {
      server = new AgentServer({
        name: 'input-agent',
        description: 'Agent requiring input',
        version: '1.0.0',
        provider: { organization: 'Test' },
        port,
        skills: [],
      });

      server.onMessage(async (params: MessageSendParams): Promise<Task> => {
        return {
          id: crypto.randomUUID(),
          contextId: params.contextId || crypto.randomUUID(),
          state: 'INPUT_REQUIRED',
          message: {
            role: 'agent',
            parts: [{ type: 'text', text: 'Please provide more information' }],
          },
          artifacts: [],
          history: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      await server.start();

      client = new A2AClient({ agentUrl: `http://localhost:${port}` });

      const task = await client.sendMessage({
        message: { role: 'user', parts: [{ type: 'text', text: 'Do something' }] },
      });

      expect(task.state).toBe('INPUT_REQUIRED');
    });

    it('should handle FAILED state', async () => {
      server = new AgentServer({
        name: 'failing-agent',
        description: 'Agent that reports failure',
        version: '1.0.0',
        provider: { organization: 'Test' },
        port,
        skills: [],
      });

      server.onMessage(async (params: MessageSendParams): Promise<Task> => {
        return {
          id: crypto.randomUUID(),
          contextId: params.contextId || crypto.randomUUID(),
          state: 'FAILED',
          message: {
            role: 'agent',
            parts: [{ type: 'text', text: 'Task failed' }],
          },
          artifacts: [],
          history: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      await server.start();

      client = new A2AClient({ agentUrl: `http://localhost:${port}` });

      const task = await client.sendMessage({
        message: { role: 'user', parts: [{ type: 'text', text: 'Will fail' }] },
      });

      expect(task.state).toBe('FAILED');
    });
  });

  describe('Artifacts', () => {
    it('should include artifacts in response', async () => {
      server = new AgentServer({
        name: 'artifact-agent',
        description: 'Agent producing artifacts',
        version: '1.0.0',
        provider: { organization: 'Test' },
        port,
        skills: [],
      });

      server.onMessage(async (params: MessageSendParams): Promise<Task> => {
        return {
          id: crypto.randomUUID(),
          contextId: params.contextId || crypto.randomUUID(),
          state: 'COMPLETED',
          message: {
            role: 'agent',
            parts: [{ type: 'text', text: 'Generated artifact' }],
          },
          artifacts: [
            {
              id: 'artifact-1',
              type: 'file',
              name: 'output.txt',
              mimeType: 'text/plain',
              content: 'Generated content',
            },
          ],
          history: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      await server.start();

      client = new A2AClient({ agentUrl: `http://localhost:${port}` });

      const task = await client.sendMessage({
        message: { role: 'user', parts: [{ type: 'text', text: 'Generate file' }] },
      });

      expect(task.artifacts).toHaveLength(1);
      expect(task.artifacts![0].name).toBe('output.txt');
      expect(task.artifacts![0].content).toBe('Generated content');
    });
  });

  describe('Error Handling', () => {
    it('should handle server errors gracefully', async () => {
      server = new AgentServer({
        name: 'error-agent',
        description: 'Agent that throws errors',
        version: '1.0.0',
        provider: { organization: 'Test' },
        port: 0, // Use OS-assigned port to avoid conflicts
        skills: [],
      });

      server.onMessage(async (): Promise<Task> => {
        throw new Error('Handler error');
      });

      await server.start();

      // Get actual port from agent card URL
      const agentUrl = new URL(server.getAgentCard().url);
      client = new A2AClient({ agentUrl: agentUrl.toString() });

      await expect(
        client.sendMessage({
          message: { role: 'user', parts: [{ type: 'text', text: 'Cause error' }] },
        })
      ).rejects.toThrow();
    });

    it('should handle concurrent requests', async () => {
      server = new AgentServer({
        name: 'concurrent-agent',
        description: 'Agent handling concurrent requests',
        version: '1.0.0',
        provider: { organization: 'Test' },
        port,
        skills: [],
      });

      let requestCount = 0;

      server.onMessage(async (params: MessageSendParams): Promise<Task> => {
        requestCount++;
        const current = requestCount;

        // Simulate varying processing times
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 50));

        return {
          id: crypto.randomUUID(),
          contextId: params.contextId || crypto.randomUUID(),
          state: 'COMPLETED',
          message: {
            role: 'agent',
            parts: [{ type: 'text', text: `Request ${current}` }],
          },
          artifacts: [],
          history: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      await server.start();

      client = new A2AClient({ agentUrl: `http://localhost:${port}` });

      // Send multiple concurrent requests
      const promises = Array(10)
        .fill(null)
        .map((_, i) =>
          client.sendMessage({
            message: { role: 'user', parts: [{ type: 'text', text: `Concurrent ${i}` }] },
          })
        );

      const tasks = await Promise.all(promises);

      expect(tasks).toHaveLength(10);
      expect(tasks.every((t) => t.state === 'COMPLETED')).toBe(true);
      expect(requestCount).toBe(10);
    });
  });
});
