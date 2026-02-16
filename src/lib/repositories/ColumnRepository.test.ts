import { describe, it, expect, beforeEach } from 'vitest';
import { getTestDb } from '@/lib/db/connection';
import { ColumnRepository } from './ColumnRepository';
import { BoardRepository } from './BoardRepository';
import type { Database } from 'better-sqlite3';

describe('ColumnRepository', () => {
  let db: Database;
  let columnRepo: ColumnRepository;
  let boardRepo: BoardRepository;
  let testBoardId: number;

  beforeEach(() => {
    db = getTestDb();
    columnRepo = new ColumnRepository(db);
    boardRepo = new BoardRepository(db);

    // Create a test board for foreign key relationship
    const board = boardRepo.create({ name: 'Test Board' });
    testBoardId = board.id;
  });

  describe('create', () => {
    it('should create a new column with all fields', () => {
      const newColumn = {
        board_id: testBoardId,
        name: 'To Do',
        position: 1,
      };

      const column = columnRepo.create(newColumn);

      expect(column.id).toBeGreaterThan(0);
      expect(column.board_id).toBe(testBoardId);
      expect(column.name).toBe('To Do');
      expect(column.position).toBe(1);
      expect(column.created_at).toBeDefined();
    });

    it('should auto-increment IDs for multiple columns', () => {
      const col1 = columnRepo.create({ board_id: testBoardId, name: 'Col 1', position: 1 });
      const col2 = columnRepo.create({ board_id: testBoardId, name: 'Col 2', position: 2 });

      expect(col2.id).toBeGreaterThan(col1.id);
    });
  });

  describe('findByBoardId', () => {
    it('should return all columns for a board ordered by position', () => {
      columnRepo.create({ board_id: testBoardId, name: 'Done', position: 3 });
      columnRepo.create({ board_id: testBoardId, name: 'To Do', position: 1 });
      columnRepo.create({ board_id: testBoardId, name: 'In Progress', position: 2 });

      const columns = columnRepo.findByBoardId(testBoardId);

      expect(columns).toHaveLength(3);
      expect(columns[0].name).toBe('To Do');
      expect(columns[1].name).toBe('In Progress');
      expect(columns[2].name).toBe('Done');
      expect(columns[0].position).toBe(1);
      expect(columns[1].position).toBe(2);
      expect(columns[2].position).toBe(3);
    });

    it('should return empty array when board has no columns', () => {
      const columns = columnRepo.findByBoardId(testBoardId);
      expect(columns).toEqual([]);
    });

    it('should not return columns from other boards', () => {
      const board2 = boardRepo.create({ name: 'Other Board' });
      columnRepo.create({ board_id: testBoardId, name: 'Col 1', position: 1 });
      columnRepo.create({ board_id: board2.id, name: 'Col 2', position: 1 });

      const columns = columnRepo.findByBoardId(testBoardId);

      expect(columns).toHaveLength(1);
      expect(columns[0].name).toBe('Col 1');
    });
  });

  describe('findById', () => {
    it('should return a column by ID', () => {
      const created = columnRepo.create({ board_id: testBoardId, name: 'Test', position: 1 });
      const found = columnRepo.findById(created.id);

      expect(found).toEqual(created);
    });

    it('should return null when column does not exist', () => {
      const found = columnRepo.findById(99999);
      expect(found).toBeNull();
    });
  });

  describe('update', () => {
    it('should update column name', () => {
      const column = columnRepo.create({ board_id: testBoardId, name: 'Old Name', position: 1 });
      const updated = columnRepo.update(column.id, { name: 'New Name' });

      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('New Name');
      expect(updated!.position).toBe(1); // Unchanged
    });

    it('should update column position', () => {
      const column = columnRepo.create({ board_id: testBoardId, name: 'Test', position: 1 });
      const updated = columnRepo.update(column.id, { position: 5 });

      expect(updated).not.toBeNull();
      expect(updated!.position).toBe(5);
      expect(updated!.name).toBe('Test'); // Unchanged
    });

    it('should update both name and position', () => {
      const column = columnRepo.create({ board_id: testBoardId, name: 'Old', position: 1 });
      const updated = columnRepo.update(column.id, { name: 'New', position: 3 });

      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('New');
      expect(updated!.position).toBe(3);
    });

    it('should return null when updating non-existent column', () => {
      const updated = columnRepo.update(99999, { name: 'Test' });
      expect(updated).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a column and return true', () => {
      const column = columnRepo.create({ board_id: testBoardId, name: 'Test', position: 1 });
      const deleted = columnRepo.delete(column.id);

      expect(deleted).toBe(true);
      expect(columnRepo.findById(column.id)).toBeNull();
    });

    it('should return false when deleting non-existent column', () => {
      const deleted = columnRepo.delete(99999);
      expect(deleted).toBe(false);
    });
  });

  describe('cascade delete', () => {
    it('should delete columns when parent board is deleted', () => {
      // Create columns for the board
      const col1 = columnRepo.create({ board_id: testBoardId, name: 'Col 1', position: 1 });
      const col2 = columnRepo.create({ board_id: testBoardId, name: 'Col 2', position: 2 });

      // Verify columns exist
      expect(columnRepo.findById(col1.id)).not.toBeNull();
      expect(columnRepo.findById(col2.id)).not.toBeNull();

      // Delete the board (should cascade to columns)
      const stmt = db.prepare('DELETE FROM boards WHERE id = ?');
      stmt.run(testBoardId);

      // Verify columns are gone
      expect(columnRepo.findById(col1.id)).toBeNull();
      expect(columnRepo.findById(col2.id)).toBeNull();
      expect(columnRepo.findByBoardId(testBoardId)).toEqual([]);
    });
  });
});
