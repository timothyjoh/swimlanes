import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlinkSync } from "node:fs";
import { getDb, closeDb } from "../connection";
import { createBoard, deleteBoard } from "../boards";
import {
  createColumn,
  listColumnsByBoard,
  getColumnById,
  renameColumn,
  deleteColumn,
  updateColumnPosition,
  rebalanceColumnPositions,
} from "../columns";

let tempDbPath: string;

beforeEach(() => {
  closeDb();
  tempDbPath = join(
    tmpdir(),
    `test-columns-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
  );
  getDb(tempDbPath);
});

afterEach(() => {
  closeDb();
  try { unlinkSync(tempDbPath); } catch {}
  try { unlinkSync(tempDbPath + "-wal"); } catch {}
  try { unlinkSync(tempDbPath + "-shm"); } catch {}
});

describe("createColumn", () => {
  it("creates and returns column with id, name, position, timestamps", () => {
    const board = createBoard("Test Board");
    const column = createColumn(board.id, "To Do");
    expect(column.id).toBeTypeOf("number");
    expect(column.board_id).toBe(board.id);
    expect(column.name).toBe("To Do");
    expect(column.position).toBe(1000);
    expect(column.created_at).toBeTypeOf("string");
    expect(column.updated_at).toBeTypeOf("string");
  });

  it("calculates position 1000 for first column", () => {
    const board = createBoard("Test Board");
    const column = createColumn(board.id, "First");
    expect(column.position).toBe(1000);
  });

  it("calculates position 2000 for second column", () => {
    const board = createBoard("Test Board");
    createColumn(board.id, "First");
    const second = createColumn(board.id, "Second");
    expect(second.position).toBe(2000);
  });

  it("calculates position 3000 for third column", () => {
    const board = createBoard("Test Board");
    createColumn(board.id, "First");
    createColumn(board.id, "Second");
    const third = createColumn(board.id, "Third");
    expect(third.position).toBe(3000);
  });

  it("trims whitespace from name", () => {
    const board = createBoard("Test Board");
    const column = createColumn(board.id, "  Trimmed  ");
    expect(column.name).toBe("Trimmed");
  });

  it("throws on empty name", () => {
    const board = createBoard("Test Board");
    expect(() => createColumn(board.id, "")).toThrow(
      "Column name cannot be empty"
    );
  });

  it("throws on whitespace-only name", () => {
    const board = createBoard("Test Board");
    expect(() => createColumn(board.id, "   ")).toThrow(
      "Column name cannot be empty"
    );
  });

  it("throws on non-existent board_id", () => {
    expect(() => createColumn(99999, "Test")).toThrow("Board 99999 not found");
  });
});

describe("listColumnsByBoard", () => {
  it("returns empty array for board with no columns", () => {
    const board = createBoard("Empty Board");
    expect(listColumnsByBoard(board.id)).toEqual([]);
  });

  it("returns columns ordered by position ASC", () => {
    const board = createBoard("Test Board");
    createColumn(board.id, "First");
    createColumn(board.id, "Second");
    createColumn(board.id, "Third");

    const columns = listColumnsByBoard(board.id);
    expect(columns).toHaveLength(3);
    expect(columns[0].name).toBe("First");
    expect(columns[1].name).toBe("Second");
    expect(columns[2].name).toBe("Third");
    expect(columns[0].position).toBeLessThan(columns[1].position);
    expect(columns[1].position).toBeLessThan(columns[2].position);
  });

  it("only returns columns for specified board", () => {
    const board1 = createBoard("Board 1");
    const board2 = createBoard("Board 2");
    createColumn(board1.id, "Col A");
    createColumn(board2.id, "Col B");

    const cols1 = listColumnsByBoard(board1.id);
    expect(cols1).toHaveLength(1);
    expect(cols1[0].name).toBe("Col A");
  });
});

describe("getColumnById", () => {
  it("returns column when found", () => {
    const board = createBoard("Test Board");
    const created = createColumn(board.id, "Find Me");
    const found = getColumnById(created.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe("Find Me");
    expect(found!.id).toBe(created.id);
  });

  it("returns undefined when not found", () => {
    expect(getColumnById(99999)).toBeUndefined();
  });
});

describe("renameColumn", () => {
  it("updates name and returns updated column", () => {
    const board = createBoard("Test Board");
    const column = createColumn(board.id, "Original");
    const renamed = renameColumn(column.id, "Renamed");
    expect(renamed).toBeDefined();
    expect(renamed!.name).toBe("Renamed");
    expect(renamed!.id).toBe(column.id);
  });

  it("throws on empty name", () => {
    const board = createBoard("Test Board");
    const column = createColumn(board.id, "Test");
    expect(() => renameColumn(column.id, "")).toThrow(
      "Column name cannot be empty"
    );
  });

  it("returns undefined for non-existent id", () => {
    expect(renameColumn(99999, "Nope")).toBeUndefined();
  });
});

describe("deleteColumn", () => {
  it("returns true when column deleted", () => {
    const board = createBoard("Test Board");
    const column = createColumn(board.id, "Delete Me");
    expect(deleteColumn(column.id)).toBe(true);
    expect(getColumnById(column.id)).toBeUndefined();
  });

  it("returns false for non-existent id", () => {
    expect(deleteColumn(99999)).toBe(false);
  });
});

describe("updateColumnPosition", () => {
  it("updates position and returns updated column", () => {
    const board = createBoard("Test Board");
    const column = createColumn(board.id, "Movable");
    const updated = updateColumnPosition(column.id, 500);
    expect(updated).toBeDefined();
    expect(updated!.position).toBe(500);
    expect(updated!.id).toBe(column.id);
  });

  it("returns undefined for non-existent id", () => {
    expect(updateColumnPosition(99999, 500)).toBeUndefined();
  });
});

describe("CASCADE DELETE", () => {
  it("deletes columns when board is deleted", () => {
    const board = createBoard("Cascade Board");
    createColumn(board.id, "Col 1");
    createColumn(board.id, "Col 2");
    createColumn(board.id, "Col 3");

    expect(listColumnsByBoard(board.id)).toHaveLength(3);

    deleteBoard(board.id);

    expect(listColumnsByBoard(board.id)).toHaveLength(0);
  });
});

describe("rebalanceColumnPositions", () => {
  it("returns false when positions are healthy (gap >= 10)", () => {
    const board = createBoard("Test Board");
    createColumn(board.id, "Col 1"); // position 1000
    createColumn(board.id, "Col 2"); // position 2000
    createColumn(board.id, "Col 3"); // position 3000

    const result = rebalanceColumnPositions(board.id);
    expect(result).toBe(false);
  });

  it("returns true and rebalances when gap < 10", () => {
    const board = createBoard("Test Board");
    const col1 = createColumn(board.id, "Col 1");
    const col2 = createColumn(board.id, "Col 2");
    const col3 = createColumn(board.id, "Col 3");

    updateColumnPosition(col1.id, 1000);
    updateColumnPosition(col2.id, 1005);
    updateColumnPosition(col3.id, 1008);

    const result = rebalanceColumnPositions(board.id);
    expect(result).toBe(true);

    const columns = listColumnsByBoard(board.id);
    expect(columns[0].position).toBe(1000);
    expect(columns[1].position).toBe(2000);
    expect(columns[2].position).toBe(3000);
  });

  it("maintains relative order during rebalancing", () => {
    const board = createBoard("Test Board");
    const colA = createColumn(board.id, "Col A");
    const colB = createColumn(board.id, "Col B");
    const colC = createColumn(board.id, "Col C");

    updateColumnPosition(colA.id, 100);
    updateColumnPosition(colB.id, 105);
    updateColumnPosition(colC.id, 107);

    rebalanceColumnPositions(board.id);

    const columns = listColumnsByBoard(board.id);
    expect(columns[0].id).toBe(colA.id);
    expect(columns[1].id).toBe(colB.id);
    expect(columns[2].id).toBe(colC.id);
  });

  it("returns false for single column (no rebalancing needed)", () => {
    const board = createBoard("Test Board");
    createColumn(board.id, "Only Column");

    const result = rebalanceColumnPositions(board.id);
    expect(result).toBe(false);
  });

  it("returns false for empty board", () => {
    const board = createBoard("Empty Board");

    const result = rebalanceColumnPositions(board.id);
    expect(result).toBe(false);
  });

  it("rebalances correctly with positions below 10", () => {
    const board = createBoard("Test Board");
    const col1 = createColumn(board.id, "Col 1");
    const col2 = createColumn(board.id, "Col 2");

    updateColumnPosition(col1.id, 0);
    updateColumnPosition(col2.id, 1);

    const result = rebalanceColumnPositions(board.id);
    expect(result).toBe(true);

    const columns = listColumnsByBoard(board.id);
    expect(columns[0].position).toBe(1000);
    expect(columns[1].position).toBe(2000);
  });

  it("handles many columns (10 items)", () => {
    const board = createBoard("Test Board");
    const colIds: number[] = [];

    for (let i = 0; i < 10; i++) {
      const col = createColumn(board.id, `Col ${i + 1}`);
      updateColumnPosition(col.id, 1000 + i);
      colIds.push(col.id);
    }

    const result = rebalanceColumnPositions(board.id);
    expect(result).toBe(true);

    const columns = listColumnsByBoard(board.id);
    expect(columns.length).toBe(10);
    expect(columns[0].position).toBe(1000);
    expect(columns[9].position).toBe(10000);

    for (let i = 0; i < 10; i++) {
      expect(columns[i].id).toBe(colIds[i]);
    }
  });
});
