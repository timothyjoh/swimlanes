import { getDb } from "./connection";
import { calculateInitialPosition, type PositionedItem } from "../utils/positioning";

export interface Card {
  id: number;
  board_id: number;
  column_id: number;
  title: string;
  description: string | null;
  color: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export function createCard(
  columnId: number,
  title: string,
  description?: string | null,
  color?: string | null
): Card {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Card title cannot be empty");

  const db = getDb();

  const column = db.prepare("SELECT id, board_id FROM columns WHERE id = ?")
    .get(columnId) as { id: number; board_id: number } | undefined;
  if (!column) throw new Error("Column not found");

  const existingCards = db
    .prepare("SELECT id, position FROM cards WHERE column_id = ? ORDER BY position ASC")
    .all(columnId) as PositionedItem[];
  const position = calculateInitialPosition(existingCards);

  const info = db
    .prepare(
      "INSERT INTO cards (board_id, column_id, title, description, color, position) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(column.board_id, columnId, trimmed, description || null, color || null, position);

  const card = db
    .prepare("SELECT * FROM cards WHERE id = ?")
    .get(info.lastInsertRowid) as Card;
  if (!card) throw new Error("Failed to create card");
  return card;
}

export function listCardsByColumn(columnId: number): Card[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM cards WHERE column_id = ? AND archived_at IS NULL ORDER BY position ASC")
    .all(columnId) as Card[];
}

export function searchCards(boardId: number, query: string): Card[] {
  const db = getDb();
  const trimmed = query.trim();
  if (!trimmed) {
    const stmt = db.prepare(`
      SELECT c.* FROM cards c
      JOIN columns col ON c.column_id = col.id
      WHERE col.board_id = ? AND c.archived_at IS NULL
      ORDER BY col.position ASC, c.position ASC
    `);
    return stmt.all(boardId) as Card[];
  }

  const searchPattern = `%${trimmed.toLowerCase()}%`;
  const stmt = db.prepare(`
    SELECT c.* FROM cards c
    JOIN columns col ON c.column_id = col.id
    WHERE col.board_id = ?
      AND c.archived_at IS NULL
      AND (
        LOWER(c.title) LIKE ?
        OR LOWER(c.description) LIKE ?
        OR LOWER(c.color) LIKE ?
      )
    ORDER BY col.position ASC, c.position ASC
  `);

  return stmt.all(boardId, searchPattern, searchPattern, searchPattern) as Card[];
}

export function getCardById(id: number): Card | undefined {
  return getDb()
    .prepare("SELECT * FROM cards WHERE id = ?")
    .get(id) as Card | undefined;
}

export function updateCard(
  id: number,
  updates: { title?: string; description?: string | null; color?: string | null }
): Card | undefined {
  const db = getDb();

  if (updates.title !== undefined) {
    const trimmed = updates.title.trim();
    if (!trimmed) throw new Error("Card title cannot be empty");
    updates = { ...updates, title: trimmed };
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.title !== undefined) {
    fields.push("title = ?");
    values.push(updates.title);
  }
  if (updates.description !== undefined) {
    fields.push("description = ?");
    values.push(updates.description);
  }
  if (updates.color !== undefined) {
    fields.push("color = ?");
    values.push(updates.color);
  }

  if (fields.length === 0) return getCardById(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  const result = db
    .prepare(`UPDATE cards SET ${fields.join(", ")} WHERE id = ?`)
    .run(...values);

  if (result.changes === 0) return undefined;
  return getCardById(id);
}

export function deleteCard(id: number): boolean {
  const result = getDb().prepare("DELETE FROM cards WHERE id = ?").run(id);
  return result.changes > 0;
}

export function updateCardPosition(
  id: number,
  position: number
): Card | undefined {
  const db = getDb();
  const result = db
    .prepare(
      "UPDATE cards SET position = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .run(position, id);
  if (result.changes === 0) return undefined;
  return getCardById(id);
}

export function updateCardColumn(
  id: number,
  columnId: number,
  position: number
): Card | undefined {
  const db = getDb();

  const column = db.prepare("SELECT id FROM columns WHERE id = ?").get(columnId);
  if (!column) throw new Error("Column not found");

  const result = db
    .prepare(
      "UPDATE cards SET column_id = ?, position = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .run(columnId, position, id);
  if (result.changes === 0) return undefined;
  return getCardById(id);
}

export function archiveCard(id: number): Card | undefined {
  const db = getDb();
  const info = db
    .prepare("UPDATE cards SET archived_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND archived_at IS NULL")
    .run(id);
  if (info.changes === 0) return undefined;
  return db.prepare("SELECT * FROM cards WHERE id = ?").get(id) as Card | undefined;
}

export function listArchivedCards(boardId: number): Array<Card & { column_name: string }> {
  const db = getDb();
  return db
    .prepare(`
      SELECT c.*, COALESCE(col.name, '(deleted)') as column_name
      FROM cards c
      LEFT JOIN columns col ON c.column_id = col.id
      WHERE c.board_id = ? AND c.archived_at IS NOT NULL
      ORDER BY c.archived_at DESC
    `)
    .all(boardId) as Array<Card & { column_name: string }>;
}

export function restoreCard(id: number): Card {
  const db = getDb();

  const card = db.prepare("SELECT * FROM cards WHERE id = ? AND archived_at IS NOT NULL").get(id) as Card | undefined;

  if (!card) {
    const existingCard = getCardById(id);
    if (!existingCard) {
      throw new Error("Card not found");
    }
    throw new Error("Card is not archived");
  }

  const columnExists = db.prepare("SELECT id FROM columns WHERE id = ?").get(card.column_id);

  let targetColumnId = card.column_id;

  if (!columnExists) {
    const firstColumn = db.prepare(
      "SELECT id FROM columns WHERE board_id = ? ORDER BY position ASC LIMIT 1"
    ).get(card.board_id) as { id: number } | undefined;

    if (!firstColumn) {
      throw new Error("Cannot restore card: board has no columns");
    }
    targetColumnId = firstColumn.id;
  }

  db.prepare("UPDATE cards SET archived_at = NULL, column_id = ?, updated_at = datetime('now') WHERE id = ?")
    .run(targetColumnId, id);

  return db.prepare("SELECT * FROM cards WHERE id = ?").get(id) as Card;
}

export function deleteCardPermanently(id: number): boolean {
  const db = getDb();
  const info = db.prepare("DELETE FROM cards WHERE id = ?").run(id);
  return info.changes > 0;
}

export function rebalanceCardPositions(columnId: number): boolean {
  const db = getDb();
  const cards = listCardsByColumn(columnId);

  if (cards.length <= 1) return false;

  let needsRebalancing = false;
  for (let i = 1; i < cards.length; i++) {
    const gap = cards[i].position - cards[i - 1].position;
    if (gap < 10) {
      needsRebalancing = true;
      break;
    }
  }

  if (!needsRebalancing) return false;

  const rebalance = db.transaction(() => {
    for (let i = 0; i < cards.length; i++) {
      const newPosition = (i + 1) * 1000;
      db.prepare(
        "UPDATE cards SET position = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(newPosition, cards[i].id);
    }
  });

  rebalance();
  return true;
}
