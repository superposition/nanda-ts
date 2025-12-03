/**
 * MCP Transport Unit Tests
 *
 * Tests for the MCP transport implementations.
 */

import { describe, it, expect } from 'bun:test';
import {
  SSETransport,
  StdioTransport,
  createSSETransport,
  createStdioTransport,
} from '../../src/protocols/mcp/transport';

describe('SSETransport', () => {
  describe('constructor', () => {
    it('should store endpoint', () => {
      const transport = new SSETransport('http://localhost:3001/mcp');
      expect(transport.endpoint).toBe('http://localhost:3001/mcp');
    });

    it('should accept any endpoint URL', () => {
      const transport = new SSETransport('https://api.example.com/v1/mcp');
      expect(transport.endpoint).toBe('https://api.example.com/v1/mcp');
    });
  });

  describe('send', () => {
    it('should throw not implemented error', async () => {
      const transport = new SSETransport('http://localhost:3001');

      await expect(transport.send({ method: 'test' })).rejects.toThrow(
        'SSE transport not yet implemented'
      );
    });

    it('should accept any request object', async () => {
      const transport = new SSETransport('http://localhost:3001');

      await expect(
        transport.send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1,
        })
      ).rejects.toThrow('SSE transport not yet implemented');
    });
  });

  describe('stream', () => {
    it('should throw not implemented error', async () => {
      const transport = new SSETransport('http://localhost:3001');

      try {
        for await (const _ of transport.stream()) {
          // Should not yield anything
        }
        expect(true).toBe(false); // Should not reach
      } catch (error) {
        expect((error as Error).message).toBe('SSE streaming not yet implemented');
      }
    });
  });
});

describe('StdioTransport', () => {
  describe('constructor', () => {
    it('should store command', () => {
      const transport = new StdioTransport('node');
      expect(transport.command).toBe('node');
    });

    it('should store args', () => {
      const transport = new StdioTransport('npx', ['-y', 'mcp-server']);
      expect(transport.args).toEqual(['-y', 'mcp-server']);
    });

    it('should default args to empty array', () => {
      const transport = new StdioTransport('python');
      expect(transport.args).toEqual([]);
    });

    it('should accept complex command with multiple args', () => {
      const transport = new StdioTransport('docker', [
        'run',
        '--rm',
        '-it',
        'mcp-server:latest',
      ]);

      expect(transport.command).toBe('docker');
      expect(transport.args).toHaveLength(4);
    });
  });

  describe('start', () => {
    it('should throw not implemented error', async () => {
      const transport = new StdioTransport('node', ['server.js']);

      await expect(transport.start()).rejects.toThrow(
        'Stdio transport not yet implemented'
      );
    });
  });

  describe('send', () => {
    it('should throw not implemented error', async () => {
      const transport = new StdioTransport('node', ['server.js']);

      await expect(transport.send({ method: 'test' })).rejects.toThrow(
        'Stdio send not yet implemented'
      );
    });
  });

  describe('stop', () => {
    it('should not throw (stub implementation)', async () => {
      const transport = new StdioTransport('node', ['server.js']);

      await expect(transport.stop()).resolves.toBeUndefined();
    });
  });
});

describe('createSSETransport', () => {
  it('should create SSETransport instance', () => {
    const transport = createSSETransport('http://localhost:3001');

    expect(transport).toBeInstanceOf(SSETransport);
    expect(transport.endpoint).toBe('http://localhost:3001');
  });

  it('should create independent instances', () => {
    const t1 = createSSETransport('http://host1:3001');
    const t2 = createSSETransport('http://host2:3002');

    expect(t1.endpoint).not.toBe(t2.endpoint);
  });
});

describe('createStdioTransport', () => {
  it('should create StdioTransport instance', () => {
    const transport = createStdioTransport('node', ['server.js']);

    expect(transport).toBeInstanceOf(StdioTransport);
    expect(transport.command).toBe('node');
    expect(transport.args).toEqual(['server.js']);
  });

  it('should work without args', () => {
    const transport = createStdioTransport('mcp-server');

    expect(transport.command).toBe('mcp-server');
    expect(transport.args).toEqual([]);
  });

  it('should create independent instances', () => {
    const t1 = createStdioTransport('node', ['a.js']);
    const t2 = createStdioTransport('python', ['b.py']);

    expect(t1.command).not.toBe(t2.command);
  });
});
