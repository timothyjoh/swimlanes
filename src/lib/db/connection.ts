import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../..');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dbDir = join(projectRoot, 'db');
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    const dbPath = join(dbDir, 'swimlanes.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');  // Better concurrency

    runMigrations(db);
  }
  return db;
}

export function getTestDb(): Database.Database {
  const testDb = new Database(':memory:');
  testDb.pragma('journal_mode = WAL');
  runMigrations(testDb);
  return testDb;
}

function runMigrations(database: Database.Database): void {
  // Create migrations tracking table
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = join(projectRoot, 'db/migrations');
  if (!existsSync(migrationsDir)) return;

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const applied = database.prepare(
      'SELECT 1 FROM migrations WHERE filename = ?'
    ).get(file);

    if (!applied) {
      const sql = readFileSync(join(migrationsDir, file), 'utf-8');
      database.exec(sql);
      database.prepare('INSERT INTO migrations (filename) VALUES (?)').run(file);
      console.log(`Applied migration: ${file}`);
    }
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
