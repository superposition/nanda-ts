/**
 * AgentServer Unit Tests
 *
 * Tests for the A2A agent server.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { AgentServer } from '../../src/server/AgentServer';

// Helper to get port from AgentServer after start
function getServerPort(server: AgentServer): number {
  const url = new URL(server.getAgentCard().url);
  return parseInt(url.port, 10);
}

describe('AgentServer Unit Tests', () => {
  let server: AgentServer;
  let port: number;

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('Lifecycle', () => {
    it('should start and stop cleanly', async () => {
      server = new AgentServer({
        name: 'lifecycle-test',
        description: 'Test server lifecycle',
        version: '1.0.0',
        provider: { organization: 'Test' },
        port: 0,
        skills: [],
      });

      await server.start();
      expect(server.isRunning()).toBe(true);

      await server.stop();
      expect(server.isRunning()).toBe(false);
    });

    it('should handle multiple start calls gracefully', async () => {
      server = new AgentServer({
        name: 'double-start-test',
        description: 'Test double start handling',
        version: '1.0.0',
        provider: { organization: 'Test' },
        port: 0,
        skills: [],
      });

      await server.start();
      expect(server.isRunning()).toBe(true);

      // Second start should be idempotent (not throw)
      await server.start();
      expect(server.isRunning()).toBe(true);
    });

    it('should handle stop when not running', async () => {
      server = new AgentServer({
        name: 'stop-test',
        description: 'Test stop when not running',
        version: '1.0.0',
        provider: { organization: 'Test' },
        port: 0,
        skills: [],
      });

      // Should not throw
      await server.stop();
    });
  });

  describe('Agent Card', () => {
    it('should serve agent card at well-known URL', async () => {
      server = new AgentServer({
        name: 'card-test',
        description: 'Test agent card serving',
        version: '2.0.0',
        provider: { organization: 'Card Test Org' },
        port: 0,
        skills: [
          {
            id: 'test-skill',
            name: 'Test Skill',
            description: 'A test skill',
            tags: ['test'],
            inputModes: ['text'],
            outputModes: ['text'],
          },
        ],
      });

      await server.start();
      port = getServerPort(server);

      const response = await fetch(`http://localhost:${port}/.well-known/agent.json`);
      expect(response.ok).toBe(true);

      const card = await response.json();
      expect(card.name).toBe('card-test');
      expect(card.description).toBe('Test agent card serving');
      expect(card.version).toBe('2.0.0');
      expect(card.skills).toHaveLength(1);
      expect(card.skills[0].id).toBe('test-skill');
    });
  });

  describe('Health Check', () => {
    it('should respond to health check', async () => {
      server = new AgentServer({
        name: 'health-test',
        description: 'Test health check',
        version: '1.0.0',
        provider: { organization: 'Test' },
        port: 0,
        skills: [],
      });

      await server.start();
      port = getServerPort(server);

      const response = await fetch(`http://localhost:${port}/health`);
      expect(response.ok).toBe(true);

      const health = await response.json();
      expect(health.status).toBe('ok');
      expect(health.agentName).toBe('health-test');
    });
  });

  describe('JSON-RPC Handling', () => {
    it('should handle valid JSON-RPC request', async () => {
      server = new AgentServer({
        name: 'rpc-test',
        description: 'Test RPC handling',
        version: '1.0.0',
        provider: { organization: 'Test' },
        port: 0,
        skills: [],
      });

      server.onMessage(async (params, ctx) => {
        // Use context.createTask to properly store the task
        const task = ctx.createTask(
          {
            role: 'agent',
            parts: [{ type: 'text', text: 'Response' }],
          },
          params.contextId
        );
        ctx.updateTaskState(task.id, 'COMPLETED');
        return { ...task, state: 'COMPLETED' as const };
      });

      await server.start();
      port = getServerPort(server);

      const response = await fetch(`http://localhost:${port}/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'message/send',
          params: {
            message: {
              role: 'user',
              parts: [{ type: 'text', text: 'Hello' }],
            },
          },
          id: '1',
        }),
      });

      expect(response.ok).toBe(true);

      const result = await response.json();
      expect(result.jsonrpc).toBe('2.0');
      expect(result.result).toBeDefined();
      expect(result.result.state).toBe('COMPLETED');
    });

    it('should return error for invalid JSON', async () => {
      server = new AgentServer({
        name: 'invalid-json-test',
        description: 'Test invalid JSON handling',
        version: '1.0.0',
        provider: { organization: 'Test' },
        port: 0,
        skills: [],
      });

      await server.start();
      port = getServerPort(server);

      const response = await fetch(`http://localhost:${port}/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json',
      });

      const result = await response.json();
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(-32700); // Parse error
    });

    it('should return error for missing method', async () => {
      server = new AgentServer({
        name: 'missing-method-test',
        description: 'Test missing method handling',
        version: '1.0.0',
        provider: { organization: 'Test' },
        port: 0,
        skills: [],
      });

      await server.start();
      port = getServerPort(server);

      const response = await fetch(`http://localhost:${port}/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          params: {},
          id: '1',
        }),
      });

      const result = await response.json();
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(-32600); // Invalid request
    });

    it('should return error for unknown method', async () => {
      server = new AgentServer({
        name: 'unknown-method-test',
        description: 'Test unknown method handling',
        version: '1.0.0',
        provider: { organization: 'Test' },
        port: 0,
        skills: [],
      });

      await server.start();
      port = getServerPort(server);

      const response = await fetch(`http://localhost:${port}/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'nonexistent/method',
          params: {},
          id: '1',
        }),
      });

      const result = await response.json();
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(-32601); // Method not found
    });
  });

  describe('Task Methods', () => {
    it('should handle tasks/get', async () => {
      server = new AgentServer({
        name: 'tasks-get-test',
        description: 'Test tasks/get method',
        version: '1.0.0',
        provider: { organization: 'Test' },
        port: 0,
        skills: [],
      });

      let createdTaskId: string;

      server.onMessage(async (params, ctx) => {
        const task = ctx.createTask(
          {
            role: 'agent',
            parts: [{ type: 'text', text: 'Done' }],
          },
          params.contextId
        );
        createdTaskId = task.id;
        ctx.updateTaskState(task.id, 'COMPLETED');
        return { ...task, state: 'COMPLETED' as const };
      });

      await server.start();
      port = getServerPort(server);

      // First create a task
      const createResponse = await fetch(`http://localhost:${port}/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'message/send',
          params: {
            message: {
              role: 'user',
              parts: [{ type: 'text', text: 'Create task' }],
            },
          },
          id: '1',
        }),
      });

      const createResult = await createResponse.json();
      const taskId = createResult.result.id;

      // Then get it
      const response = await fetch(`http://localhost:${port}/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tasks/get',
          params: { taskId },
          id: '2',
        }),
      });

      const result = await response.json();
      expect(result.result).toBeDefined();
      expect(result.result.id).toBe(taskId);
    });

    it('should handle tasks/list', async () => {
      server = new AgentServer({
        name: 'tasks-list-test',
        description: 'Test tasks/list method',
        version: '1.0.0',
        provider: { organization: 'Test' },
        port: 0,
        skills: [],
      });

      server.onMessage(async (params, ctx) => {
        const task = ctx.createTask(
          {
            role: 'agent',
            parts: [{ type: 'text', text: 'Done' }],
          },
          params.contextId
        );
        ctx.updateTaskState(task.id, 'COMPLETED');
        return { ...task, state: 'COMPLETED' as const };
      });

      await server.start();
      port = getServerPort(server);

      // Create a task first
      await fetch(`http://localhost:${port}/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'message/send',
          params: {
            message: {
              role: 'user',
              parts: [{ type: 'text', text: 'Create task' }],
            },
          },
          id: '0',
        }),
      });

      const response = await fetch(`http://localhost:${port}/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tasks/list',
          params: {},
          id: '1',
        }),
      });

      const result = await response.json();
      expect(result.result).toBeDefined();
      expect(result.result.tasks).toBeDefined();
      expect(Array.isArray(result.result.tasks)).toBe(true);
      expect(result.result.tasks.length).toBeGreaterThanOrEqual(1);
    });
  });
});
