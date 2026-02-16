import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST } from './columns';
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

describe('GET /api/boards/:boardId/columns', () => {
  let db: Database.Database;
  let boardRepo: BoardRepository;
  let columnRepo: ColumnRepository;
  let testBoardId: number;

  beforeEach(() => {
    // Create fresh test database for each test
    testDbInstance = getTestDb();
    db = testDbInstance;
    boardRepo = new BoardRepository(db);
    columnRepo = new ColumnRepository(db);
    const board = boardRepo.create({ name: 'Test Board' });
    testBoardId = board.id;
  });

  it('should return all columns for a board ordered by position', async () => {
    columnRepo.create({ board_id: testBoardId, name: 'Done', position: 3 });
    columnRepo.create({ board_id: testBoardId, name: 'To Do', position: 1 });
    columnRepo.create({ board_id: testBoardId, name: 'In Progress', position: 2 });

    const request = new Request(`http://localhost/api/boards/${testBoardId}/columns`);
    const response = await GET({ params: { boardId: testBoardId.toString() }, request } as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveLength(3);
    expect(data[0].name).toBe('To Do');
    expect(data[1].name).toBe('In Progress');
    expect(data[2].name).toBe('Done');
  });

  it('should return empty array when board has no columns', async () => {
    const request = new Request(`http://localhost/api/boards/${testBoardId}/columns`);
    const response = await GET({ params: { boardId: testBoardId.toString() }, request } as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual([]);
  });

  it('should return 404 when board does not exist', async () => {
    const request = new Request('http://localhost/api/boards/99999/columns');
    const response = await GET({ params: { boardId: '99999' }, request } as any);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Board not found');
  });

  it('should return 400 for invalid board ID format', async () => {
    const request = new Request('http://localhost/api/boards/abc/columns');
    const response = await GET({ params: { boardId: 'abc' }, request } as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid board ID');
  });
});

describe('POST /api/boards/:boardId/columns', () => {
  let db: Database.Database;
  let boardRepo: BoardRepository;
  let columnRepo: ColumnRepository;
  let testBoardId: number;

  beforeEach(() => {
    // Create fresh test database for each test
    testDbInstance = getTestDb();
    db = testDbInstance;
    boardRepo = new BoardRepository(db);
    columnRepo = new ColumnRepository(db);
    const board = boardRepo.create({ name: 'Test Board' });
    testBoardId = board.id;
  });

  it('should create a new column with auto-calculated position', async () => {
    const request = new Request(`http://localhost/api/boards/${testBoardId}/columns`, {
      method: 'POST',
      body: JSON.stringify({ name: 'To Do' }),
    });

    const response = await POST({ params: { boardId: testBoardId.toString() }, request } as any);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.name).toBe('To Do');
    expect(data.board_id).toBe(testBoardId);
    expect(data.position).toBe(1);
  });

  it('should append new column after existing ones', async () => {
    columnRepo.create({ board_id: testBoardId, name: 'Col 1', position: 1 });
    columnRepo.create({ board_id: testBoardId, name: 'Col 2', position: 2 });

    const request = new Request(`http://localhost/api/boards/${testBoardId}/columns`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Col 3' }),
    });

    const response = await POST({ params: { boardId: testBoardId.toString() }, request } as any);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.position).toBe(3);
  });

  it('should return 400 when name is missing', async () => {
    const request = new Request(`http://localhost/api/boards/${testBoardId}/columns`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST({ params: { boardId: testBoardId.toString() }, request } as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Column name is required');
  });

  it('should return 400 when name is empty string', async () => {
    const request = new Request(`http://localhost/api/boards/${testBoardId}/columns`, {
      method: 'POST',
      body: JSON.stringify({ name: '   ' }),
    });

    const response = await POST({ params: { boardId: testBoardId.toString() }, request } as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Column name is required');
  });

  it('should return 400 for invalid JSON', async () => {
    const request = new Request(`http://localhost/api/boards/${testBoardId}/columns`, {
      method: 'POST',
      body: 'not valid json',
    });

    const response = await POST({ params: { boardId: testBoardId.toString() }, request } as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid JSON in request body');
  });

  it('should return 404 when board does not exist', async () => {
    const request = new Request('http://localhost/api/boards/99999/columns', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    });

    const response = await POST({ params: { boardId: '99999' }, request } as any);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Board not found');
  });

  it('should return 400 for invalid board ID format', async () => {
    const request = new Request('http://localhost/api/boards/abc/columns', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    });

    const response = await POST({ params: { boardId: 'abc' }, request } as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid board ID');
  });
});
