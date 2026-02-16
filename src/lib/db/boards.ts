import { getDb } from "./connection";

export interface Board {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export function createBoard(name: string): Board {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Board name cannot be empty");

  const db = getDb();
  const result = db.prepare("INSERT INTO boards (name) VALUES (?)").run(trimmed);
  return getBoardById(Number(result.lastInsertRowid))!;
}

export function listBoards(): Board[] {
  return getDb()
    .prepare("SELECT * FROM boards ORDER BY created_at DESC, id DESC")
    .all() as Board[];
}

export function getBoardById(id: number): Board | undefined {
  return getDb()
    .prepare("SELECT * FROM boards WHERE id = ?")
    .get(id) as Board | undefined;
}

export function renameBoard(id: number, name: string): Board | undefined {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Board name cannot be empty");

  const db = getDb();
  const result = db
    .prepare(
      "UPDATE boards SET name = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .run(trimmed, id);

  if (result.changes === 0) return undefined;
  return getBoardById(id);
}

export function deleteBoard(id: number): boolean {
  const result = getDb().prepare("DELETE FROM boards WHERE id = ?").run(id);
  return result.changes > 0;
}
