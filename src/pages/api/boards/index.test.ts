import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GET, POST } from './index';
import { getTestDb } from '@/lib/db/connection';
import { BoardRepository } from '@/lib/repositories/BoardRepository';
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

describe('POST /api/boards', () => {
  it('creates a board and returns 201 with board data', async () => {
    const request = new Request('http://localhost/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Board' })
    });

    const response = await POST({ request } as any);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data).toMatchObject({
      id: expect.any(Number),
      name: 'New Board',
      created_at: expect.any(String)
    });
  });

  it('returns 400 when name is missing', async () => {
    const request = new Request('http://localhost/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const response = await POST({ request } as any);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('name is required');
  });

  it('returns 400 when name is empty string', async () => {
    const request = new Request('http://localhost/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '   ' })
    });

    const response = await POST({ request } as any);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('cannot be empty');
  });

  it('trims whitespace from board name', async () => {
    const request = new Request('http://localhost/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '  Trimmed Board  ' })
    });

    const response = await POST({ request } as any);
    const data = await response.json();
    expect(data.name).toBe('Trimmed Board');
  });

  it('returns 500 for malformed JSON request body', async () => {
    const request = new Request('http://localhost/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'this is not valid JSON'
    });

    const response = await POST({ request } as any);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal server error');
  });
});

describe('GET /api/boards', () => {
  it('returns empty array when no boards exist', async () => {
    const request = new Request('http://localhost/api/boards');
    const response = await GET({ request } as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual([]);
  });

  it('returns all boards ordered by created_at DESC', async () => {
    // Create boards via API
    await POST({
      request: new Request('http://localhost/api/boards', {
        method: 'POST',
        body: JSON.stringify({ name: 'First' })
      })
    } as any);

    await POST({
      request: new Request('http://localhost/api/boards', {
        method: 'POST',
        body: JSON.stringify({ name: 'Second' })
      })
    } as any);

    await POST({
      request: new Request('http://localhost/api/boards', {
        method: 'POST',
        body: JSON.stringify({ name: 'Third' })
      })
    } as any);

    const request = new Request('http://localhost/api/boards');
    const response = await GET({ request } as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.length).toBeGreaterThanOrEqual(3);

    // Find our boards
    const ourBoards = data.filter((b: any) =>
      ['First', 'Second', 'Third'].includes(b.name)
    );
    expect(ourBoards[0].name).toBe('Third');  // Most recent first
    expect(ourBoards[1].name).toBe('Second');
    expect(ourBoards[2].name).toBe('First');
  });
});

describe('Integration: POST → GET flow', () => {
  it('creates a board via POST and retrieves it via GET', async () => {
    // Create board
    const postRequest = new Request('http://localhost/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Integration Test Board' })
    });
    const postResponse = await POST({ request: postRequest } as any);
    const createdBoard = await postResponse.json();

    // Retrieve boards
    const getRequest = new Request('http://localhost/api/boards');
    const getResponse = await GET({ request: getRequest } as any);
    const boards = await getResponse.json();

    // Verify - the created board should be in the list
    const found = boards.find((b: any) => b.id === createdBoard.id);
    expect(found).toEqual(createdBoard);
  });
});
