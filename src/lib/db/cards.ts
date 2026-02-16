import { getDb } from "./connection";
import { calculateInitialPosition, type PositionedItem } from "../utils/positioning";

export interface Card {
  id: number;
  column_id: number;
  title: string;
  description: string | null;
  color: string | null;
  position: number;
  created_at: string;
  updated_at: string;
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

  const column = db.prepare("SELECT id FROM columns WHERE id = ?").get(columnId);
  if (!column) throw new Error("Column not found");

  const existingCards = db
    .prepare("SELECT id, position FROM cards WHERE column_id = ? ORDER BY position ASC")
    .all(columnId) as PositionedItem[];
  const position = calculateInitialPosition(existingCards);

  const info = db
    .prepare(
      "INSERT INTO cards (column_id, title, description, color, position) VALUES (?, ?, ?, ?, ?)"
    )
    .run(columnId, trimmed, description || null, color || null, position);

  const card = db
    .prepare("SELECT * FROM cards WHERE id = ?")
    .get(info.lastInsertRowid) as Card;
  if (!card) throw new Error("Failed to create card");
  return card;
}

export function listCardsByColumn(columnId: number): Card[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM cards WHERE column_id = ? ORDER BY position ASC")
    .all(columnId) as Card[];
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
