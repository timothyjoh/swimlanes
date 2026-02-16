import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlinkSync } from "node:fs";
import { getDb, closeDb } from "../connection";
import {
  createBoard,
  listBoards,
  getBoardById,
  renameBoard,
  deleteBoard,
} from "../boards";

let tempDbPath: string;

beforeEach(() => {
  closeDb();
  tempDbPath = join(
    tmpdir(),
    `test-boards-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
  );
  getDb(tempDbPath);
});

afterEach(() => {
  closeDb();
  try { unlinkSync(tempDbPath); } catch {}
  try { unlinkSync(tempDbPath + "-wal"); } catch {}
  try { unlinkSync(tempDbPath + "-shm"); } catch {}
});

describe("createBoard", () => {
  it("creates and returns board with id, name, timestamps", () => {
    const board = createBoard("My Board");
    expect(board.id).toBeTypeOf("number");
    expect(board.name).toBe("My Board");
    expect(board.created_at).toBeTypeOf("string");
    expect(board.updated_at).toBeTypeOf("string");
  });

  it("trims whitespace from name", () => {
    const board = createBoard("  Trimmed Board  ");
    expect(board.name).toBe("Trimmed Board");
  });

  it("throws on empty name", () => {
    expect(() => createBoard("")).toThrow("Board name cannot be empty");
  });

  it("throws on whitespace-only name", () => {
    expect(() => createBoard("   ")).toThrow("Board name cannot be empty");
  });
});

describe("listBoards", () => {
  it("returns empty array when no boards", () => {
    expect(listBoards()).toEqual([]);
  });

  it("returns boards in reverse-chronological order", () => {
    createBoard("First");
    createBoard("Second");
    createBoard("Third");
    const boards = listBoards();
    expect(boards).toHaveLength(3);
    expect(boards[0].name).toBe("Third");
    expect(boards[1].name).toBe("Second");
    expect(boards[2].name).toBe("First");
  });
});

describe("getBoardById", () => {
  it("returns board when exists", () => {
    const created = createBoard("Find Me");
    const found = getBoardById(created.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe("Find Me");
    expect(found!.id).toBe(created.id);
  });

  it("returns undefined for nonexistent id", () => {
    expect(getBoardById(99999)).toBeUndefined();
  });
});

describe("renameBoard", () => {
  it("updates name and updated_at", () => {
    const board = createBoard("Original");
    const renamed = renameBoard(board.id, "Renamed");
    expect(renamed).toBeDefined();
    expect(renamed!.name).toBe("Renamed");
    expect(renamed!.id).toBe(board.id);
  });

  it("returns undefined for nonexistent id", () => {
    expect(renameBoard(99999, "Nope")).toBeUndefined();
  });

  it("throws on empty name", () => {
    const board = createBoard("Test");
    expect(() => renameBoard(board.id, "")).toThrow(
      "Board name cannot be empty"
    );
  });
});

describe("deleteBoard", () => {
  it("returns true when board deleted", () => {
    const board = createBoard("Delete Me");
    expect(deleteBoard(board.id)).toBe(true);
    expect(getBoardById(board.id)).toBeUndefined();
  });

  it("returns false for nonexistent id", () => {
    expect(deleteBoard(99999)).toBe(false);
  });
});
