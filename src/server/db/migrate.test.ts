import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { migrate } from './migrate.js';

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('migrations', () => {
  it('applique 001_init.sql une seule fois', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flowergift-db-'));
    dirs.push(dir);
    const db = new Database(join(dir, 'flowergift.db'));
    const migrationsDir = join(import.meta.dirname, 'migrations');

    const first = migrate(db, migrationsDir);
    const second = migrate(db, migrationsDir);
    const rows = db.prepare('SELECT id FROM schema_migrations ORDER BY id').all() as { id: string }[];

    expect(first).toEqual(['001_init.sql', '002_sessions.sql', '003_gifts.sql', '004_tracking.sql', '005_palette.sql']);
    expect(second).toEqual([]);
    expect(rows.map((row) => row.id)).toEqual(['001_init.sql', '002_sessions.sql', '003_gifts.sql', '004_tracking.sql', '005_palette.sql']);
    db.close();
  });
});
