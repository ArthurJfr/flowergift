import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';

export function migrate(db: Database.Database, dir: string): string[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  const applied = new Set(
    db
      .prepare('SELECT id FROM schema_migrations')
      .all()
      .map((row) => (row as { id: string }).id),
  );
  const ran: string[] = [];

  const insert = db.prepare(
    'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)',
  );

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(dir, file), 'utf8');
    const apply = db.transaction(() => {
      if (sql.trim()) db.exec(sql);
      insert.run(file, new Date().toISOString());
    });
    apply();
    ran.push(file);
  }

  return ran;
}
