import Database from 'better-sqlite3';
import type { Board, BoardWithColumns, ColumnWithCards, Column, Card } from '../types/entities';

export class BoardRepository {
  constructor(private db: Database.Database) {}

  findAll(): Board[] {
    const stmt = this.db.prepare('SELECT * FROM boards ORDER BY created_at DESC');
    return stmt.all() as Board[];
  }

  findById(id: number): Board | undefined {
    const stmt = this.db.prepare('SELECT * FROM boards WHERE id = ?');
    return stmt.get(id) as Board | undefined;
  }

  findByIdWithColumns(id: number): BoardWithColumns | undefined {
    const board = this.findById(id);
    if (!board) {
      return undefined;
    }

    // Get columns for this board
    const columnsStmt = this.db.prepare(
      'SELECT * FROM columns WHERE board_id = ? ORDER BY position'
    );
    const columns = columnsStmt.all(id) as Column[];

    // Get cards for each column
    const cardsStmt = this.db.prepare(
      'SELECT * FROM cards WHERE column_id = ? ORDER BY position'
    );

    const columnsWithCards: ColumnWithCards[] = columns.map(column => {
      const cards = cardsStmt.all(column.id) as Card[];
      return {
        ...column,
        cards
      };
    });

    return {
      ...board,
      columns: columnsWithCards
    };
  }

  create(name: string): Board {
    const stmt = this.db.prepare(
      'INSERT INTO boards (name) VALUES (?)'
    );
    const result = stmt.run(name);
    return this.findById(result.lastInsertRowid as number)!;
  }

  update(id: number, name: string): Board | undefined {
    const stmt = this.db.prepare(
      'UPDATE boards SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    );
    const result = stmt.run(name, id);

    if (result.changes === 0) {
      return undefined;
    }

    return this.findById(id);
  }

  delete(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM boards WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}
