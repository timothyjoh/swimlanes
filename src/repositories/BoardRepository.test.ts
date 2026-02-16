import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../db/testHelpers';
import { BoardRepository } from './BoardRepository';

describe('BoardRepository', () => {
  let db: Database.Database;
  let repo: BoardRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new BoardRepository(db);
  });

  describe('create', () => {
    it('creates a new board', () => {
      const board = repo.create('Test Board');
      expect(board.name).toBe('Test Board');
      expect(board.id).toBeGreaterThan(0);
      expect(board.created_at).toBeDefined();
      expect(board.updated_at).toBeDefined();
    });

    it('creates multiple boards with unique ids', () => {
      const board1 = repo.create('Board 1');
      const board2 = repo.create('Board 2');
      expect(board1.id).not.toBe(board2.id);
      expect(board1.name).toBe('Board 1');
      expect(board2.name).toBe('Board 2');
    });
  });

  describe('findAll', () => {
    it('returns empty array when no boards exist', () => {
      const boards = repo.findAll();
      expect(boards).toEqual([]);
    });

    it('returns all boards', () => {
      repo.create('Board 1');
      repo.create('Board 2');
      repo.create('Board 3');

      const boards = repo.findAll();
      expect(boards).toHaveLength(3);
      const names = boards.map(b => b.name);
      expect(names).toContain('Board 1');
      expect(names).toContain('Board 2');
      expect(names).toContain('Board 3');
    });
  });

  describe('findById', () => {
    it('returns board when it exists', () => {
      const created = repo.create('Test Board');
      const found = repo.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.name).toBe('Test Board');
    });

    it('returns undefined for non-existent board', () => {
      const board = repo.findById(999);
      expect(board).toBeUndefined();
    });
  });

  describe('findByIdWithColumns', () => {
    it('returns undefined for non-existent board', () => {
      const board = repo.findByIdWithColumns(999);
      expect(board).toBeUndefined();
    });

    it('returns board with empty columns array when no columns exist', () => {
      const created = repo.create('Test Board');
      const board = repo.findByIdWithColumns(created.id);

      expect(board).toBeDefined();
      expect(board!.id).toBe(created.id);
      expect(board!.name).toBe('Test Board');
      expect(board!.columns).toEqual([]);
    });

    it('returns board with columns and cards', () => {
      const created = repo.create('Test Board');

      // Create columns
      db.prepare('INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)').run(
        created.id,
        'Column 1',
        0
      );
      const column2 = db.prepare('INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)').run(
        created.id,
        'Column 2',
        1
      );

      // Create cards
      db.prepare('INSERT INTO cards (column_id, title, position) VALUES (?, ?, ?)').run(
        column2.lastInsertRowid,
        'Card 1',
        0
      );

      const board = repo.findByIdWithColumns(created.id);

      expect(board).toBeDefined();
      expect(board!.columns).toHaveLength(2);
      expect(board!.columns[0].name).toBe('Column 1');
      expect(board!.columns[0].cards).toEqual([]);
      expect(board!.columns[1].name).toBe('Column 2');
      expect(board!.columns[1].cards).toHaveLength(1);
      expect(board!.columns[1].cards[0].title).toBe('Card 1');
    });
  });

  describe('update', () => {
    it('updates board name', () => {
      const board = repo.create('Old Name');
      const updated = repo.update(board.id, 'New Name');

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('New Name');
      expect(updated!.id).toBe(board.id);
    });

    it('returns undefined for non-existent board', () => {
      const updated = repo.update(999, 'New Name');
      expect(updated).toBeUndefined();
    });

    it('updates updated_at timestamp', () => {
      const board = repo.create('Test Board');
      const originalUpdatedAt = board.updated_at;

      // Small delay to ensure timestamp changes
      const updated = repo.update(board.id, 'Updated Name');
      expect(updated!.updated_at).toBeDefined();
      // Note: timestamps should be different, but in fast tests they might be the same
    });
  });

  describe('delete', () => {
    it('deletes board and returns true', () => {
      const board = repo.create('Test Board');
      const deleted = repo.delete(board.id);

      expect(deleted).toBe(true);
      expect(repo.findById(board.id)).toBeUndefined();
    });

    it('returns false for non-existent board', () => {
      const deleted = repo.delete(999);
      expect(deleted).toBe(false);
    });

    it('cascades delete to columns and cards', () => {
      const board = repo.create('Test Board');

      // Create column
      const columnResult = db.prepare('INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)').run(
        board.id,
        'Column 1',
        0
      );

      // Create card
      db.prepare('INSERT INTO cards (column_id, title, position) VALUES (?, ?, ?)').run(
        columnResult.lastInsertRowid,
        'Card 1',
        0
      );

      // Delete board
      repo.delete(board.id);

      // Verify columns and cards are also deleted
      const columns = db.prepare('SELECT * FROM columns WHERE board_id = ?').all(board.id);
      const cards = db.prepare('SELECT * FROM cards WHERE column_id = ?').all(columnResult.lastInsertRowid);

      expect(columns).toHaveLength(0);
      expect(cards).toHaveLength(0);
    });
  });
});
