/**
 * MCP Bridge Unit Tests
 *
 * Tests for the MCP protocol bridge.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  MCPBridge,
  MCPAgentWrapper,
  createMCPBridge,
  type MCPTool,
  type MCPResource,
} from '../../src/protocols/mcp/MCPBridge';
import { AgentServer } from '../../src/server/AgentServer';

describe('MCPBridge', () => {
  let server: AgentServer;
  let bridge: MCPBridge;

  beforeEach(() => {
    server = new AgentServer({
      name: 'mcp-test-agent',
      description: 'Test agent for MCP bridge',
      version: '1.0.0',
      port: 0, // Don't actually start
      skills: [],
    });
    bridge = new MCPBridge(server);
  });

  describe('constructor', () => {
    it('should create bridge with agent server', () => {
      expect(bridge).toBeInstanceOf(MCPBridge);
    });

    it('should start with no tools', () => {
      expect(bridge.getTools()).toHaveLength(0);
    });

    it('should start with no resources', () => {
      expect(bridge.getResources()).toHaveLength(0);
    });
  });

  describe('registerTool', () => {
    it('should register a tool', () => {
      const tool: MCPTool = {
        name: 'search',
        description: 'Search the web',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
          required: ['query'],
        },
      };

      bridge.registerTool(tool);

      expect(bridge.getTools()).toHaveLength(1);
      expect(bridge.getTools()[0]).toEqual(tool);
    });

    it('should support fluent chaining', () => {
      const result = bridge
        .registerTool({
          name: 'tool1',
          description: 'First tool',
          inputSchema: {},
        })
        .registerTool({
          name: 'tool2',
          description: 'Second tool',
          inputSchema: {},
        });

      expect(result).toBe(bridge);
      expect(bridge.getTools()).toHaveLength(2);
    });

    it('should register multiple tools', () => {
      bridge.registerTool({
        name: 'read',
        description: 'Read a file',
        inputSchema: { type: 'object' },
      });
      bridge.registerTool({
        name: 'write',
        description: 'Write a file',
        inputSchema: { type: 'object' },
      });
      bridge.registerTool({
        name: 'delete',
        description: 'Delete a file',
        inputSchema: { type: 'object' },
      });

      expect(bridge.getTools()).toHaveLength(3);
    });

    it('should overwrite tool with same name', () => {
      bridge.registerTool({
        name: 'tool',
        description: 'Original',
        inputSchema: {},
      });
      bridge.registerTool({
        name: 'tool',
        description: 'Updated',
        inputSchema: { updated: true },
      });

      const tools = bridge.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].description).toBe('Updated');
    });
  });

  describe('registerResource', () => {
    it('should register a resource', () => {
      const resource: MCPResource = {
        uri: 'file:///docs/readme.md',
        name: 'README',
        description: 'Project readme',
        mimeType: 'text/markdown',
      };

      bridge.registerResource(resource);

      expect(bridge.getResources()).toHaveLength(1);
      expect(bridge.getResources()[0]).toEqual(resource);
    });

    it('should support fluent chaining', () => {
      const result = bridge
        .registerResource({
          uri: 'file:///a.txt',
          name: 'A',
        })
        .registerResource({
          uri: 'file:///b.txt',
          name: 'B',
        });

      expect(result).toBe(bridge);
      expect(bridge.getResources()).toHaveLength(2);
    });

    it('should register resource with minimal fields', () => {
      bridge.registerResource({
        uri: 'https://api.example.com/data',
        name: 'API Data',
      });

      const resources = bridge.getResources();
      expect(resources).toHaveLength(1);
      expect(resources[0].uri).toBe('https://api.example.com/data');
      expect(resources[0].description).toBeUndefined();
      expect(resources[0].mimeType).toBeUndefined();
    });

    it('should overwrite resource with same URI', () => {
      bridge.registerResource({
        uri: 'file:///doc.txt',
        name: 'Original',
      });
      bridge.registerResource({
        uri: 'file:///doc.txt',
        name: 'Updated',
        description: 'New description',
      });

      const resources = bridge.getResources();
      expect(resources).toHaveLength(1);
      expect(resources[0].name).toBe('Updated');
    });
  });

  describe('getTools', () => {
    it('should return empty array when no tools', () => {
      expect(bridge.getTools()).toEqual([]);
    });

    it('should return all registered tools', () => {
      bridge.registerTool({ name: 'a', description: 'A', inputSchema: {} });
      bridge.registerTool({ name: 'b', description: 'B', inputSchema: {} });

      const tools = bridge.getTools();
      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.name)).toContain('a');
      expect(tools.map((t) => t.name)).toContain('b');
    });
  });

  describe('getResources', () => {
    it('should return empty array when no resources', () => {
      expect(bridge.getResources()).toEqual([]);
    });

    it('should return all registered resources', () => {
      bridge.registerResource({ uri: 'file:///x', name: 'X' });
      bridge.registerResource({ uri: 'file:///y', name: 'Y' });

      const resources = bridge.getResources();
      expect(resources).toHaveLength(2);
      expect(resources.map((r) => r.name)).toContain('X');
      expect(resources.map((r) => r.name)).toContain('Y');
    });
  });

  describe('exposeAsMCP', () => {
    it('should not throw (stub implementation)', async () => {
      await expect(
        bridge.exposeAsMCP({ transport: 'sse', port: 3001 })
      ).resolves.toBeUndefined();
    });

    it('should accept stdio transport', async () => {
      await expect(
        bridge.exposeAsMCP({ transport: 'stdio' })
      ).resolves.toBeUndefined();
    });

    it('should accept custom endpoint', async () => {
      await expect(
        bridge.exposeAsMCP({ transport: 'sse', endpoint: '/mcp' })
      ).resolves.toBeUndefined();
    });
  });

  describe('connectToMCP', () => {
    it('should throw not implemented error', async () => {
      await expect(bridge.connectToMCP('http://localhost:3001')).rejects.toThrow(
        'MCP client connection not yet implemented'
      );
    });
  });
});

describe('MCPAgentWrapper', () => {
  let wrapper: MCPAgentWrapper;
  const tools: MCPTool[] = [
    { name: 'search', description: 'Search', inputSchema: {} },
    { name: 'fetch', description: 'Fetch', inputSchema: {} },
  ];

  beforeEach(() => {
    wrapper = new MCPAgentWrapper('http://localhost:3001', tools);
  });

  describe('constructor', () => {
    it('should store endpoint', () => {
      expect(wrapper.endpoint).toBe('http://localhost:3001');
    });

    it('should store tools', () => {
      expect(wrapper.tools).toHaveLength(2);
      expect(wrapper.tools[0].name).toBe('search');
    });

    it('should work with empty tools', () => {
      const emptyWrapper = new MCPAgentWrapper('http://example.com', []);
      expect(emptyWrapper.tools).toHaveLength(0);
    });
  });

  describe('callTool', () => {
    it('should throw not implemented error', async () => {
      await expect(
        wrapper.callTool('search', { query: 'test' })
      ).rejects.toThrow('MCP tool calls not yet implemented');
    });
  });

  describe('send', () => {
    it('should throw not implemented error', async () => {
      await expect(wrapper.send('Hello')).rejects.toThrow(
        'MCP message send not yet implemented'
      );
    });
  });
});

describe('createMCPBridge', () => {
  it('should create MCPBridge instance', () => {
    const server = new AgentServer({
      name: 'test',
      description: 'Test',
      version: '1.0.0',
      port: 0,
      skills: [],
    });

    const bridge = createMCPBridge(server);

    expect(bridge).toBeInstanceOf(MCPBridge);
  });

  it('should create independent instances', () => {
    const server = new AgentServer({
      name: 'test',
      description: 'Test',
      version: '1.0.0',
      port: 0,
      skills: [],
    });

    const bridge1 = createMCPBridge(server);
    const bridge2 = createMCPBridge(server);

    bridge1.registerTool({ name: 'only-in-1', description: 'Test', inputSchema: {} });

    expect(bridge1.getTools()).toHaveLength(1);
    expect(bridge2.getTools()).toHaveLength(0);
  });
});
