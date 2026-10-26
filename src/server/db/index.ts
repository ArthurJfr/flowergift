import { join } from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from './migrate.js';

export function openDatabase(dataDir: string, migrationsDir: string): Database.Database {
  const db = new Database(join(dataDir, 'flowergift.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db, migrationsDir);
  return db;
}
