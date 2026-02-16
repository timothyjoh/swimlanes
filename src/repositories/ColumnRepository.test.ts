import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../db/testHelpers';
import { ColumnRepository } from './ColumnRepository';
import { BoardRepository } from './BoardRepository';

describe('ColumnRepository', () => {
  let db: Database.Database;
  let repo: ColumnRepository;
  let boardRepo: BoardRepository;
  let testBoardId: number;

  beforeEach(() => {
    db = createTestDb();
    repo = new ColumnRepository(db);
    boardRepo = new BoardRepository(db);

    // Create a test board for columns
    const board = boardRepo.create('Test Board');
    testBoardId = board.id;
  });

  describe('create', () => {
    it('creates a new column', () => {
      const column = repo.create(testBoardId, 'Todo', 0);

      expect(column.name).toBe('Todo');
      expect(column.board_id).toBe(testBoardId);
      expect(column.position).toBe(0);
      expect(column.id).toBeGreaterThan(0);
      expect(column.created_at).toBeDefined();
      expect(column.updated_at).toBeDefined();
    });

    it('creates multiple columns with correct positions', () => {
      const col1 = repo.create(testBoardId, 'Todo', 0);
      const col2 = repo.create(testBoardId, 'In Progress', 1);
      const col3 = repo.create(testBoardId, 'Done', 2);

      expect(col1.position).toBe(0);
      expect(col2.position).toBe(1);
      expect(col3.position).toBe(2);
    });
  });

  describe('findAll', () => {
    it('returns empty array when no columns exist', () => {
      const columns = repo.findAll();
      expect(columns).toEqual([]);
    });

    it('returns all columns ordered by board_id and position', () => {
      repo.create(testBoardId, 'Todo', 0);
      repo.create(testBoardId, 'Done', 1);

      const columns = repo.findAll();
      expect(columns).toHaveLength(2);
      expect(columns[0].name).toBe('Todo');
      expect(columns[1].name).toBe('Done');
    });
  });

  describe('findById', () => {
    it('returns column when it exists', () => {
      const created = repo.create(testBoardId, 'Todo', 0);
      const found = repo.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.name).toBe('Todo');
    });

    it('returns undefined for non-existent column', () => {
      const column = repo.findById(999);
      expect(column).toBeUndefined();
    });
  });

  describe('findByBoardId', () => {
    it('returns empty array when board has no columns', () => {
      const columns = repo.findByBoardId(testBoardId);
      expect(columns).toEqual([]);
    });

    it('returns columns for specific board ordered by position', () => {
      repo.create(testBoardId, 'Done', 2);
      repo.create(testBoardId, 'Todo', 0);
      repo.create(testBoardId, 'In Progress', 1);

      const columns = repo.findByBoardId(testBoardId);
      expect(columns).toHaveLength(3);
      expect(columns[0].name).toBe('Todo');
      expect(columns[1].name).toBe('In Progress');
      expect(columns[2].name).toBe('Done');
    });

    it('returns only columns for specified board', () => {
      const board2 = boardRepo.create('Board 2');

      repo.create(testBoardId, 'Board 1 Column', 0);
      repo.create(board2.id, 'Board 2 Column', 0);

      const columns = repo.findByBoardId(testBoardId);
      expect(columns).toHaveLength(1);
      expect(columns[0].name).toBe('Board 1 Column');
    });
  });

  describe('update', () => {
    it('updates column name', () => {
      const column = repo.create(testBoardId, 'Old Name', 0);
      const updated = repo.update(column.id, 'New Name');

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('New Name');
      expect(updated!.id).toBe(column.id);
      expect(updated!.position).toBe(0); // position unchanged
    });

    it('returns undefined for non-existent column', () => {
      const updated = repo.update(999, 'New Name');
      expect(updated).toBeUndefined();
    });
  });

  describe('updatePosition', () => {
    it('returns false for non-existent column', () => {
      const result = repo.updatePosition(999, 0);
      expect(result).toBe(false);
    });

    it('does nothing when position unchanged', () => {
      const col = repo.create(testBoardId, 'Todo', 0);
      const result = repo.updatePosition(col.id, 0);

      expect(result).toBe(true);
      const updated = repo.findById(col.id);
      expect(updated!.position).toBe(0);
    });

    it('moves column down and shifts others up', () => {
      const col1 = repo.create(testBoardId, 'Col 1', 0);
      const col2 = repo.create(testBoardId, 'Col 2', 1);
      const col3 = repo.create(testBoardId, 'Col 3', 2);
      const col4 = repo.create(testBoardId, 'Col 4', 3);

      // Move Col 1 (position 0) to position 2
      repo.updatePosition(col1.id, 2);

      const columns = repo.findByBoardId(testBoardId);
      expect(columns[0].name).toBe('Col 2'); // position 0
      expect(columns[1].name).toBe('Col 3'); // position 1
      expect(columns[2].name).toBe('Col 1'); // position 2
      expect(columns[3].name).toBe('Col 4'); // position 3
    });

    it('moves column up and shifts others down', () => {
      const col1 = repo.create(testBoardId, 'Col 1', 0);
      const col2 = repo.create(testBoardId, 'Col 2', 1);
      const col3 = repo.create(testBoardId, 'Col 3', 2);
      const col4 = repo.create(testBoardId, 'Col 4', 3);

      // Move Col 4 (position 3) to position 1
      repo.updatePosition(col4.id, 1);

      const columns = repo.findByBoardId(testBoardId);
      expect(columns[0].name).toBe('Col 1'); // position 0
      expect(columns[1].name).toBe('Col 4'); // position 1
      expect(columns[2].name).toBe('Col 2'); // position 2
      expect(columns[3].name).toBe('Col 3'); // position 3
    });
  });

  describe('delete', () => {
    it('returns false for non-existent column', () => {
      const result = repo.delete(999);
      expect(result).toBe(false);
    });

    it('deletes column and returns true', () => {
      const column = repo.create(testBoardId, 'Todo', 0);
      const deleted = repo.delete(column.id);

      expect(deleted).toBe(true);
      expect(repo.findById(column.id)).toBeUndefined();
    });

    it('reorders remaining columns after deletion', () => {
      const col1 = repo.create(testBoardId, 'Col 1', 0);
      const col2 = repo.create(testBoardId, 'Col 2', 1);
      const col3 = repo.create(testBoardId, 'Col 3', 2);

      // Delete Col 2 (position 1)
      repo.delete(col2.id);

      const columns = repo.findByBoardId(testBoardId);
      expect(columns).toHaveLength(2);
      expect(columns[0].name).toBe('Col 1');
      expect(columns[0].position).toBe(0);
      expect(columns[1].name).toBe('Col 3');
      expect(columns[1].position).toBe(1); // shifted from 2 to 1
    });

    it('cascades delete to cards', () => {
      const column = repo.create(testBoardId, 'Todo', 0);

      // Create a card in this column
      db.prepare('INSERT INTO cards (column_id, title, position) VALUES (?, ?, ?)').run(
        column.id,
        'Test Card',
        0
      );

      // Delete column
      repo.delete(column.id);

      // Verify card is also deleted
      const cards = db.prepare('SELECT * FROM cards WHERE column_id = ?').all(column.id);
      expect(cards).toHaveLength(0);
    });
  });
});
