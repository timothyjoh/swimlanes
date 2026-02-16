import { getDb } from "./connection";

export interface Column {
  id: number;
  board_id: number;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export function createColumn(boardId: number, name: string): Column {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Column name cannot be empty");

  const db = getDb();

  const board = db.prepare("SELECT id FROM boards WHERE id = ?").get(boardId);
  if (!board) throw new Error(`Board ${boardId} not found`);

  const maxPos = db
    .prepare("SELECT MAX(position) as max FROM columns WHERE board_id = ?")
    .get(boardId) as { max: number | null };
  const position = (maxPos.max || 0) + 1000;

  const stmt = db.prepare(
    "INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)"
  );
  const info = stmt.run(boardId, trimmed, position);

  return db
    .prepare("SELECT * FROM columns WHERE id = ?")
    .get(info.lastInsertRowid) as Column;
}

export function listColumnsByBoard(boardId: number): Column[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM columns WHERE board_id = ? ORDER BY position ASC")
    .all(boardId) as Column[];
}

export function getColumnById(id: number): Column | undefined {
  return getDb()
    .prepare("SELECT * FROM columns WHERE id = ?")
    .get(id) as Column | undefined;
}

export function renameColumn(id: number, name: string): Column | undefined {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Column name cannot be empty");

  const db = getDb();
  const result = db
    .prepare(
      "UPDATE columns SET name = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .run(trimmed, id);

  if (result.changes === 0) return undefined;
  return getColumnById(id);
}

export function deleteColumn(id: number): boolean {
  const result = getDb().prepare("DELETE FROM columns WHERE id = ?").run(id);
  return result.changes > 0;
}

export function updateColumnPosition(
  id: number,
  position: number
): Column | undefined {
  const db = getDb();
  const result = db
    .prepare(
      "UPDATE columns SET position = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .run(position, id);

  if (result.changes === 0) return undefined;
  return getColumnById(id);
}
