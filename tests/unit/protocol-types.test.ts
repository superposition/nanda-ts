/**
 * Tests for types/protocol.ts helper functions
 */

import { describe, it, expect } from 'bun:test';
import {
  createTextMessage,
  extractText,
  type Message,
  type TextPart,
  type FilePart,
  type DataPart,
} from '../../src/types/protocol';

describe('createTextMessage', () => {
  it('should create a user message by default', () => {
    const message = createTextMessage('Hello, world!');

    expect(message.role).toBe('user');
    expect(message.parts.length).toBe(1);
    expect(message.parts[0].type).toBe('text');
    expect((message.parts[0] as TextPart).text).toBe('Hello, world!');
  });

  it('should create an agent message when specified', () => {
    const message = createTextMessage('Response from agent', 'agent');

    expect(message.role).toBe('agent');
    expect(message.parts.length).toBe(1);
    expect((message.parts[0] as TextPart).text).toBe('Response from agent');
  });

  it('should handle empty text', () => {
    const message = createTextMessage('');

    expect(message.role).toBe('user');
    expect(message.parts[0].type).toBe('text');
    expect((message.parts[0] as TextPart).text).toBe('');
  });

  it('should handle text with special characters', () => {
    const specialText = 'Hello\n\t"world" <>&';
    const message = createTextMessage(specialText);

    expect((message.parts[0] as TextPart).text).toBe(specialText);
  });
});

describe('extractText', () => {
  it('should extract text from a single text part', () => {
    const message: Message = {
      role: 'user',
      parts: [{ type: 'text', text: 'Hello' }],
    };

    expect(extractText(message)).toBe('Hello');
  });

  it('should concatenate multiple text parts with spaces', () => {
    const message: Message = {
      role: 'user',
      parts: [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: 'world' },
      ],
    };

    expect(extractText(message)).toBe('Hello world');
  });

  it('should filter out non-text parts', () => {
    const filePart: FilePart = {
      type: 'file',
      file: { name: 'test.txt', mimeType: 'text/plain' },
    };
    const dataPart: DataPart = {
      type: 'data',
      data: { key: 'value' },
    };
    const message: Message = {
      role: 'user',
      parts: [
        { type: 'text', text: 'Hello' },
        filePart,
        { type: 'text', text: 'world' },
        dataPart,
      ],
    };

    expect(extractText(message)).toBe('Hello world');
  });

  it('should return empty string for message with no text parts', () => {
    const message: Message = {
      role: 'user',
      parts: [
        { type: 'file', file: { name: 'test.txt' } } as FilePart,
        { type: 'data', data: { key: 'value' } } as DataPart,
      ],
    };

    expect(extractText(message)).toBe('');
  });

  it('should return empty string for message with empty parts array', () => {
    const message: Message = {
      role: 'user',
      parts: [],
    };

    expect(extractText(message)).toBe('');
  });

  it('should handle agent messages the same as user messages', () => {
    const message: Message = {
      role: 'agent',
      parts: [{ type: 'text', text: 'Agent response' }],
    };

    expect(extractText(message)).toBe('Agent response');
  });
});