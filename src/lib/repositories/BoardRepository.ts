import type Database from 'better-sqlite3';
import type { Board, NewBoard } from '../db/types';

export class BoardRepository {
  constructor(private db: Database.Database) {}

  create(board: NewBoard): Board {
    const stmt = this.db.prepare(
      'INSERT INTO boards (name) VALUES (?) RETURNING id, name, created_at'
    );
    return stmt.get(board.name) as Board;
  }

  findAll(): Board[] {
    const stmt = this.db.prepare(
      'SELECT id, name, created_at FROM boards ORDER BY created_at DESC, id DESC'
    );
    return stmt.all() as Board[];
  }

  findById(id: number): Board | null {
    const stmt = this.db.prepare(
      'SELECT id, name, created_at FROM boards WHERE id = ?'
    );
    return (stmt.get(id) as Board) || null;
  }
}
