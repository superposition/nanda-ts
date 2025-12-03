/**
 * NLWeb Protocol Client
 *
 * Client for Microsoft's NLWeb natural language web interface.
 */

/**
 * NLWeb configuration
 */
export interface NLWebConfig {
  baseUrl: string;
  timeout?: number;
}

/**
 * NLWeb response item (Schema.org format)
 */
export interface NLWebResponseItem {
  '@type': string;
  name?: string;
  description?: string;
  url?: string;
  [key: string]: unknown;
}

/**
 * NLWeb response
 */
export interface NLWebResponse {
  '@context': string;
  '@type': string;
  query: string;
  results: NLWebResponseItem[];
  totalResults?: number;
  responseTime?: number;
}

/**
 * NLWeb manifest (discovery document)
 */
export interface NLWebManifest {
  name: string;
  description?: string;
  version?: string;
  endpoint: string;
  capabilities?: string[];
}

/**
 * NLWeb Client
 */
export class NLWebClient {
  private config: Required<NLWebConfig>;
  private manifest: NLWebManifest | null = null;

  constructor(config: NLWebConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  /**
   * Discover NLWeb capabilities
   */
  async discover(): Promise<NLWebManifest> {
    const manifestUrl = new URL(
      '/.well-known/nlweb.json',
      this.config.baseUrl
    ).toString();

    const response = await fetch(manifestUrl, {
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch NLWeb manifest: ${response.status}`);
    }

    this.manifest = await response.json();
    return this.manifest!;
  }

  /**
   * Ask a natural language question
   */
  async ask(query: string): Promise<NLWebResponse> {
    const endpoint = this.manifest?.endpoint ?? this.config.baseUrl;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        format: 'json-ld',
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`NLWeb query failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Stream a natural language query response
   */
  async *askStream(
    query: string
  ): AsyncGenerator<NLWebResponseItem, void, unknown> {
    const endpoint = this.manifest?.endpoint ?? this.config.baseUrl;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        query,
        format: 'json-ld',
        stream: true,
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`NLWeb stream failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body for streaming');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            try {
              yield JSON.parse(data);
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Get the manifest
   */
  getManifest(): NLWebManifest | null {
    return this.manifest;
  }
}

/**
 * Create an NLWeb client
 */
export function createNLWebClient(baseUrl: string): NLWebClient {
  return new NLWebClient({ baseUrl });
}
