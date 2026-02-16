import type { Database } from 'better-sqlite3';
import type { Column, NewColumn } from '@/lib/db/types';

export class ColumnRepository {
  constructor(private db: Database) {}

  create(column: NewColumn): Column {
    const stmt = this.db.prepare(`
      INSERT INTO columns (board_id, name, position)
      VALUES (?, ?, ?)
      RETURNING id, board_id, name, position, created_at
    `);
    return stmt.get(column.board_id, column.name, column.position) as Column;
  }

  findByBoardId(boardId: number): Column[] {
    const stmt = this.db.prepare(`
      SELECT id, board_id, name, position, created_at
      FROM columns
      WHERE board_id = ?
      ORDER BY position ASC
    `);
    return stmt.all(boardId) as Column[];
  }

  findById(id: number): Column | null {
    const stmt = this.db.prepare(`
      SELECT id, board_id, name, position, created_at
      FROM columns
      WHERE id = ?
    `);
    return (stmt.get(id) as Column) || null;
  }

  update(id: number, updates: Partial<Pick<Column, 'name' | 'position'>>): Column | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.position !== undefined) {
      fields.push('position = ?');
      values.push(updates.position);
    }

    if (fields.length === 0) return existing;

    values.push(id);
    const stmt = this.db.prepare(`
      UPDATE columns
      SET ${fields.join(', ')}
      WHERE id = ?
      RETURNING id, board_id, name, position, created_at
    `);
    return stmt.get(...values) as Column;
  }

  delete(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM columns WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}
