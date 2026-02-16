import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Migration {
  filename: string;
  applied_at: string;
}

export function runMigrations(db: Database.Database): void {
  // Ensure migrations table exists first
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get list of migration files
  const migrationsDir = path.resolve(__dirname, '../../db/migrations');
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  // Get already-applied migrations
  const appliedMigrations = db
    .prepare('SELECT filename FROM migrations')
    .all() as Migration[];
  const appliedSet = new Set(appliedMigrations.map(m => m.filename));

  // Apply unapplied migrations
  for (const filename of migrationFiles) {
    if (appliedSet.has(filename)) {
      continue;
    }

    console.log(`Applying migration: ${filename}`);
    const migrationPath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Run migration in transaction
    const applyMigration = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO migrations (filename) VALUES (?)').run(filename);
    });

    try {
      applyMigration();
      console.log(`✓ Applied migration: ${filename}`);
    } catch (error) {
      console.error(`✗ Failed to apply migration: ${filename}`, error);
      throw error;
    }
  }
}
