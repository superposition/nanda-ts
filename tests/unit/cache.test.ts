/**
 * Cache Unit Tests
 *
 * Tests for the SQLite-based cache.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { RegistryCache, createRegistryCache } from '../../src/registry/cache';
import { unlink } from 'fs/promises';

describe('RegistryCache Unit Tests', () => {
  let cache: RegistryCache;
  const testDbPath = ':memory:';

  beforeEach(() => {
    cache = createRegistryCache({ dbPath: testDbPath });
  });

  afterEach(() => {
    cache.close();
  });

  describe('Basic Operations', () => {
    it('should set and get values', () => {
      cache.set('key1', { foo: 'bar' });
      const value = cache.get<{ foo: string }>('key1');

      expect(value).toEqual({ foo: 'bar' });
    });

    it('should return null for non-existent keys', () => {
      const value = cache.get('nonexistent');

      expect(value).toBeNull();
    });

    it('should delete values', () => {
      cache.set('key1', 'value1');
      cache.delete('key1');

      expect(cache.get('key1')).toBeNull();
    });

    it('should check if key exists', () => {
      cache.set('existing', 'value');

      expect(cache.has('existing')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should clear all values', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });
  });

  describe('TTL Expiration', () => {
    it('should expire values after TTL', async () => {
      // Set with 0.1 second TTL (TTL is in seconds)
      cache.set('short-lived', 'value', 0.1);

      // Should exist immediately
      expect(cache.get('short-lived')).toBe('value');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be expired
      expect(cache.get('short-lived')).toBeNull();
    });

    it('should use default TTL', () => {
      const shortTtlCache = createRegistryCache({
        dbPath: testDbPath,
        ttl: 1,
      });

      shortTtlCache.set('key', 'value');
      expect(shortTtlCache.get('key')).toBe('value');

      shortTtlCache.close();
    });

    it('should override default TTL per-key', () => {
      cache.set('custom-ttl', 'value', 5); // 5 second TTL
      expect(cache.get('custom-ttl')).toBe('value');
    });
  });

  describe('Data Types', () => {
    it('should handle string values', () => {
      cache.set('string', 'hello world');
      expect(cache.get('string')).toBe('hello world');
    });

    it('should handle number values', () => {
      cache.set('number', 42);
      expect(cache.get('number')).toBe(42);
    });

    it('should handle boolean values', () => {
      cache.set('bool-true', true);
      cache.set('bool-false', false);

      expect(cache.get('bool-true')).toBe(true);
      expect(cache.get('bool-false')).toBe(false);
    });

    it('should handle object values', () => {
      const obj = {
        name: 'test',
        nested: { a: 1, b: [1, 2, 3] },
      };

      cache.set('object', obj);
      expect(cache.get('object')).toEqual(obj);
    });

    it('should handle array values', () => {
      const arr = [1, 'two', { three: 3 }];

      cache.set('array', arr);
      expect(cache.get('array')).toEqual(arr);
    });

    it('should handle null values', () => {
      cache.set('null', null);
      expect(cache.get('null')).toBe(null);
    });
  });

  describe('Size and Entries', () => {
    it('should report size correctly', () => {
      expect(cache.size()).toBe(0);

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      expect(cache.size()).toBe(3);
    });

    it('should return entries', () => {
      cache.set('a', 1);
      cache.set('b', 2);

      const entries = cache.entries<number>();
      expect(entries).toHaveLength(2);
      expect(entries.map((e) => e.key).sort()).toEqual(['a', 'b']);
    });
  });

  describe('Update Operations', () => {
    it('should update existing values', () => {
      cache.set('updateable', { count: 1 });
      cache.set('updateable', { count: 2 });

      expect(cache.get('updateable')).toEqual({ count: 2 });
    });
  });

  describe('Async Operations', () => {
    it('should getOrSet with loader function', async () => {
      let loadCount = 0;

      const result1 = await cache.getOrSet('async-key', async () => {
        loadCount++;
        return 'loaded-value';
      });

      expect(result1).toBe('loaded-value');
      expect(loadCount).toBe(1);

      // Second call should use cache
      const result2 = await cache.getOrSet('async-key', async () => {
        loadCount++;
        return 'should-not-load';
      });

      expect(result2).toBe('loaded-value');
      expect(loadCount).toBe(1); // Should still be 1
    });
  });
});

describe('RegistryCache Persistence', () => {
  const testDbFile = './test-cache.db';

  afterEach(async () => {
    try {
      await unlink(testDbFile);
    } catch {
      // File may not exist
    }
  });

  it('should persist data to disk', () => {
    // Create cache and add data
    const cache1 = createRegistryCache({ dbPath: testDbFile });
    cache1.set('persistent', 'data');
    cache1.close();

    // Re-open cache and verify data
    const cache2 = createRegistryCache({ dbPath: testDbFile });
    expect(cache2.get('persistent')).toBe('data');
    cache2.close();
  });

  it('should handle concurrent access', () => {
    const cache = createRegistryCache({ dbPath: testDbFile });

    // Write many values quickly
    for (let i = 0; i < 100; i++) {
      cache.set(`key-${i}`, `value-${i}`);
    }

    // Verify all values
    for (let i = 0; i < 100; i++) {
      expect(cache.get(`key-${i}`)).toBe(`value-${i}`);
    }

    cache.close();
  });
});

describe('RegistryCache Edge Cases', () => {
  let cache: RegistryCache;

  beforeEach(() => {
    cache = createRegistryCache({ dbPath: ':memory:' });
  });

  afterEach(() => {
    cache.close();
  });

  it('should handle very long keys', () => {
    const longKey = 'a'.repeat(1000);
    cache.set(longKey, 'value');

    expect(cache.get(longKey)).toBe('value');
  });

  it('should handle special characters in keys', () => {
    cache.set('key:with:colons', 'value1');
    cache.set('key/with/slashes', 'value2');
    cache.set('key with spaces', 'value3');

    expect(cache.get('key:with:colons')).toBe('value1');
    expect(cache.get('key/with/slashes')).toBe('value2');
    expect(cache.get('key with spaces')).toBe('value3');
  });

  it('should handle empty string values', () => {
    cache.set('empty', '');
    expect(cache.get('empty')).toBe('');
  });

  it('should handle large values', () => {
    const largeValue = { data: 'x'.repeat(100000) };
    cache.set('large', largeValue);

    expect(cache.get<typeof largeValue>('large')?.data.length).toBe(100000);
  });
});
