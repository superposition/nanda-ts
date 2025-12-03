/**
 * Server-Sent Events (SSE) parser for streaming responses
 */

/**
 * Parsed SSE event
 */
export interface SSEEvent {
  data: string;
  event?: string;
  id?: string;
  retry?: number;
}

/**
 * SSE parser for ReadableStream
 */
export class SSEParser {
  private buffer = '';

  /**
   * Parse a chunk of SSE data
   */
  parse(chunk: string): SSEEvent[] {
    this.buffer += chunk;
    const events: SSEEvent[] = [];
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    let currentEvent: Partial<SSEEvent> = {};

    for (const line of lines) {
      if (line === '') {
        // Empty line signals end of event
        if (currentEvent.data !== undefined) {
          events.push(currentEvent as SSEEvent);
        }
        currentEvent = {};
      } else if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (currentEvent.data !== undefined) {
          currentEvent.data += '\n' + data;
        } else {
          currentEvent.data = data;
        }
      } else if (line.startsWith('event: ')) {
        currentEvent.event = line.slice(7);
      } else if (line.startsWith('id: ')) {
        currentEvent.id = line.slice(4);
      } else if (line.startsWith('retry: ')) {
        currentEvent.retry = parseInt(line.slice(7), 10);
      } else if (line.startsWith(':')) {
        // Comment, ignore
      }
    }

    return events;
  }

  /**
   * Reset the parser buffer
   */
  reset(): void {
    this.buffer = '';
  }
}

/**
 * Parse SSE stream from a ReadableStream
 */
export async function* parseSSEStream<T>(
  body: ReadableStream<Uint8Array>,
  parseData: (data: string) => T | null = (data) => {
    if (data === '[DONE]') return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }
): AsyncGenerator<T, void, unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = new SSEParser();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const events = parser.parse(chunk);

      for (const event of events) {
        const parsed = parseData(event.data);
        if (parsed !== null) {
          yield parsed;
        } else if (event.data === '[DONE]') {
          return;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Create an SSE response for server use
 */
export function createSSEResponse(headers?: HeadersInit): {
  response: Response;
  writer: WritableStreamDefaultWriter<Uint8Array>;
  send: (event: SSEEvent | string) => Promise<void>;
  close: () => void;
} {
  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  const send = async (event: SSEEvent | string) => {
    let data: string;
    if (typeof event === 'string') {
      data = `data: ${event}\n\n`;
    } else {
      const lines: string[] = [];
      if (event.event) lines.push(`event: ${event.event}`);
      if (event.id) lines.push(`id: ${event.id}`);
      if (event.retry) lines.push(`retry: ${event.retry}`);
      lines.push(`data: ${event.data}`);
      data = lines.join('\n') + '\n\n';
    }
    await writer.write(encoder.encode(data));
  };

  const close = () => {
    writer.close();
  };

  const response = new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      ...headers,
    },
  });

  return { response, writer, send, close };
}
