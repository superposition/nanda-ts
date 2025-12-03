/**
 * A2AHandler Unit Tests
 *
 * Tests for the A2A JSON-RPC handler edge cases.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { A2AHandler } from '../../src/server/A2AHandler';
import { JsonRpcErrorCode } from '../../src/types';

describe('A2AHandler', () => {
  let handler: A2AHandler;

  beforeEach(() => {
    handler = new A2AHandler();
  });

  describe('register and unregister', () => {
    it('should register a method handler', async () => {
      handler.register('test/method', async () => ({ success: true }));

      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'test/method',
          params: {},
          id: '1',
        }),
      });

      const response = await handler.handle(request);
      const result = await response.json();

      expect(result.result).toEqual({ success: true });
    });

    it('should unregister a method handler', async () => {
      handler.register('test/method', async () => ({ success: true }));
      handler.unregister('test/method');

      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'test/method',
          params: {},
          id: '1',
        }),
      });

      const response = await handler.handle(request);
      const result = await response.json();

      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(JsonRpcErrorCode.METHOD_NOT_FOUND);
    });

    it('should not throw when unregistering non-existent method', () => {
      expect(() => handler.unregister('non/existent')).not.toThrow();
    });
  });

  describe('task management', () => {
    it('should store and retrieve tasks', () => {
      const task = handler.createTask(
        { role: 'agent', parts: [{ type: 'text', text: 'Hello' }] },
        'ctx-1'
      );

      expect(task.id).toBeDefined();
      expect(task.contextId).toBe('ctx-1');
      expect(task.state).toBe('SUBMITTED');

      const retrieved = handler.getStoredTask(task.id);
      expect(retrieved).toEqual(task);
    });

    it('should return undefined for non-existent task', () => {
      const retrieved = handler.getStoredTask('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should update task state', () => {
      const task = handler.createTask(
        { role: 'agent', parts: [{ type: 'text', text: 'Test' }] }
      );

      handler.updateTaskState(task.id, 'WORKING');
      const updated = handler.getStoredTask(task.id);

      expect(updated?.state).toBe('WORKING');
      expect(updated?.updatedAt).toBeDefined();
    });

    it('should return undefined when updating non-existent task', () => {
      const result = handler.updateTaskState('non-existent', 'COMPLETED');
      expect(result).toBeUndefined();
    });

    it('should generate context ID if not provided', () => {
      const task = handler.createTask(
        { role: 'agent', parts: [{ type: 'text', text: 'Test' }] }
      );

      expect(task.contextId).toBeDefined();
      expect(task.contextId).toContain('ctx-');
    });

    it('should manually store task', () => {
      const task = {
        id: 'manual-task-1',
        contextId: 'ctx-manual',
        state: 'COMPLETED' as const,
        message: { role: 'agent' as const, parts: [{ type: 'text' as const, text: 'Stored' }] },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      handler.storeTask(task);
      const retrieved = handler.getStoredTask('manual-task-1');

      expect(retrieved).toEqual(task);
    });
  });

  describe('tasks/cancel', () => {
    it('should cancel a task', async () => {
      const task = handler.createTask(
        { role: 'agent', parts: [{ type: 'text', text: 'To be cancelled' }] }
      );

      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tasks/cancel',
          params: { taskId: task.id },
          id: '1',
        }),
      });

      const response = await handler.handle(request);
      const result = await response.json();

      expect(result.result).toBeDefined();
      expect(result.result.id).toBe(task.id);
      expect(result.result.state).toBe('CANCELLED');
    });

    it('should return error for missing taskId in cancel', async () => {
      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tasks/cancel',
          params: {},
          id: '1',
        }),
      });

      const response = await handler.handle(request);
      const result = await response.json();

      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(JsonRpcErrorCode.INVALID_PARAMS);
      expect(result.error.message).toContain('Missing taskId');
    });

    it('should return error for non-existent task in cancel', async () => {
      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tasks/cancel',
          params: { taskId: 'non-existent-task' },
          id: '1',
        }),
      });

      const response = await handler.handle(request);
      const result = await response.json();

      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(-32003); // TASK_NOT_FOUND
      expect(result.error.message).toContain('Task not found');
    });
  });

  describe('tasks/get edge cases', () => {
    it('should return error for missing taskId', async () => {
      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tasks/get',
          params: {},
          id: '1',
        }),
      });

      const response = await handler.handle(request);
      const result = await response.json();

      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(JsonRpcErrorCode.INVALID_PARAMS);
    });

    it('should return error for non-existent task', async () => {
      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tasks/get',
          params: { taskId: 'does-not-exist' },
          id: '1',
        }),
      });

      const response = await handler.handle(request);
      const result = await response.json();

      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(-32003);
    });
  });

  describe('tasks/list edge cases', () => {
    it('should filter by contextId', async () => {
      // Create tasks with different contexts
      handler.createTask(
        { role: 'agent', parts: [{ type: 'text', text: 'Task 1' }] },
        'context-a'
      );
      handler.createTask(
        { role: 'agent', parts: [{ type: 'text', text: 'Task 2' }] },
        'context-a'
      );
      handler.createTask(
        { role: 'agent', parts: [{ type: 'text', text: 'Task 3' }] },
        'context-b'
      );

      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tasks/list',
          params: { contextId: 'context-a' },
          id: '1',
        }),
      });

      const response = await handler.handle(request);
      const result = await response.json();

      expect(result.result.tasks).toHaveLength(2);
      expect(result.result.total).toBe(2);
    });

    it('should paginate results', async () => {
      // Create 5 tasks
      for (let i = 0; i < 5; i++) {
        handler.createTask(
          { role: 'agent', parts: [{ type: 'text', text: `Task ${i}` }] }
        );
      }

      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tasks/list',
          params: { limit: 2, offset: 0 },
          id: '1',
        }),
      });

      const response = await handler.handle(request);
      const result = await response.json();

      expect(result.result.tasks).toHaveLength(2);
      expect(result.result.total).toBe(5);
      expect(result.result.hasMore).toBe(true);
    });

    it('should return hasMore false when no more results', async () => {
      handler.createTask(
        { role: 'agent', parts: [{ type: 'text', text: 'Task 1' }] }
      );

      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tasks/list',
          params: { limit: 10 },
          id: '1',
        }),
      });

      const response = await handler.handle(request);
      const result = await response.json();

      expect(result.result.hasMore).toBe(false);
    });
  });

  describe('handleStream', () => {
    it('should handle stream with valid method', async () => {
      handler.register('stream/test', async (_params, ctx) => {
        if (ctx.emit) {
          await ctx.emit({ progress: 50 });
        }
        return { done: true };
      });

      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'stream/test',
          params: {},
          id: '1',
        }),
      });

      const response = await handler.handleStream(request);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');

      // Collect stream content
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value, { stream: true }));
      }

      const content = chunks.join('');
      expect(content).toContain('data:');
      expect(content).toContain('[DONE]');
    });

    it('should return error for invalid JSON in stream', async () => {
      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await handler.handleStream(request);
      const result = await response.json();

      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(JsonRpcErrorCode.PARSE_ERROR);
    });

    it('should return SSE response for unknown method in stream', async () => {
      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'unknown/method',
          params: {},
          id: '1',
        }),
      });

      const response = await handler.handleStream(request);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');

      // Just verify the response type - actual error handling is tested in integration tests
      // to avoid race conditions with the async background processing
      expect(response.body).toBeDefined();
    });

    it('should handle errors in stream handler', async () => {
      handler.register('stream/error', async () => {
        throw new Error('Stream handler error');
      });

      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'stream/error',
          params: {},
          id: '1',
        }),
      });

      const response = await handler.handleStream(request);

      // Collect stream content
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value, { stream: true }));
      }

      const content = chunks.join('');
      expect(content).toContain('error');
      expect(content).toContain('Stream handler error');
    });
  });

  describe('error handling', () => {
    it('should handle handler errors gracefully', async () => {
      handler.register('error/method', async () => {
        throw new Error('Handler error');
      });

      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'error/method',
          params: {},
          id: '1',
        }),
      });

      const response = await handler.handle(request);
      const result = await response.json();

      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(JsonRpcErrorCode.INTERNAL_ERROR);
      expect(result.error.message).toBe('Handler error');
    });

    it('should call onError callback', async () => {
      let capturedError: Error | null = null;
      let capturedContext: unknown = null;

      const handlerWithCallback = new A2AHandler({
        onError: (error, context) => {
          capturedError = error;
          capturedContext = context;
        },
      });

      handlerWithCallback.register('error/callback', async () => {
        throw new Error('Callback test error');
      });

      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'error/callback',
          params: {},
          id: 'error-test-id',
        }),
      });

      await handlerWithCallback.handle(request);

      expect(capturedError).not.toBeNull();
      expect(capturedError?.message).toBe('Callback test error');
      expect(capturedContext).toBeDefined();
    });

    it('should handle non-Error throws', async () => {
      handler.register('error/string', async () => {
        throw 'String error';
      });

      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'error/string',
          params: {},
          id: '1',
        }),
      });

      const response = await handler.handle(request);
      const result = await response.json();

      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Internal error');
    });
  });

  describe('JSON-RPC validation', () => {
    it('should reject missing jsonrpc version', async () => {
      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'test',
          params: {},
          id: '1',
        }),
      });

      const response = await handler.handle(request);
      const result = await response.json();

      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(JsonRpcErrorCode.INVALID_REQUEST);
    });

    it('should reject missing id', async () => {
      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'test',
          params: {},
        }),
      });

      const response = await handler.handle(request);
      const result = await response.json();

      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(JsonRpcErrorCode.INVALID_REQUEST);
    });

    it('should accept id of 0', async () => {
      handler.register('test/zero-id', async () => ({ success: true }));

      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'test/zero-id',
          params: {},
          id: 0,
        }),
      });

      const response = await handler.handle(request);
      const result = await response.json();

      expect(result.result).toEqual({ success: true });
      expect(result.id).toBe(0);
    });
  });
});
