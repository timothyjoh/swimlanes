import Database from 'better-sqlite3';
import type { Column } from '../types/entities';

export class ColumnRepository {
  constructor(private db: Database.Database) {}

  findAll(): Column[] {
    const stmt = this.db.prepare('SELECT * FROM columns ORDER BY board_id, position');
    return stmt.all() as Column[];
  }

  findById(id: number): Column | undefined {
    const stmt = this.db.prepare('SELECT * FROM columns WHERE id = ?');
    return stmt.get(id) as Column | undefined;
  }

  findByBoardId(boardId: number): Column[] {
    const stmt = this.db.prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY position');
    return stmt.all(boardId) as Column[];
  }

  create(boardId: number, name: string, position: number): Column {
    const stmt = this.db.prepare(
      'INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)'
    );
    const result = stmt.run(boardId, name, position);
    return this.findById(result.lastInsertRowid as number)!;
  }

  update(id: number, name: string): Column | undefined {
    const stmt = this.db.prepare(
      'UPDATE columns SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    );
    const result = stmt.run(name, id);

    if (result.changes === 0) {
      return undefined;
    }

    return this.findById(id);
  }

  updatePosition(id: number, newPosition: number): boolean {
    const column = this.findById(id);
    if (!column) {
      return false;
    }

    const updatePositions = this.db.transaction(() => {
      const oldPosition = column.position;
      const boardId = column.board_id;

      if (oldPosition === newPosition) {
        return true;
      }

      if (oldPosition < newPosition) {
        // Moving down: shift columns between old and new position up
        this.db
          .prepare(
            'UPDATE columns SET position = position - 1 WHERE board_id = ? AND position > ? AND position <= ?'
          )
          .run(boardId, oldPosition, newPosition);
      } else {
        // Moving up: shift columns between new and old position down
        this.db
          .prepare(
            'UPDATE columns SET position = position + 1 WHERE board_id = ? AND position >= ? AND position < ?'
          )
          .run(boardId, newPosition, oldPosition);
      }

      // Update the column to new position
      this.db
        .prepare('UPDATE columns SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(newPosition, id);

      return true;
    });

    return updatePositions();
  }

  delete(id: number): boolean {
    const column = this.findById(id);
    if (!column) {
      return false;
    }

    const deleteWithReorder = this.db.transaction(() => {
      const boardId = column.board_id;
      const position = column.position;

      // Delete the column
      this.db.prepare('DELETE FROM columns WHERE id = ?').run(id);

      // Shift remaining columns up to fill the gap
      this.db
        .prepare('UPDATE columns SET position = position - 1 WHERE board_id = ? AND position > ?')
        .run(boardId, position);

      return true;
    });

    return deleteWithReorder();
  }
}
