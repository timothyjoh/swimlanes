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
