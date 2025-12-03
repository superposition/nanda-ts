/**
 * SSE/Streaming Unit Tests
 *
 * Tests for the Server-Sent Events parser and streaming utilities.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  SSEParser,
  parseSSEStream,
  createSSEResponse,
  type SSEEvent,
} from '../../src/protocols/a2a/streaming';

describe('SSEParser', () => {
  let parser: SSEParser;

  beforeEach(() => {
    parser = new SSEParser();
  });

  describe('parse()', () => {
    it('should parse a simple data event', () => {
      const chunk = 'data: hello world\n\n';
      const events = parser.parse(chunk);

      expect(events).toHaveLength(1);
      expect(events[0].data).toBe('hello world');
    });

    it('should parse multiple events in one chunk', () => {
      const chunk = 'data: first\n\ndata: second\n\n';
      const events = parser.parse(chunk);

      expect(events).toHaveLength(2);
      expect(events[0].data).toBe('first');
      expect(events[1].data).toBe('second');
    });

    it('should handle multi-line data', () => {
      const chunk = 'data: line1\ndata: line2\ndata: line3\n\n';
      const events = parser.parse(chunk);

      expect(events).toHaveLength(1);
      expect(events[0].data).toBe('line1\nline2\nline3');
    });

    it('should parse event type field', () => {
      const chunk = 'event: custom\ndata: payload\n\n';
      const events = parser.parse(chunk);

      expect(events).toHaveLength(1);
      expect(events[0].event).toBe('custom');
      expect(events[0].data).toBe('payload');
    });

    it('should parse id field', () => {
      const chunk = 'id: msg-123\ndata: payload\n\n';
      const events = parser.parse(chunk);

      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('msg-123');
      expect(events[0].data).toBe('payload');
    });

    it('should parse retry field', () => {
      const chunk = 'retry: 5000\ndata: payload\n\n';
      const events = parser.parse(chunk);

      expect(events).toHaveLength(1);
      expect(events[0].retry).toBe(5000);
      expect(events[0].data).toBe('payload');
    });

    it('should parse all fields together', () => {
      const chunk = 'event: update\nid: 42\nretry: 3000\ndata: full event\n\n';
      const events = parser.parse(chunk);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        event: 'update',
        id: '42',
        retry: 3000,
        data: 'full event',
      });
    });

    it('should ignore comment lines', () => {
      const chunk = ': this is a comment\ndata: actual data\n\n';
      const events = parser.parse(chunk);

      expect(events).toHaveLength(1);
      expect(events[0].data).toBe('actual data');
    });

    it('should buffer incomplete events across chunks', () => {
      // First chunk - incomplete
      const events1 = parser.parse('data: partial');
      expect(events1).toHaveLength(0);

      // Second chunk - completes the event
      const events2 = parser.parse(' message\n\n');
      expect(events2).toHaveLength(1);
      expect(events2[0].data).toBe('partial message');
    });

    it('should handle split across multiple chunks', () => {
      parser.parse('data: ');
      parser.parse('hello');
      parser.parse(' world');
      const events = parser.parse('\n\n');

      expect(events).toHaveLength(1);
      expect(events[0].data).toBe('hello world');
    });

    it('should not emit events without data', () => {
      const chunk = 'event: ping\nid: 1\n\n';
      const events = parser.parse(chunk);

      // Event without data field should not be emitted
      expect(events).toHaveLength(0);
    });

    it('should handle empty data value', () => {
      const chunk = 'data: \n\n';
      const events = parser.parse(chunk);

      expect(events).toHaveLength(1);
      expect(events[0].data).toBe('');
    });

    it('should handle JSON data', () => {
      const jsonData = JSON.stringify({ message: 'hello', count: 42 });
      const chunk = `data: ${jsonData}\n\n`;
      const events = parser.parse(chunk);

      expect(events).toHaveLength(1);
      expect(JSON.parse(events[0].data)).toEqual({ message: 'hello', count: 42 });
    });
  });

  describe('reset()', () => {
    it('should clear the buffer', () => {
      // Add partial data to buffer
      parser.parse('data: incomplete');

      // Reset
      parser.reset();

      // New chunk should not include old data
      const events = parser.parse('data: fresh start\n\n');
      expect(events).toHaveLength(1);
      expect(events[0].data).toBe('fresh start');
    });

    it('should allow reuse after reset', () => {
      parser.parse('data: first\n\n');
      parser.reset();

      const events = parser.parse('data: second\n\n');
      expect(events).toHaveLength(1);
      expect(events[0].data).toBe('second');
    });
  });
});

describe('parseSSEStream', () => {
  /**
   * Helper to create a ReadableStream from SSE text
   */
  function createSSEReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let index = 0;

    return new ReadableStream({
      pull(controller) {
        if (index < chunks.length) {
          controller.enqueue(encoder.encode(chunks[index]));
          index++;
        } else {
          controller.close();
        }
      },
    });
  }

  it('should parse JSON data from stream', async () => {
    const stream = createSSEReadableStream([
      'data: {"id": 1}\n\n',
      'data: {"id": 2}\n\n',
    ]);

    const results: Array<{ id: number }> = [];
    for await (const item of parseSSEStream<{ id: number }>(stream)) {
      results.push(item);
    }

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ id: 1 });
    expect(results[1]).toEqual({ id: 2 });
  });

  it('should stop on [DONE] message', async () => {
    const stream = createSSEReadableStream([
      'data: {"id": 1}\n\n',
      'data: [DONE]\n\n',
      'data: {"id": 2}\n\n', // Should not be yielded
    ]);

    const results: Array<{ id: number }> = [];
    for await (const item of parseSSEStream<{ id: number }>(stream)) {
      results.push(item);
    }

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ id: 1 });
  });

  it('should skip invalid JSON', async () => {
    const stream = createSSEReadableStream([
      'data: {"valid": true}\n\n',
      'data: not json at all\n\n',
      'data: {"also": "valid"}\n\n',
    ]);

    const results: unknown[] = [];
    for await (const item of parseSSEStream(stream)) {
      results.push(item);
    }

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ valid: true });
    expect(results[1]).toEqual({ also: 'valid' });
  });

  it('should use custom parseData function', async () => {
    const stream = createSSEReadableStream([
      'data: hello\n\n',
      'data: world\n\n',
    ]);

    const results: string[] = [];
    for await (const item of parseSSEStream<string>(stream, (data) =>
      data.toUpperCase()
    )) {
      results.push(item);
    }

    expect(results).toEqual(['HELLO', 'WORLD']);
  });

  it('should handle chunks split across reads', async () => {
    const stream = createSSEReadableStream([
      'data: {"part',
      '": "one"}\n\n',
    ]);

    const results: unknown[] = [];
    for await (const item of parseSSEStream(stream)) {
      results.push(item);
    }

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ part: 'one' });
  });

  it('should handle empty stream', async () => {
    const stream = createSSEReadableStream([]);

    const results: unknown[] = [];
    for await (const item of parseSSEStream(stream)) {
      results.push(item);
    }

    expect(results).toHaveLength(0);
  });

  it('should handle stream with only comments', async () => {
    const stream = createSSEReadableStream([
      ': keepalive\n\n',
      ': another comment\n\n',
    ]);

    const results: unknown[] = [];
    for await (const item of parseSSEStream(stream)) {
      results.push(item);
    }

    expect(results).toHaveLength(0);
  });
});

describe('createSSEResponse', () => {
  /**
   * Helper to collect all chunks from a response stream
   */
  async function collectStream(response: Response): Promise<string> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const chunks: string[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(decoder.decode(value, { stream: true }));
    }

    return chunks.join('');
  }

  it('should create response with correct headers', () => {
    const { response } = createSSEResponse();

    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
    expect(response.headers.get('Connection')).toBe('keep-alive');
  });

  it('should allow custom headers', () => {
    const { response } = createSSEResponse({
      'X-Custom-Header': 'custom-value',
    });

    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('X-Custom-Header')).toBe('custom-value');
  });

  it('should send string data', async () => {
    const { response, send, close } = createSSEResponse();

    // Start reading in parallel
    const textPromise = collectStream(response);

    // Send data and close
    await send('hello world');
    close();

    // Read the response
    const text = await textPromise;
    expect(text).toBe('data: hello world\n\n');
  });

  it('should send SSEEvent object with all fields', async () => {
    const { response, send, close } = createSSEResponse();

    const textPromise = collectStream(response);

    const event: SSEEvent = {
      event: 'update',
      id: '123',
      retry: 5000,
      data: 'payload',
    };

    await send(event);
    close();

    const text = await textPromise;
    expect(text).toContain('event: update');
    expect(text).toContain('id: 123');
    expect(text).toContain('retry: 5000');
    expect(text).toContain('data: payload');
    expect(text).toEndWith('\n\n');
  });

  it('should send SSEEvent with only data', async () => {
    const { response, send, close } = createSSEResponse();

    const textPromise = collectStream(response);

    await send({ data: 'just data' });
    close();

    const text = await textPromise;
    expect(text).toBe('data: just data\n\n');
  });

  it('should send multiple events', async () => {
    const { response, send, close } = createSSEResponse();

    const textPromise = collectStream(response);

    await send('first');
    await send('second');
    await send('third');
    close();

    const text = await textPromise;
    expect(text).toBe(
      'data: first\n\n' +
      'data: second\n\n' +
      'data: third\n\n'
    );
  });

  it('should send JSON as string', async () => {
    const { response, send, close } = createSSEResponse();

    const textPromise = collectStream(response);

    const jsonData = JSON.stringify({ message: 'hello' });
    await send(jsonData);
    close();

    const text = await textPromise;
    expect(text).toBe('data: {"message":"hello"}\n\n');
  });

  it('should handle [DONE] message', async () => {
    const { response, send, close } = createSSEResponse();

    const textPromise = collectStream(response);

    await send({ data: 'processing' });
    await send('[DONE]');
    close();

    const text = await textPromise;
    expect(text).toContain('data: processing');
    expect(text).toContain('data: [DONE]');
  });
});

describe('SSE Integration', () => {
  it('should round-trip data through create and parse', async () => {
    const { response, send, close } = createSSEResponse();

    // Start consuming in parallel (important for streaming)
    const resultsPromise = (async () => {
      const results: Array<{ id: number; message: string }> = [];
      for await (const item of parseSSEStream<{ id: number; message: string }>(
        response.body!
      )) {
        results.push(item);
      }
      return results;
    })();

    // Send some events
    await send(JSON.stringify({ id: 1, message: 'first' }));
    await send(JSON.stringify({ id: 2, message: 'second' }));
    await send('[DONE]');
    close();

    const results = await resultsPromise;

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ id: 1, message: 'first' });
    expect(results[1]).toEqual({ id: 2, message: 'second' });
  });

  it('should handle event types in round-trip', async () => {
    const { response, send, close } = createSSEResponse();

    // Start collecting in parallel
    const textPromise = (async () => {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value, { stream: true }));
      }
      return chunks.join('');
    })();

    await send({
      event: 'task_update',
      id: 'task-1',
      data: JSON.stringify({ state: 'WORKING' }),
    });
    await send({
      event: 'task_complete',
      id: 'task-1',
      data: JSON.stringify({ state: 'COMPLETED' }),
    });
    close();

    // Parse with custom function to include event type
    const parser = new SSEParser();
    const text = await textPromise;
    const events = parser.parse(text + '\n'); // Add trailing newline for final event

    expect(events).toHaveLength(2);
    expect(events[0].event).toBe('task_update');
    expect(events[1].event).toBe('task_complete');
  });
});
