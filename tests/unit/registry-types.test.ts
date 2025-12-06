/**
 * Tests for types/registry.ts helper functions
 */

import { describe, it, expect } from 'bun:test';
import {
  parseHandle,
  createHandle,
  isValidHandle,
  isUrl,
  isDid,
} from '../../src/types/registry';

describe('parseHandle', () => {
  it('should parse valid handle into org and name', () => {
    const result = parseHandle('@myorg/my-agent');

    expect(result).not.toBeNull();
    expect(result?.org).toBe('myorg');
    expect(result?.name).toBe('my-agent');
  });

  it('should handle handles with underscores', () => {
    const result = parseHandle('@test_org/test_agent');

    expect(result).not.toBeNull();
    expect(result?.org).toBe('test_org');
    expect(result?.name).toBe('test_agent');
  });

  it('should handle handles with hyphens', () => {
    const result = parseHandle('@test-org/test-agent');

    expect(result).not.toBeNull();
    expect(result?.org).toBe('test-org');
    expect(result?.name).toBe('test-agent');
  });

  it('should return null for handle without @', () => {
    expect(parseHandle('myorg/my-agent')).toBeNull();
  });

  it('should return null for handle without /', () => {
    expect(parseHandle('@myorg-my-agent')).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(parseHandle('')).toBeNull();
  });

  it('should return null for just @', () => {
    expect(parseHandle('@')).toBeNull();
  });

  it('should return null for missing org', () => {
    expect(parseHandle('@/agent')).toBeNull();
  });

  it('should return null for missing name', () => {
    expect(parseHandle('@org/')).toBeNull();
  });
});

describe('createHandle', () => {
  it('should create handle from org and name', () => {
    const handle = createHandle('myorg', 'my-agent');

    expect(handle).toBe('@myorg/my-agent');
  });

  it('should handle empty strings', () => {
    const handle = createHandle('', '');

    expect(handle).toBe('@/');
  });

  it('should handle special characters', () => {
    const handle = createHandle('test-org', 'test_agent');

    expect(handle).toBe('@test-org/test_agent');
  });
});

describe('isValidHandle', () => {
  it('should return true for valid handles', () => {
    expect(isValidHandle('@myorg/my-agent')).toBe(true);
    expect(isValidHandle('@test/agent')).toBe(true);
    expect(isValidHandle('@org123/agent456')).toBe(true);
  });

  it('should return true for handles with underscores', () => {
    expect(isValidHandle('@my_org/my_agent')).toBe(true);
  });

  it('should return true for handles with hyphens', () => {
    expect(isValidHandle('@my-org/my-agent')).toBe(true);
  });

  it('should return false for handles without @', () => {
    expect(isValidHandle('myorg/my-agent')).toBe(false);
  });

  it('should return false for handles with spaces', () => {
    expect(isValidHandle('@my org/my agent')).toBe(false);
  });

  it('should return false for handles with dots', () => {
    expect(isValidHandle('@my.org/my.agent')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isValidHandle('')).toBe(false);
  });

  it('should return false for just @ symbol', () => {
    expect(isValidHandle('@')).toBe(false);
  });

  it('should return false for missing name part', () => {
    expect(isValidHandle('@org')).toBe(false);
  });
});

describe('isUrl', () => {
  it('should return true for http URLs', () => {
    expect(isUrl('http://example.com')).toBe(true);
    expect(isUrl('http://localhost:3000')).toBe(true);
  });

  it('should return true for https URLs', () => {
    expect(isUrl('https://example.com')).toBe(true);
    expect(isUrl('https://api.example.com/path')).toBe(true);
  });

  it('should return false for non-URL strings', () => {
    expect(isUrl('example.com')).toBe(false);
    expect(isUrl('ftp://example.com')).toBe(false);
    expect(isUrl('@org/agent')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isUrl('')).toBe(false);
  });

  it('should return false for DIDs', () => {
    expect(isUrl('did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK')).toBe(false);
  });
});

describe('isDid', () => {
  it('should return true for did:key DIDs', () => {
    expect(isDid('did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK')).toBe(true);
  });

  it('should return true for did:web DIDs', () => {
    expect(isDid('did:web:example.com')).toBe(true);
  });

  it('should return true for any did: prefix', () => {
    expect(isDid('did:example:123')).toBe(true);
  });

  it('should return false for non-DID strings', () => {
    expect(isDid('https://example.com')).toBe(false);
    expect(isDid('@org/agent')).toBe(false);
    expect(isDid('key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isDid('')).toBe(false);
  });
});
