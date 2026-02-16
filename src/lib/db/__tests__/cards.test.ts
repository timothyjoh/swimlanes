import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlinkSync } from "node:fs";
import { getDb, closeDb } from "../connection";
import { createBoard } from "../boards";
import { createColumn, deleteColumn } from "../columns";
import {
  createCard,
  listCardsByColumn,
  getCardById,
  updateCard,
  deleteCard,
  updateCardPosition,
  updateCardColumn,
  rebalanceCardPositions,
  searchCards,
  archiveCard,
  listArchivedCards,
  restoreCard,
  deleteCardPermanently,
} from "../cards";

let tempDbPath: string;

beforeEach(() => {
  closeDb();
  tempDbPath = join(
    tmpdir(),
    `test-cards-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
  );
  getDb(tempDbPath);
});

afterEach(() => {
  closeDb();
  try { unlinkSync(tempDbPath); } catch {}
  try { unlinkSync(tempDbPath + "-wal"); } catch {}
  try { unlinkSync(tempDbPath + "-shm"); } catch {}
});

function setupBoardAndColumn() {
  const board = createBoard("Test Board");
  const column = createColumn(board.id, "To Do");
  return { board, column };
}

describe("createCard", () => {
  it("creates and returns card with id, title, position, timestamps", () => {
    const { column } = setupBoardAndColumn();
    const card = createCard(column.id, "My Task");
    expect(card.id).toBeTypeOf("number");
    expect(card.column_id).toBe(column.id);
    expect(card.title).toBe("My Task");
    expect(card.description).toBeNull();
    expect(card.color).toBeNull();
    expect(card.position).toBe(1000);
    expect(card.created_at).toBeTypeOf("string");
    expect(card.updated_at).toBeTypeOf("string");
  });

  it("creates card with description and color", () => {
    const { column } = setupBoardAndColumn();
    const card = createCard(column.id, "Task", "A description", "blue");
    expect(card.title).toBe("Task");
    expect(card.description).toBe("A description");
    expect(card.color).toBe("blue");
  });

  it("calculates position 1000 for first card", () => {
    const { column } = setupBoardAndColumn();
    const card = createCard(column.id, "First");
    expect(card.position).toBe(1000);
  });

  it("calculates position 2000 for second card", () => {
    const { column } = setupBoardAndColumn();
    createCard(column.id, "First");
    const second = createCard(column.id, "Second");
    expect(second.position).toBe(2000);
  });

  it("calculates position 3000 for third card", () => {
    const { column } = setupBoardAndColumn();
    createCard(column.id, "First");
    createCard(column.id, "Second");
    const third = createCard(column.id, "Third");
    expect(third.position).toBe(3000);
  });

  it("trims whitespace from title", () => {
    const { column } = setupBoardAndColumn();
    const card = createCard(column.id, "  Trimmed  ");
    expect(card.title).toBe("Trimmed");
  });

  it("throws on empty title", () => {
    const { column } = setupBoardAndColumn();
    expect(() => createCard(column.id, "")).toThrow("Card title cannot be empty");
  });

  it("throws on whitespace-only title", () => {
    const { column } = setupBoardAndColumn();
    expect(() => createCard(column.id, "   ")).toThrow(
      "Card title cannot be empty"
    );
  });

  it("throws on non-existent column_id", () => {
    expect(() => createCard(99999, "Test")).toThrow("Column not found");
  });

  it("stores null for undefined description and color", () => {
    const { column } = setupBoardAndColumn();
    const card = createCard(column.id, "Task");
    expect(card.description).toBeNull();
    expect(card.color).toBeNull();
  });
});

describe("listCardsByColumn", () => {
  it("returns empty array for column with no cards", () => {
    const { column } = setupBoardAndColumn();
    expect(listCardsByColumn(column.id)).toEqual([]);
  });

  it("returns cards sorted by position ASC", () => {
    const { column } = setupBoardAndColumn();
    createCard(column.id, "First");
    createCard(column.id, "Second");
    createCard(column.id, "Third");

    const cards = listCardsByColumn(column.id);
    expect(cards).toHaveLength(3);
    expect(cards[0].title).toBe("First");
    expect(cards[1].title).toBe("Second");
    expect(cards[2].title).toBe("Third");
    expect(cards[0].position).toBeLessThan(cards[1].position);
    expect(cards[1].position).toBeLessThan(cards[2].position);
  });

  it("returns only cards for specified column", () => {
    const board = createBoard("Test Board");
    const col1 = createColumn(board.id, "Col 1");
    const col2 = createColumn(board.id, "Col 2");
    createCard(col1.id, "Card A");
    createCard(col2.id, "Card B");

    const cards1 = listCardsByColumn(col1.id);
    expect(cards1).toHaveLength(1);
    expect(cards1[0].title).toBe("Card A");
  });
});

describe("getCardById", () => {
  it("returns card when found", () => {
    const { column } = setupBoardAndColumn();
    const created = createCard(column.id, "Find Me");
    const found = getCardById(created.id);
    expect(found).toBeDefined();
    expect(found!.title).toBe("Find Me");
    expect(found!.id).toBe(created.id);
  });

  it("returns undefined when not found", () => {
    expect(getCardById(99999)).toBeUndefined();
  });
});

describe("updateCard", () => {
  it("updates title successfully", () => {
    const { column } = setupBoardAndColumn();
    const card = createCard(column.id, "Original");
    const updated = updateCard(card.id, { title: "Updated" });
    expect(updated).toBeDefined();
    expect(updated!.title).toBe("Updated");
  });

  it("updates description successfully", () => {
    const { column } = setupBoardAndColumn();
    const card = createCard(column.id, "Task");
    const updated = updateCard(card.id, { description: "New desc" });
    expect(updated).toBeDefined();
    expect(updated!.description).toBe("New desc");
  });

  it("updates color successfully", () => {
    const { column } = setupBoardAndColumn();
    const card = createCard(column.id, "Task");
    const updated = updateCard(card.id, { color: "red" });
    expect(updated).toBeDefined();
    expect(updated!.color).toBe("red");
  });

  it("updates multiple fields at once", () => {
    const { column } = setupBoardAndColumn();
    const card = createCard(column.id, "Task");
    const updated = updateCard(card.id, {
      title: "New Title",
      description: "New desc",
      color: "blue",
    });
    expect(updated).toBeDefined();
    expect(updated!.title).toBe("New Title");
    expect(updated!.description).toBe("New desc");
    expect(updated!.color).toBe("blue");
  });

  it("clears description with null", () => {
    const { column } = setupBoardAndColumn();
    const card = createCard(column.id, "Task", "Desc");
    const updated = updateCard(card.id, { description: null });
    expect(updated).toBeDefined();
    expect(updated!.description).toBeNull();
  });

  it("clears color with null", () => {
    const { column } = setupBoardAndColumn();
    const card = createCard(column.id, "Task", null, "red");
    const updated = updateCard(card.id, { color: null });
    expect(updated).toBeDefined();
    expect(updated!.color).toBeNull();
  });

  it("throws on empty title", () => {
    const { column } = setupBoardAndColumn();
    const card = createCard(column.id, "Task");
    expect(() => updateCard(card.id, { title: "" })).toThrow(
      "Card title cannot be empty"
    );
  });

  it("throws on whitespace-only title", () => {
    const { column } = setupBoardAndColumn();
    const card = createCard(column.id, "Task");
    expect(() => updateCard(card.id, { title: "   " })).toThrow(
      "Card title cannot be empty"
    );
  });

  it("returns undefined for non-existent id", () => {
    expect(updateCard(99999, { title: "Nope" })).toBeUndefined();
  });

  it("returns card unchanged when no updates provided", () => {
    const { column } = setupBoardAndColumn();
    const card = createCard(column.id, "Task");
    const result = updateCard(card.id, {});
    expect(result).toBeDefined();
    expect(result!.title).toBe("Task");
  });
});

describe("deleteCard", () => {
  it("deletes card and returns true", () => {
    const { column } = setupBoardAndColumn();
    const card = createCard(column.id, "Delete Me");
    expect(deleteCard(card.id)).toBe(true);
    expect(getCardById(card.id)).toBeUndefined();
  });

  it("returns false for non-existent id", () => {
    expect(deleteCard(99999)).toBe(false);
  });
});

describe("updateCardPosition", () => {
  it("updates position successfully", () => {
    const { column } = setupBoardAndColumn();
    const card = createCard(column.id, "Movable");
    const updated = updateCardPosition(card.id, 500);
    expect(updated).toBeDefined();
    expect(updated!.position).toBe(500);
  });

  it("returns undefined for non-existent id", () => {
    expect(updateCardPosition(99999, 500)).toBeUndefined();
  });
});

describe("updateCardColumn", () => {
  it("moves card to different column", () => {
    const board = createBoard("Test Board");
    const col1 = createColumn(board.id, "Col 1");
    const col2 = createColumn(board.id, "Col 2");
    const card = createCard(col1.id, "Move Me");

    const updated = updateCardColumn(card.id, col2.id, 1000);
    expect(updated).toBeDefined();
    expect(updated!.column_id).toBe(col2.id);
    expect(updated!.position).toBe(1000);
  });

  it("updates both column_id and position", () => {
    const board = createBoard("Test Board");
    const col1 = createColumn(board.id, "Col 1");
    const col2 = createColumn(board.id, "Col 2");
    const card = createCard(col1.id, "Move Me");

    const updated = updateCardColumn(card.id, col2.id, 2500);
    expect(updated!.column_id).toBe(col2.id);
    expect(updated!.position).toBe(2500);
  });

  it("throws on non-existent column_id", () => {
    const { column } = setupBoardAndColumn();
    const card = createCard(column.id, "Task");
    expect(() => updateCardColumn(card.id, 99999, 1000)).toThrow(
      "Column not found"
    );
  });

  it("returns undefined for non-existent card id", () => {
    const { column } = setupBoardAndColumn();
    expect(updateCardColumn(99999, column.id, 1000)).toBeUndefined();
  });
});

describe("CASCADE DELETE", () => {
  it("deletes cards when column is deleted", () => {
    const { column } = setupBoardAndColumn();
    createCard(column.id, "Card 1");
    createCard(column.id, "Card 2");
    createCard(column.id, "Card 3");

    expect(listCardsByColumn(column.id)).toHaveLength(3);

    deleteColumn(column.id);

    expect(listCardsByColumn(column.id)).toHaveLength(0);
  });
});

describe("rebalanceCardPositions", () => {
  it("returns false when positions are healthy (gap >= 10)", () => {
    const { column } = setupBoardAndColumn();
    createCard(column.id, "Card 1"); // position 1000
    createCard(column.id, "Card 2"); // position 2000
    createCard(column.id, "Card 3"); // position 3000

    const result = rebalanceCardPositions(column.id);
    expect(result).toBe(false);
  });

  it("returns true and rebalances when gap < 10", () => {
    const { column } = setupBoardAndColumn();
    const card1 = createCard(column.id, "Card 1");
    const card2 = createCard(column.id, "Card 2");
    const card3 = createCard(column.id, "Card 3");

    // Manually set positions to force convergence
    updateCardPosition(card1.id, 1000);
    updateCardPosition(card2.id, 1005);
    updateCardPosition(card3.id, 1008); // gap = 3, triggers rebalancing

    const result = rebalanceCardPositions(column.id);
    expect(result).toBe(true);

    // Verify positions after rebalancing
    const cards = listCardsByColumn(column.id);
    expect(cards[0].position).toBe(1000);
    expect(cards[1].position).toBe(2000);
    expect(cards[2].position).toBe(3000);
  });

  it("maintains relative order during rebalancing", () => {
    const { column } = setupBoardAndColumn();
    const cardA = createCard(column.id, "Card A");
    const cardB = createCard(column.id, "Card B");
    const cardC = createCard(column.id, "Card C");

    // Set positions with small gaps
    updateCardPosition(cardA.id, 100);
    updateCardPosition(cardB.id, 105);
    updateCardPosition(cardC.id, 107);

    rebalanceCardPositions(column.id);

    const cards = listCardsByColumn(column.id);
    expect(cards[0].id).toBe(cardA.id); // A is still first
    expect(cards[1].id).toBe(cardB.id); // B is still second
    expect(cards[2].id).toBe(cardC.id); // C is still third
  });

  it("returns false for single card (no rebalancing needed)", () => {
    const { column } = setupBoardAndColumn();
    createCard(column.id, "Only Card");

    const result = rebalanceCardPositions(column.id);
    expect(result).toBe(false);
  });

  it("returns false for empty column", () => {
    const { column } = setupBoardAndColumn();

    const result = rebalanceCardPositions(column.id);
    expect(result).toBe(false);
  });

  it("rebalances correctly with positions below 10", () => {
    const { column } = setupBoardAndColumn();
    const card1 = createCard(column.id, "Card 1");
    const card2 = createCard(column.id, "Card 2");

    // Extreme convergence: positions 0 and 1
    updateCardPosition(card1.id, 0);
    updateCardPosition(card2.id, 1);

    const result = rebalanceCardPositions(column.id);
    expect(result).toBe(true);

    const cards = listCardsByColumn(column.id);
    expect(cards[0].position).toBe(1000);
    expect(cards[1].position).toBe(2000);
  });

  it("handles many cards (15 items)", () => {
    const { column } = setupBoardAndColumn();
    const cardIds: number[] = [];

    // Create 15 cards with converged positions
    for (let i = 0; i < 15; i++) {
      const card = createCard(column.id, `Card ${i + 1}`);
      updateCardPosition(card.id, 1000 + i); // positions 1000, 1001, 1002, ...
      cardIds.push(card.id);
    }

    const result = rebalanceCardPositions(column.id);
    expect(result).toBe(true);

    const cards = listCardsByColumn(column.id);
    expect(cards.length).toBe(15);
    expect(cards[0].position).toBe(1000);
    expect(cards[14].position).toBe(15000);

    // Verify order is preserved
    for (let i = 0; i < 15; i++) {
      expect(cards[i].id).toBe(cardIds[i]);
    }
  });
});

describe("searchCards", () => {
  it("returns all cards for board when query is empty", () => {
    const { board, column } = setupBoardAndColumn();
    const col2 = createColumn(board.id, "Done");
    createCard(column.id, "Card 1");
    createCard(col2.id, "Card 2");

    const results = searchCards(board.id, "");
    expect(results).toHaveLength(2);
  });

  it("returns all cards for board when query is whitespace", () => {
    const { board, column } = setupBoardAndColumn();
    createCard(column.id, "Card 1");

    const results = searchCards(board.id, "   ");
    expect(results).toHaveLength(1);
  });

  it("searches title case-insensitively", () => {
    const { board, column } = setupBoardAndColumn();
    createCard(column.id, "TODO: Write Tests");
    createCard(column.id, "DONE: Bug Fix");

    const results = searchCards(board.id, "todo");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("TODO: Write Tests");
  });

  it("searches description case-insensitively", () => {
    const { board, column } = setupBoardAndColumn();
    createCard(column.id, "Card 1", "Fix authentication BUG");
    createCard(column.id, "Card 2", "Add feature");

    const results = searchCards(board.id, "bug");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Card 1");
  });

  it("searches color case-insensitively", () => {
    const { board, column } = setupBoardAndColumn();
    createCard(column.id, "Card 1", null, "red");
    createCard(column.id, "Card 2", null, "blue");

    const results = searchCards(board.id, "RED");
    expect(results).toHaveLength(1);
    expect(results[0].color).toBe("red");
  });

  it("trims whitespace from query", () => {
    const { board, column } = setupBoardAndColumn();
    createCard(column.id, "Test Card");

    const results = searchCards(board.id, "  test  ");
    expect(results).toHaveLength(1);
  });

  it("returns cards ordered by column position then card position", () => {
    const { board, column } = setupBoardAndColumn();
    const col2 = createColumn(board.id, "Done");
    createCard(col2.id, "Test B");
    createCard(column.id, "Test A");
    const c3 = createCard(column.id, "Test C");
    // Manually set position to be lower
    getDb().prepare("UPDATE cards SET position = 500 WHERE id = ?").run(c3.id);

    const results = searchCards(board.id, "test");
    expect(results).toHaveLength(3);
    expect(results[0].title).toBe("Test C"); // Column 1, card pos 500
    expect(results[1].title).toBe("Test A"); // Column 1, card pos 2000
    expect(results[2].title).toBe("Test B"); // Column 2, card pos 1000
  });

  it("handles special characters in query", () => {
    const { board, column } = setupBoardAndColumn();
    createCard(column.id, "Test [brackets]");
    createCard(column.id, "Test normal");

    const results = searchCards(board.id, "[brackets]");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Test [brackets]");
  });

  it("returns empty array when no matches", () => {
    const { board, column } = setupBoardAndColumn();
    createCard(column.id, "Card 1");

    const results = searchCards(board.id, "nonexistent");
    expect(results).toHaveLength(0);
  });

  it("only returns cards from specified board", () => {
    const board1 = createBoard("Board 1");
    const board2 = createBoard("Board 2");
    const col1 = createColumn(board1.id, "Col 1");
    const col2 = createColumn(board2.id, "Col 2");
    createCard(col1.id, "Test A");
    createCard(col2.id, "Test B");

    const results = searchCards(board1.id, "test");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Test A");
  });

  it("matches partial substrings", () => {
    const { board, column } = setupBoardAndColumn();
    createCard(column.id, "Authentication feature");

    const results = searchCards(board.id, "auth");
    expect(results).toHaveLength(1);
  });
});

describe("archiveCard", () => {
  it("archives card by setting archived_at timestamp", () => {
    const { column } = setupBoardAndColumn();
    const card = createCard(column.id, "Archive Me");
    const archived = archiveCard(card.id);
    expect(archived).toBeDefined();
    expect(archived!.archived_at).toBeTypeOf("string");
    expect(archived!.archived_at).not.toBeNull();
  });

  it("returns undefined for non-existent card", () => {
    expect(archiveCard(99999)).toBeUndefined();
  });

  it("returns undefined if card already archived", () => {
    const { column } = setupBoardAndColumn();
    const card = createCard(column.id, "Archive Me");
    archiveCard(card.id);
    const result = archiveCard(card.id);
    expect(result).toBeUndefined();
  });
});

describe("listArchivedCards", () => {
  it("returns only archived cards for board", () => {
    const { board, column } = setupBoardAndColumn();
    const card1 = createCard(column.id, "Active Card");
    const card2 = createCard(column.id, "Archived Card");
    archiveCard(card2.id);

    const archived = listArchivedCards(board.id);
    expect(archived).toHaveLength(1);
    expect(archived[0].title).toBe("Archived Card");
  });

  it("includes column name via join", () => {
    const { board, column } = setupBoardAndColumn();
    const card = createCard(column.id, "Archived Card");
    archiveCard(card.id);

    const archived = listArchivedCards(board.id);
    expect(archived).toHaveLength(1);
    expect(archived[0].column_name).toBe("To Do");
  });

  it("orders by archived_at DESC (most recent first)", () => {
    const { board, column } = setupBoardAndColumn();
    const card1 = createCard(column.id, "First Archived");
    const card2 = createCard(column.id, "Second Archived");
    // Archive both, then set distinct timestamps to guarantee ordering
    archiveCard(card1.id);
    archiveCard(card2.id);
    const db = getDb();
    db.prepare("UPDATE cards SET archived_at = '2024-01-01 00:00:00' WHERE id = ?").run(card1.id);
    db.prepare("UPDATE cards SET archived_at = '2024-01-02 00:00:00' WHERE id = ?").run(card2.id);

    const archived = listArchivedCards(board.id);
    expect(archived).toHaveLength(2);
    // Most recently archived should be first
    expect(archived[0].title).toBe("Second Archived");
    expect(archived[1].title).toBe("First Archived");
  });

  it("excludes active cards", () => {
    const { board, column } = setupBoardAndColumn();
    createCard(column.id, "Active Card 1");
    createCard(column.id, "Active Card 2");

    const archived = listArchivedCards(board.id);
    expect(archived).toHaveLength(0);
  });
});

describe("restoreCard", () => {
  it("clears archived_at timestamp", () => {
    const { column } = setupBoardAndColumn();
    const card = createCard(column.id, "Restore Me");
    archiveCard(card.id);
    const restored = restoreCard(card.id);
    expect(restored).toBeDefined();
    expect(restored!.archived_at).toBeNull();
  });

  it("preserves original column_id if column still exists", () => {
    const { column } = setupBoardAndColumn();
    const card = createCard(column.id, "Restore Me");
    archiveCard(card.id);
    const restored = restoreCard(card.id);
    expect(restored).toBeDefined();
    expect(restored!.column_id).toBe(column.id);
  });

  it("moves to first column if original was deleted", () => {
    const { board, column } = setupBoardAndColumn();
    const col2 = createColumn(board.id, "Second Column");
    const card = createCard(column.id, "Restore Me");
    archiveCard(card.id);
    // Disable FK to prevent cascade delete of the archived card
    const db = getDb();
    db.pragma("foreign_keys = OFF");
    deleteColumn(column.id);
    db.pragma("foreign_keys = ON");
    const restored = restoreCard(card.id);
    expect(restored).toBeDefined();
    expect(restored!.column_id).toBe(col2.id);
  });

  it("throws for non-existent card", () => {
    expect(() => restoreCard(99999)).toThrow("Card not found");
  });

  it("throws if card is not archived", () => {
    const { column } = setupBoardAndColumn();
    const card = createCard(column.id, "Active Card");
    expect(() => restoreCard(card.id)).toThrow("Card is not archived");
  });

  it("throws when board has no columns after original deleted", () => {
    const { column } = setupBoardAndColumn();
    const card = createCard(column.id, "Orphaned Card");
    archiveCard(card.id);

    const db = getDb();
    db.pragma("foreign_keys = OFF");
    deleteColumn(column.id);
    db.pragma("foreign_keys = ON");

    expect(() => restoreCard(card.id)).toThrow("board has no columns");
  });
});

describe("deleteCardPermanently", () => {
  it("permanently deletes card from database", () => {
    const { column } = setupBoardAndColumn();
    const card = createCard(column.id, "Delete Me");
    archiveCard(card.id);
    const result = deleteCardPermanently(card.id);
    expect(result).toBe(true);
    expect(getCardById(card.id)).toBeUndefined();
  });

  it("returns false for non-existent card", () => {
    expect(deleteCardPermanently(99999)).toBe(false);
  });
});

describe("listCardsByColumn with archived cards", () => {
  it("excludes archived cards from results", () => {
    const { column } = setupBoardAndColumn();
    const card1 = createCard(column.id, "Active");
    const card2 = createCard(column.id, "To Archive");
    archiveCard(card2.id);

    const cards = listCardsByColumn(column.id);
    expect(cards).toHaveLength(1);
    expect(cards[0].title).toBe("Active");
  });
});

describe("searchCards with archived cards", () => {
  it("excludes archived cards from search results", () => {
    const { board, column } = setupBoardAndColumn();
    createCard(column.id, "Active Test");
    const card2 = createCard(column.id, "Archived Test");
    archiveCard(card2.id);

    const results = searchCards(board.id, "test");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Active Test");
  });
});
