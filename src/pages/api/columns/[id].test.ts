import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PATCH, DELETE } from './[id]';
import { getTestDb } from '@/lib/db/connection';
import { BoardRepository } from '@/lib/repositories/BoardRepository';
import { ColumnRepository } from '@/lib/repositories/ColumnRepository';
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

describe('PATCH /api/columns/:id', () => {
  let db: Database.Database;
  let columnRepo: ColumnRepository;
  let testColumnId: number;

  beforeEach(() => {
    // Create fresh test database for each test
    testDbInstance = getTestDb();
    db = testDbInstance;
    const boardRepo = new BoardRepository(db);
    columnRepo = new ColumnRepository(db);
    const board = boardRepo.create({ name: 'Test Board' });
    const column = columnRepo.create({ board_id: board.id, name: 'Test Column', position: 1 });
    testColumnId = column.id;
  });

  it('should update column name', async () => {
    const request = new Request(`http://localhost/api/columns/${testColumnId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'New Name' }),
    });

    const response = await PATCH({ params: { id: testColumnId.toString() }, request } as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.name).toBe('New Name');
  });

  it('should update column position', async () => {
    const request = new Request(`http://localhost/api/columns/${testColumnId}`, {
      method: 'PATCH',
      body: JSON.stringify({ position: 5 }),
    });

    const response = await PATCH({ params: { id: testColumnId.toString() }, request } as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.position).toBe(5);
  });

  it('should return 404 when column does not exist', async () => {
    const request = new Request('http://localhost/api/columns/99999', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'New Name' }),
    });

    const response = await PATCH({ params: { id: '99999' }, request } as any);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Column not found');
  });

  it('should return 400 for invalid column ID', async () => {
    const request = new Request('http://localhost/api/columns/abc', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Test' }),
    });

    const response = await PATCH({ params: { id: 'abc' }, request } as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid column ID');
  });

  it('should return 400 for invalid JSON', async () => {
    const request = new Request(`http://localhost/api/columns/${testColumnId}`, {
      method: 'PATCH',
      body: 'not json',
    });

    const response = await PATCH({ params: { id: testColumnId.toString() }, request } as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid JSON in request body');
  });

  it('should return 400 for empty name', async () => {
    const request = new Request(`http://localhost/api/columns/${testColumnId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: '   ' }),
    });

    const response = await PATCH({ params: { id: testColumnId.toString() }, request } as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Column name must be a non-empty string');
  });

  it('should return 400 for invalid position', async () => {
    const request = new Request(`http://localhost/api/columns/${testColumnId}`, {
      method: 'PATCH',
      body: JSON.stringify({ position: 0 }),
    });

    const response = await PATCH({ params: { id: testColumnId.toString() }, request } as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Position must be a positive integer');
  });
});

describe('DELETE /api/columns/:id', () => {
  let db: Database.Database;
  let columnRepo: ColumnRepository;
  let testColumnId: number;

  beforeEach(() => {
    // Create fresh test database for each test
    testDbInstance = getTestDb();
    db = testDbInstance;
    const boardRepo = new BoardRepository(db);
    columnRepo = new ColumnRepository(db);
    const board = boardRepo.create({ name: 'Test Board' });
    const column = columnRepo.create({ board_id: board.id, name: 'Test Column', position: 1 });
    testColumnId = column.id;
  });

  it('should delete a column and return 204', async () => {
    const request = new Request(`http://localhost/api/columns/${testColumnId}`, {
      method: 'DELETE',
    });

    const response = await DELETE({ params: { id: testColumnId.toString() }, request } as any);

    expect(response.status).toBe(204);
    expect(columnRepo.findById(testColumnId)).toBeNull();
  });

  it('should return 404 when column does not exist', async () => {
    const request = new Request('http://localhost/api/columns/99999', {
      method: 'DELETE',
    });

    const response = await DELETE({ params: { id: '99999' }, request } as any);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Column not found');
  });

  it('should return 400 for invalid column ID', async () => {
    const request = new Request('http://localhost/api/columns/abc', {
      method: 'DELETE',
    });

    const response = await DELETE({ params: { id: 'abc' }, request } as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid column ID');
  });
});
