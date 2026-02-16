import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from './[id]';
import { POST } from './index';
import { getTestDb } from '@/lib/db/connection';
import type Database from 'better-sqlite3';

// Shared test database instance
let testDbInstance: Database.Database;

// Mock getDb to use test database
vi.mock('@/lib/db/connection', async () => {
  const actual = await vi.importActual('@/lib/db/connection');
  return {
    ...(actual as any),
    getDb: () => {
      if (!testDbInstance) {
        testDbInstance = (actual as any).getTestDb();
      }
      return testDbInstance;
    }
  };
});

beforeEach(() => {
  // Create fresh test database for each test
  testDbInstance = getTestDb();
});

describe('GET /api/boards/:id', () => {
  it('returns board when id exists', async () => {
    // Create a board first
    const postRequest = new Request('http://localhost/api/boards', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Board' })
    });
    const postResponse = await POST({ request: postRequest } as any);
    const created = await postResponse.json();

    const response = await GET({
      params: { id: String(created.id) }
    } as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual(created);
  });

  it('returns 404 when board not found', async () => {
    const response = await GET({
      params: { id: '999' }
    } as any);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toContain('not found');
  });

  it('returns 400 for invalid id format', async () => {
    const response = await GET({
      params: { id: 'not-a-number' }
    } as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid');
  });
});
