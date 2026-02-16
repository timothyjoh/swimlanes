import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../db/testHelpers';
import { CardRepository } from './CardRepository';
import { ColumnRepository } from './ColumnRepository';
import { BoardRepository } from './BoardRepository';

describe('CardRepository', () => {
  let db: Database.Database;
  let repo: CardRepository;
  let columnRepo: ColumnRepository;
  let boardRepo: BoardRepository;
  let testColumnId: number;

  beforeEach(() => {
    db = createTestDb();
    repo = new CardRepository(db);
    columnRepo = new ColumnRepository(db);
    boardRepo = new BoardRepository(db);

    // Create a test board and column for cards
    const board = boardRepo.create('Test Board');
    const column = columnRepo.create(board.id, 'Todo', 0);
    testColumnId = column.id;
  });

  describe('create', () => {
    it('creates a new card with all fields', () => {
      const card = repo.create(testColumnId, 'Test Card', 'Description', '#FF5733', 0);

      expect(card.title).toBe('Test Card');
      expect(card.description).toBe('Description');
      expect(card.color).toBe('#FF5733');
      expect(card.column_id).toBe(testColumnId);
      expect(card.position).toBe(0);
      expect(card.id).toBeGreaterThan(0);
      expect(card.created_at).toBeDefined();
      expect(card.updated_at).toBeDefined();
    });

    it('creates card without optional fields', () => {
      const card = repo.create(testColumnId, 'Test Card');

      expect(card.title).toBe('Test Card');
      expect(card.description).toBeNull();
      expect(card.color).toBeNull();
      expect(card.position).toBe(0); // First card, auto-positioned at 0
    });

    it('auto-assigns position when not specified', () => {
      const card1 = repo.create(testColumnId, 'Card 1');
      const card2 = repo.create(testColumnId, 'Card 2');
      const card3 = repo.create(testColumnId, 'Card 3');

      expect(card1.position).toBe(0);
      expect(card2.position).toBe(1);
      expect(card3.position).toBe(2);
    });

    it('uses specified position when provided', () => {
      repo.create(testColumnId, 'Card 1', undefined, undefined, 0);
      const card = repo.create(testColumnId, 'Card 2', undefined, undefined, 5);

      expect(card.position).toBe(5);
    });
  });

  describe('findAll', () => {
    it('returns empty array when no cards exist', () => {
      const cards = repo.findAll();
      expect(cards).toEqual([]);
    });

    it('returns all cards ordered by column_id and position', () => {
      repo.create(testColumnId, 'Card 1', undefined, undefined, 0);
      repo.create(testColumnId, 'Card 2', undefined, undefined, 1);

      const cards = repo.findAll();
      expect(cards).toHaveLength(2);
      expect(cards[0].title).toBe('Card 1');
      expect(cards[1].title).toBe('Card 2');
    });
  });

  describe('findById', () => {
    it('returns card when it exists', () => {
      const created = repo.create(testColumnId, 'Test Card');
      const found = repo.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.title).toBe('Test Card');
    });

    it('returns undefined for non-existent card', () => {
      const card = repo.findById(999);
      expect(card).toBeUndefined();
    });
  });

  describe('findByColumnId', () => {
    it('returns empty array when column has no cards', () => {
      const cards = repo.findByColumnId(testColumnId);
      expect(cards).toEqual([]);
    });

    it('returns cards for specific column ordered by position', () => {
      repo.create(testColumnId, 'Card 3', undefined, undefined, 2);
      repo.create(testColumnId, 'Card 1', undefined, undefined, 0);
      repo.create(testColumnId, 'Card 2', undefined, undefined, 1);

      const cards = repo.findByColumnId(testColumnId);
      expect(cards).toHaveLength(3);
      expect(cards[0].title).toBe('Card 1');
      expect(cards[1].title).toBe('Card 2');
      expect(cards[2].title).toBe('Card 3');
    });

    it('returns only cards for specified column', () => {
      const board = boardRepo.create('Test Board');
      const column2 = columnRepo.create(board.id, 'Done', 1);

      repo.create(testColumnId, 'Card in Column 1');
      repo.create(column2.id, 'Card in Column 2');

      const cards = repo.findByColumnId(testColumnId);
      expect(cards).toHaveLength(1);
      expect(cards[0].title).toBe('Card in Column 1');
    });
  });

  describe('update', () => {
    it('updates title only', () => {
      const card = repo.create(testColumnId, 'Old Title', 'Description', '#FF5733');
      const updated = repo.update(card.id, { title: 'New Title' });

      expect(updated).toBeDefined();
      expect(updated!.title).toBe('New Title');
      expect(updated!.description).toBe('Description');
      expect(updated!.color).toBe('#FF5733');
    });

    it('updates description only', () => {
      const card = repo.create(testColumnId, 'Title', 'Old Description');
      const updated = repo.update(card.id, { description: 'New Description' });

      expect(updated).toBeDefined();
      expect(updated!.description).toBe('New Description');
      expect(updated!.title).toBe('Title');
    });

    it('updates color only', () => {
      const card = repo.create(testColumnId, 'Title', undefined, '#FF5733');
      const updated = repo.update(card.id, { color: '#00FF00' });

      expect(updated).toBeDefined();
      expect(updated!.color).toBe('#00FF00');
    });

    it('updates multiple fields', () => {
      const card = repo.create(testColumnId, 'Old Title', 'Old Description', '#FF5733');
      const updated = repo.update(card.id, {
        title: 'New Title',
        description: 'New Description',
        color: '#00FF00'
      });

      expect(updated).toBeDefined();
      expect(updated!.title).toBe('New Title');
      expect(updated!.description).toBe('New Description');
      expect(updated!.color).toBe('#00FF00');
    });

    it('returns undefined for non-existent card', () => {
      const updated = repo.update(999, { title: 'New Title' });
      expect(updated).toBeUndefined();
    });

    it('returns card unchanged when no updates provided', () => {
      const card = repo.create(testColumnId, 'Title');
      const updated = repo.update(card.id, {});

      expect(updated).toBeDefined();
      expect(updated!.title).toBe('Title');
    });
  });

  describe('updatePosition', () => {
    it('returns false for non-existent card', () => {
      const result = repo.updatePosition(999, 0);
      expect(result).toBe(false);
    });

    it('moves card down within same column', () => {
      const card1 = repo.create(testColumnId, 'Card 1');
      const card2 = repo.create(testColumnId, 'Card 2');
      const card3 = repo.create(testColumnId, 'Card 3');

      // Move Card 1 to position 2
      repo.updatePosition(card1.id, 2);

      const cards = repo.findByColumnId(testColumnId);
      expect(cards[0].title).toBe('Card 2'); // position 0
      expect(cards[1].title).toBe('Card 3'); // position 1
      expect(cards[2].title).toBe('Card 1'); // position 2
    });

    it('moves card up within same column', () => {
      const card1 = repo.create(testColumnId, 'Card 1');
      const card2 = repo.create(testColumnId, 'Card 2');
      const card3 = repo.create(testColumnId, 'Card 3');

      // Move Card 3 to position 0
      repo.updatePosition(card3.id, 0);

      const cards = repo.findByColumnId(testColumnId);
      expect(cards[0].title).toBe('Card 3'); // position 0
      expect(cards[1].title).toBe('Card 1'); // position 1
      expect(cards[2].title).toBe('Card 2'); // position 2
    });
  });

  describe('move', () => {
    it('returns false for non-existent card', () => {
      const result = repo.move(999, testColumnId, 0);
      expect(result).toBe(false);
    });

    it('moves card to different column', () => {
      const board = boardRepo.create('Test Board');
      const column2 = columnRepo.create(board.id, 'Done', 1);

      const card = repo.create(testColumnId, 'Card 1');
      repo.create(column2.id, 'Card 2');

      // Move Card 1 from testColumn to column2 at position 1
      repo.move(card.id, column2.id, 1);

      const column1Cards = repo.findByColumnId(testColumnId);
      const column2Cards = repo.findByColumnId(column2.id);

      expect(column1Cards).toHaveLength(0);
      expect(column2Cards).toHaveLength(2);
      expect(column2Cards[0].title).toBe('Card 2'); // position 0
      expect(column2Cards[1].title).toBe('Card 1'); // position 1
    });

    it('reorders cards when moving between columns', () => {
      const board = boardRepo.create('Test Board');
      const column2 = columnRepo.create(board.id, 'Done', 1);

      const card1 = repo.create(testColumnId, 'Card 1');
      const card2 = repo.create(testColumnId, 'Card 2');
      repo.create(column2.id, 'Card 3');
      repo.create(column2.id, 'Card 4');

      // Move Card 2 from testColumn to column2 at position 0
      repo.move(card2.id, column2.id, 0);

      const column1Cards = repo.findByColumnId(testColumnId);
      const column2Cards = repo.findByColumnId(column2.id);

      // Source column should have Card 1 at position 0
      expect(column1Cards).toHaveLength(1);
      expect(column1Cards[0].title).toBe('Card 1');
      expect(column1Cards[0].position).toBe(0);

      // Target column should have Card 2 inserted at position 0
      expect(column2Cards).toHaveLength(3);
      expect(column2Cards[0].title).toBe('Card 2'); // position 0
      expect(column2Cards[1].title).toBe('Card 3'); // position 1 (shifted)
      expect(column2Cards[2].title).toBe('Card 4'); // position 2 (shifted)
    });
  });

  describe('delete', () => {
    it('returns false for non-existent card', () => {
      const result = repo.delete(999);
      expect(result).toBe(false);
    });

    it('deletes card and returns true', () => {
      const card = repo.create(testColumnId, 'Test Card');
      const deleted = repo.delete(card.id);

      expect(deleted).toBe(true);
      expect(repo.findById(card.id)).toBeUndefined();
    });

    it('reorders remaining cards after deletion', () => {
      const card1 = repo.create(testColumnId, 'Card 1');
      const card2 = repo.create(testColumnId, 'Card 2');
      const card3 = repo.create(testColumnId, 'Card 3');

      // Delete Card 2 (position 1)
      repo.delete(card2.id);

      const cards = repo.findByColumnId(testColumnId);
      expect(cards).toHaveLength(2);
      expect(cards[0].title).toBe('Card 1');
      expect(cards[0].position).toBe(0);
      expect(cards[1].title).toBe('Card 3');
      expect(cards[1].position).toBe(1); // shifted from 2 to 1
    });
  });
});
