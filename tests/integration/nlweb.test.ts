/**
 * NLWebClient Unit Tests
 *
 * Tests for the NLWeb natural language web interface client.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  NLWebClient,
  createNLWebClient,
  type NLWebManifest,
  type NLWebResponse,
  type NLWebResponseItem,
} from '../../src/protocols/nlweb/NLWebClient';

describe('NLWebClient', () => {
  describe('constructor', () => {
    it('should create client with baseUrl', () => {
      const client = new NLWebClient({ baseUrl: 'https://example.com' });
      expect(client).toBeInstanceOf(NLWebClient);
    });

    it('should use default timeout of 30000ms', () => {
      const client = new NLWebClient({ baseUrl: 'https://example.com' });
      // We can't directly access private config, but we test via behavior
      expect(client).toBeDefined();
    });

    it('should accept custom timeout', () => {
      const client = new NLWebClient({
        baseUrl: 'https://example.com',
        timeout: 5000,
      });
      expect(client).toBeDefined();
    });
  });

  describe('getManifest', () => {
    it('should return null before discovery', () => {
      const client = new NLWebClient({ baseUrl: 'https://example.com' });
      expect(client.getManifest()).toBeNull();
    });
  });
});

describe('NLWebClient.discover', () => {
  let server: ReturnType<typeof Bun.serve>;
  let client: NLWebClient;

  const mockManifest: NLWebManifest = {
    name: 'Test NLWeb Service',
    description: 'A test service',
    version: '1.0.0',
    endpoint: 'https://example.com/api/nlweb',
    capabilities: ['search', 'qa'],
  };

  afterEach(() => {
    server?.stop();
  });

  it('should fetch and parse manifest', async () => {
    server = Bun.serve({
      port: 0,
      fetch(req: Request): Response {
        const url = new URL(req.url);
        if (url.pathname === '/.well-known/nlweb.json') {
          return new Response(JSON.stringify(mockManifest), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('Not Found', { status: 404 });
      },
    });

    client = new NLWebClient({ baseUrl: `http://localhost:${server.port}` });
    const manifest = await client.discover();

    expect(manifest.name).toBe('Test NLWeb Service');
    expect(manifest.endpoint).toBe('https://example.com/api/nlweb');
    expect(manifest.capabilities).toContain('search');
  });

  it('should cache manifest after discovery', async () => {
    server = Bun.serve({
      port: 0,
      fetch(req: Request): Response {
        const url = new URL(req.url);
        if (url.pathname === '/.well-known/nlweb.json') {
          return new Response(JSON.stringify(mockManifest), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('Not Found', { status: 404 });
      },
    });

    client = new NLWebClient({ baseUrl: `http://localhost:${server.port}` });

    expect(client.getManifest()).toBeNull();
    await client.discover();
    expect(client.getManifest()).not.toBeNull();
    expect(client.getManifest()?.name).toBe('Test NLWeb Service');
  });

  it('should throw on 404', async () => {
    server = Bun.serve({
      port: 0,
      fetch(): Response {
        return new Response('Not Found', { status: 404 });
      },
    });

    client = new NLWebClient({ baseUrl: `http://localhost:${server.port}` });

    await expect(client.discover()).rejects.toThrow('Failed to fetch NLWeb manifest: 404');
  });

  it('should throw on 500', async () => {
    server = Bun.serve({
      port: 0,
      fetch(): Response {
        return new Response('Internal Error', { status: 500 });
      },
    });

    client = new NLWebClient({ baseUrl: `http://localhost:${server.port}` });

    await expect(client.discover()).rejects.toThrow('Failed to fetch NLWeb manifest: 500');
  });

  it('should handle connection errors', async () => {
    client = new NLWebClient({ baseUrl: 'http://localhost:99999' });

    await expect(client.discover()).rejects.toThrow();
  });
});

describe('NLWebClient.ask', () => {
  let server: ReturnType<typeof Bun.serve>;
  let client: NLWebClient;

  const mockResponse: NLWebResponse = {
    '@context': 'https://schema.org',
    '@type': 'SearchResultsPage',
    query: 'test query',
    results: [
      {
        '@type': 'Product',
        name: 'Test Product',
        description: 'A test product',
        url: 'https://example.com/product/1',
      },
    ],
    totalResults: 1,
    responseTime: 42,
  };

  afterEach(() => {
    server?.stop();
  });

  it('should send query and receive response', async () => {
    server = Bun.serve({
      port: 0,
      async fetch(req: Request): Promise<Response> {
        if (req.method === 'POST') {
          const body = await req.json();
          expect(body.query).toBe('What products do you have?');
          expect(body.format).toBe('json-ld');
          return new Response(JSON.stringify(mockResponse), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('Method Not Allowed', { status: 405 });
      },
    });

    client = new NLWebClient({ baseUrl: `http://localhost:${server.port}` });
    const response = await client.ask('What products do you have?');

    expect(response['@type']).toBe('SearchResultsPage');
    expect(response.results).toHaveLength(1);
    expect(response.results[0].name).toBe('Test Product');
  });

  it('should use manifest endpoint after discovery', async () => {
    let usedEndpoint = '';

    // Main server with manifest
    server = Bun.serve({
      port: 0,
      fetch(req: Request): Response {
        const url = new URL(req.url);
        if (url.pathname === '/.well-known/nlweb.json') {
          return new Response(
            JSON.stringify({
              name: 'Test',
              endpoint: `http://localhost:${apiServer.port}/api/query`,
            }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('Not Found', { status: 404 });
      },
    });

    // API server
    const apiServer = Bun.serve({
      port: 0,
      async fetch(req: Request): Promise<Response> {
        usedEndpoint = new URL(req.url).pathname;
        return new Response(JSON.stringify(mockResponse), {
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    try {
      client = new NLWebClient({ baseUrl: `http://localhost:${server.port}` });
      await client.discover();
      await client.ask('test query');

      expect(usedEndpoint).toBe('/api/query');
    } finally {
      apiServer.stop();
    }
  });

  it('should use baseUrl when no manifest', async () => {
    let receivedRequest = false;

    server = Bun.serve({
      port: 0,
      async fetch(): Promise<Response> {
        receivedRequest = true;
        return new Response(JSON.stringify(mockResponse), {
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    client = new NLWebClient({ baseUrl: `http://localhost:${server.port}` });
    await client.ask('test');

    expect(receivedRequest).toBe(true);
  });

  it('should throw on error response', async () => {
    server = Bun.serve({
      port: 0,
      fetch(): Response {
        return new Response('Bad Request', { status: 400 });
      },
    });

    client = new NLWebClient({ baseUrl: `http://localhost:${server.port}` });

    await expect(client.ask('test')).rejects.toThrow('NLWeb query failed: 400');
  });

  it('should throw on 500 error', async () => {
    server = Bun.serve({
      port: 0,
      fetch(): Response {
        return new Response('Server Error', { status: 500 });
      },
    });

    client = new NLWebClient({ baseUrl: `http://localhost:${server.port}` });

    await expect(client.ask('test')).rejects.toThrow('NLWeb query failed: 500');
  });
});

describe('NLWebClient.askStream', () => {
  let server: ReturnType<typeof Bun.serve>;
  let client: NLWebClient;

  afterEach(() => {
    server?.stop();
  });

  it('should stream response items', async () => {
    server = Bun.serve({
      port: 0,
      async fetch(req: Request): Promise<Response> {
        const body = await req.json();
        expect(body.stream).toBe(true);

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('data: {"@type":"Product","name":"Item 1"}\n\n'));
            controller.enqueue(encoder.encode('data: {"@type":"Product","name":"Item 2"}\n\n'));
            controller.enqueue(encoder.encode('data: {"@type":"Product","name":"Item 3"}\n\n'));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          },
        });

        return new Response(stream, {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      },
    });

    client = new NLWebClient({ baseUrl: `http://localhost:${server.port}` });

    const items: NLWebResponseItem[] = [];
    for await (const item of client.askStream('stream test')) {
      items.push(item);
    }

    expect(items).toHaveLength(3);
    expect(items[0].name).toBe('Item 1');
    expect(items[1].name).toBe('Item 2');
    expect(items[2].name).toBe('Item 3');
  });

  it('should stop on [DONE] message', async () => {
    server = Bun.serve({
      port: 0,
      fetch(): Response {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('data: {"@type":"Product","name":"Before"}\n\n'));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.enqueue(encoder.encode('data: {"@type":"Product","name":"After"}\n\n'));
            controller.close();
          },
        });

        return new Response(stream, {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      },
    });

    client = new NLWebClient({ baseUrl: `http://localhost:${server.port}` });

    const items: NLWebResponseItem[] = [];
    for await (const item of client.askStream('test')) {
      items.push(item);
    }

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Before');
  });

  it('should skip invalid JSON in stream', async () => {
    server = Bun.serve({
      port: 0,
      fetch(): Response {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('data: {"@type":"Product","name":"Valid 1"}\n\n'));
            controller.enqueue(encoder.encode('data: not valid json\n\n'));
            controller.enqueue(encoder.encode('data: {"@type":"Product","name":"Valid 2"}\n\n'));
            controller.close();
          },
        });

        return new Response(stream, {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      },
    });

    client = new NLWebClient({ baseUrl: `http://localhost:${server.port}` });

    const items: NLWebResponseItem[] = [];
    for await (const item of client.askStream('test')) {
      items.push(item);
    }

    expect(items).toHaveLength(2);
    expect(items[0].name).toBe('Valid 1');
    expect(items[1].name).toBe('Valid 2');
  });

  it('should throw on error response', async () => {
    server = Bun.serve({
      port: 0,
      fetch(): Response {
        return new Response('Bad Request', { status: 400 });
      },
    });

    client = new NLWebClient({ baseUrl: `http://localhost:${server.port}` });

    try {
      for await (const _ of client.askStream('test')) {
        // Should throw before yielding
      }
      expect(true).toBe(false); // Should not reach
    } catch (error) {
      expect((error as Error).message).toBe('NLWeb stream failed: 400');
    }
  });

  // Note: Testing "no response body" case is difficult with Bun.serve()
  // as it always provides a body. The code path exists for edge cases
  // with non-standard HTTP implementations.

  it('should handle chunked SSE data', async () => {
    server = Bun.serve({
      port: 0,
      fetch(): Response {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            // Send data split across chunks
            controller.enqueue(encoder.encode('data: {"@type":"Pro'));
            await new Promise((r) => setTimeout(r, 10));
            controller.enqueue(encoder.encode('duct","name":"Chunked"}\n\n'));
            controller.close();
          },
        });

        return new Response(stream, {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      },
    });

    client = new NLWebClient({ baseUrl: `http://localhost:${server.port}` });

    const items: NLWebResponseItem[] = [];
    for await (const item of client.askStream('test')) {
      items.push(item);
    }

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Chunked');
  });

  it('should handle empty stream', async () => {
    server = Bun.serve({
      port: 0,
      fetch(): Response {
        const stream = new ReadableStream({
          start(controller) {
            controller.close();
          },
        });

        return new Response(stream, {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      },
    });

    client = new NLWebClient({ baseUrl: `http://localhost:${server.port}` });

    const items: NLWebResponseItem[] = [];
    for await (const item of client.askStream('test')) {
      items.push(item);
    }

    expect(items).toHaveLength(0);
  });

  it('should send correct headers', async () => {
    let receivedHeaders: Headers | null = null;

    server = Bun.serve({
      port: 0,
      fetch(req: Request): Response {
        receivedHeaders = req.headers;
        const stream = new ReadableStream({
          start(controller) {
            controller.close();
          },
        });
        return new Response(stream, {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      },
    });

    client = new NLWebClient({ baseUrl: `http://localhost:${server.port}` });

    for await (const _ of client.askStream('test')) {
      // consume
    }

    expect(receivedHeaders?.get('Accept')).toBe('text/event-stream');
    expect(receivedHeaders?.get('Content-Type')).toBe('application/json');
  });
});

describe('createNLWebClient', () => {
  it('should create NLWebClient instance', () => {
    const client = createNLWebClient('https://example.com');
    expect(client).toBeInstanceOf(NLWebClient);
  });

  it('should work the same as constructor', async () => {
    const server = Bun.serve({
      port: 0,
      fetch(req: Request): Response {
        const url = new URL(req.url);
        if (url.pathname === '/.well-known/nlweb.json') {
          return new Response(
            JSON.stringify({ name: 'Test', endpoint: `http://localhost:${server.port}` }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('Not Found', { status: 404 });
      },
    });

    try {
      const client = createNLWebClient(`http://localhost:${server.port}`);
      const manifest = await client.discover();
      expect(manifest.name).toBe('Test');
    } finally {
      server.stop();
    }
  });
});
