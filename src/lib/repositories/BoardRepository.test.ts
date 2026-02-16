import { describe, it, expect, beforeEach } from 'vitest';
import { getTestDb } from '../db/connection';
import { BoardRepository } from './BoardRepository';
import type Database from 'better-sqlite3';

describe('BoardRepository', () => {
  let db: Database.Database;
  let repo: BoardRepository;

  beforeEach(() => {
    db = getTestDb();  // Fresh in-memory DB for each test
    repo = new BoardRepository(db);
  });

  describe('create', () => {
    it('creates a board and returns it with id and timestamp', () => {
      const board = repo.create({ name: 'Test Board' });

      expect(board).toMatchObject({
        id: expect.any(Number),
        name: 'Test Board',
        created_at: expect.any(String)
      });
      expect(board.id).toBeGreaterThan(0);
    });

    it('auto-increments board ids', () => {
      const board1 = repo.create({ name: 'Board 1' });
      const board2 = repo.create({ name: 'Board 2' });

      expect(board2.id).toBe(board1.id + 1);
    });
  });

  describe('findAll', () => {
    it('returns empty array when no boards exist', () => {
      const boards = repo.findAll();
      expect(boards).toEqual([]);
    });

    it('returns all boards ordered by created_at DESC', () => {
      const board1 = repo.create({ name: 'First' });
      const board2 = repo.create({ name: 'Second' });
      const board3 = repo.create({ name: 'Third' });

      const boards = repo.findAll();
      expect(boards).toHaveLength(3);
      // Most recent first
      expect(boards[0].id).toBe(board3.id);
      expect(boards[1].id).toBe(board2.id);
      expect(boards[2].id).toBe(board1.id);
    });
  });

  describe('findById', () => {
    it('returns board when id exists', () => {
      const created = repo.create({ name: 'Find Me' });
      const found = repo.findById(created.id);

      expect(found).toEqual(created);
    });

    it('returns null when id does not exist', () => {
      const found = repo.findById(999);
      expect(found).toBeNull();
    });
  });
});
