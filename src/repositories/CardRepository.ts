import Database from 'better-sqlite3';
import type { Card } from '../types/entities';

type CardUpdate = Partial<Pick<Card, 'title' | 'description' | 'color'>>;

export class CardRepository {
  constructor(private db: Database.Database) {}

  findAll(): Card[] {
    const stmt = this.db.prepare('SELECT * FROM cards ORDER BY column_id, position');
    return stmt.all() as Card[];
  }

  findById(id: number): Card | undefined {
    const stmt = this.db.prepare('SELECT * FROM cards WHERE id = ?');
    return stmt.get(id) as Card | undefined;
  }

  findByColumnId(columnId: number): Card[] {
    const stmt = this.db.prepare('SELECT * FROM cards WHERE column_id = ? ORDER BY position');
    return stmt.all(columnId) as Card[];
  }

  create(
    columnId: number,
    title: string,
    description?: string,
    color?: string,
    position?: number
  ): Card {
    // If no position specified, add to end
    let actualPosition = position;
    if (actualPosition === undefined) {
      const maxPosStmt = this.db.prepare(
        'SELECT MAX(position) as max_pos FROM cards WHERE column_id = ?'
      );
      const result = maxPosStmt.get(columnId) as { max_pos: number | null };
      actualPosition = result.max_pos !== null ? result.max_pos + 1 : 0;
    }

    const stmt = this.db.prepare(
      'INSERT INTO cards (column_id, title, description, color, position) VALUES (?, ?, ?, ?, ?)'
    );
    const insertResult = stmt.run(
      columnId,
      title,
      description || null,
      color || null,
      actualPosition
    );
    return this.findById(insertResult.lastInsertRowid as number)!;
  }

  update(id: number, updates: CardUpdate): Card | undefined {
    const card = this.findById(id);
    if (!card) {
      return undefined;
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.color !== undefined) {
      fields.push('color = ?');
      values.push(updates.color);
    }

    if (fields.length === 0) {
      return card;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const sql = `UPDATE cards SET ${fields.join(', ')} WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    stmt.run(...values);

    return this.findById(id);
  }

  move(id: number, targetColumnId: number, targetPosition: number): boolean {
    const card = this.findById(id);
    if (!card) {
      return false;
    }

    const moveCard = this.db.transaction(() => {
      const sourceColumnId = card.column_id;
      const sourcePosition = card.position;

      if (sourceColumnId === targetColumnId) {
        // Moving within same column
        if (sourcePosition === targetPosition) {
          return true;
        }

        if (sourcePosition < targetPosition) {
          // Moving down: shift cards between old and new position up
          this.db
            .prepare(
              'UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ? AND position <= ?'
            )
            .run(sourceColumnId, sourcePosition, targetPosition);
        } else {
          // Moving up: shift cards between new and old position down
          this.db
            .prepare(
              'UPDATE cards SET position = position + 1 WHERE column_id = ? AND position >= ? AND position < ?'
            )
            .run(sourceColumnId, targetPosition, sourcePosition);
        }
      } else {
        // Moving to different column
        // Shift cards in source column up to fill gap
        this.db
          .prepare('UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ?')
          .run(sourceColumnId, sourcePosition);

        // Shift cards in target column down to make space
        this.db
          .prepare('UPDATE cards SET position = position + 1 WHERE column_id = ? AND position >= ?')
          .run(targetColumnId, targetPosition);
      }

      // Move the card
      this.db
        .prepare(
          'UPDATE cards SET column_id = ?, position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        )
        .run(targetColumnId, targetPosition, id);

      return true;
    });

    return moveCard();
  }

  updatePosition(id: number, newPosition: number): boolean {
    const card = this.findById(id);
    if (!card) {
      return false;
    }

    return this.move(id, card.column_id, newPosition);
  }

  delete(id: number): boolean {
    const card = this.findById(id);
    if (!card) {
      return false;
    }

    const deleteWithReorder = this.db.transaction(() => {
      const columnId = card.column_id;
      const position = card.position;

      // Delete the card
      this.db.prepare('DELETE FROM cards WHERE id = ?').run(id);

      // Shift remaining cards up to fill the gap
      this.db
        .prepare('UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ?')
        .run(columnId, position);

      return true;
    });

    return deleteWithReorder();
  }
}
