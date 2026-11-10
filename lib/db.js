import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export function getDb() {
  if (!globalThis.__shiftDb) {
    const file = process.env.DB_PATH || path.join(process.cwd(), 'data', 'shifts.db');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const db = new Database(file);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS shifts (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        start_at INTEGER NOT NULL,   -- unix ms
        end_at   INTEGER             -- unix ms, NULL while working
      );
      CREATE INDEX IF NOT EXISTS idx_shifts_start ON shifts(start_at);
    `);
    globalThis.__shiftDb = db;
  }
  return globalThis.__shiftDb;
}

export function getActive() {
  return getDb().prepare('SELECT * FROM shifts WHERE end_at IS NULL ORDER BY start_at DESC LIMIT 1').get() || null;
}

export function payConfig() {
  const n = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);
  return {
    hoursA: n(process.env.PAY_HOURS_A, 4),
    rateA: n(process.env.PAY_RATE_A, 10),
    hoursB: n(process.env.PAY_HOURS_B, 3),
    rateB: n(process.env.PAY_RATE_B, 12),
  };
}

export function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
