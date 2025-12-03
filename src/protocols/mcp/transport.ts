/**
 * MCP Transport implementations
 */

/**
 * SSE Transport for MCP
 */
export class SSETransport {
  public readonly endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  /**
   * Send a JSON-RPC request via SSE
   */
  async send(_request: unknown): Promise<unknown> {
    // TODO: Implement SSE transport
    throw new Error('SSE transport not yet implemented');
  }

  /**
   * Create an SSE connection for streaming
   */
  async *stream(): AsyncGenerator<unknown, void, unknown> {
    // TODO: Implement SSE streaming
    throw new Error('SSE streaming not yet implemented');
  }
}

/**
 * Stdio Transport for local MCP servers
 */
export class StdioTransport {
  public readonly command: string;
  public readonly args: string[];

  constructor(command: string, args: string[] = []) {
    this.command = command;
    this.args = args;
  }

  /**
   * Start the MCP server process
   */
  async start(): Promise<void> {
    // TODO: Implement stdio transport using Bun.spawn
    throw new Error('Stdio transport not yet implemented');
  }

  /**
   * Send a JSON-RPC request via stdio
   */
  async send(_request: unknown): Promise<unknown> {
    // TODO: Implement stdio communication
    throw new Error('Stdio send not yet implemented');
  }

  /**
   * Stop the MCP server process
   */
  async stop(): Promise<void> {
    // TODO: Implement process termination
  }
}

/**
 * Create an SSE transport
 */
export function createSSETransport(endpoint: string): SSETransport {
  return new SSETransport(endpoint);
}

/**
 * Create a stdio transport
 */
export function createStdioTransport(
  command: string,
  args?: string[]
): StdioTransport {
  return new StdioTransport(command, args);
}
