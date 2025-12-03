/**
 * SQLite-based cache using bun:sqlite
 */

import { Database } from 'bun:sqlite';
import type { CacheConfig, CacheEntry } from '../types';

/**
 * Registry cache using Bun's native SQLite
 */
export class RegistryCache {
  private db: Database;
  private config: Required<CacheConfig>;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      ttl: 300, // 5 minutes default
      dbPath: ':memory:',
      maxSize: 10000,
      ...config,
    };

    this.db = new Database(this.config.dbPath);
    this.initSchema();
  }

  /**
   * Initialize the database schema
   */
  private initSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_expires_at ON cache(expires_at)
    `);
  }

  /**
   * Get a value from the cache
   */
  get<T>(key: string): T | null {
    const now = Date.now();
    const row = this.db
      .query<{ value: string }, [string, number]>(
        'SELECT value FROM cache WHERE key = ? AND expires_at > ?'
      )
      .get(key, now);

    if (!row) return null;

    try {
      return JSON.parse(row.value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Set a value in the cache
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl ?? this.config.ttl) * 1000;
    const now = Date.now();

    this.db.run(
      `INSERT OR REPLACE INTO cache (key, value, expires_at, created_at) VALUES (?, ?, ?, ?)`,
      [key, JSON.stringify(value), expiresAt, now]
    );

    // Cleanup expired entries periodically (10% chance)
    if (Math.random() < 0.1) {
      this.cleanup();
    }
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: string): boolean {
    const now = Date.now();
    const row = this.db
      .query<{ key: string }, [string, number]>(
        'SELECT key FROM cache WHERE key = ? AND expires_at > ?'
      )
      .get(key, now);

    return row !== null;
  }

  /**
   * Delete a key from the cache
   */
  delete(key: string): void {
    this.db.run('DELETE FROM cache WHERE key = ?', [key]);
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.db.run('DELETE FROM cache');
  }

  /**
   * Get all entries (for debugging)
   */
  entries<T>(): CacheEntry<T>[] {
    const now = Date.now();
    const rows = this.db
      .query<
        { key: string; value: string; expires_at: number; created_at: number },
        [number]
      >('SELECT * FROM cache WHERE expires_at > ?')
      .all(now);

    return rows.map((row) => ({
      key: row.key,
      value: JSON.parse(row.value) as T,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }));
  }

  /**
   * Get the number of entries in the cache
   */
  size(): number {
    const now = Date.now();
    const row = this.db
      .query<{ count: number }, [number]>(
        'SELECT COUNT(*) as count FROM cache WHERE expires_at > ?'
      )
      .get(now);

    return row?.count ?? 0;
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): void {
    const now = Date.now();
    this.db.run('DELETE FROM cache WHERE expires_at < ?', [now]);

    // Enforce max size by removing oldest entries
    const count = this.size();
    if (count > this.config.maxSize) {
      this.db.run(
        `
        DELETE FROM cache WHERE key IN (
          SELECT key FROM cache ORDER BY created_at ASC
          LIMIT ?
        )
      `,
        [count - this.config.maxSize]
      );
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get or set a value (with loader function)
   */
  async getOrSet<T>(
    key: string,
    loader: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await loader();
    this.set(key, value, ttl);
    return value;
  }
}

/**
 * Create a new registry cache
 */
export function createRegistryCache(config?: Partial<CacheConfig>): RegistryCache {
  return new RegistryCache(config);
}
