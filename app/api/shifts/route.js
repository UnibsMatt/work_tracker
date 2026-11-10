import { getDb, getActive, payConfig, json } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/shifts?from=<ms>&to=<ms>  -> shifts that started in that range
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const from = Number(searchParams.get('from')) || 0;
  const to = Number(searchParams.get('to')) || Date.now() + 86400000;
  const shifts = getDb()
    .prepare('SELECT * FROM shifts WHERE start_at >= ? AND start_at < ? ORDER BY start_at DESC')
    .all(from, to);
  return json({ shifts, active: getActive(), pay: payConfig(), now: Date.now() });
}

// POST /api/shifts {start_at, end_at} -> add a shift manually
export async function POST(req) {
  const { start_at, end_at } = await req.json().catch(() => ({}));
  const s = Number(start_at), e = Number(end_at);
  if (!s || !e || e <= s) return json({ error: 'La fine deve essere dopo l’inizio' }, 400);
  const info = getDb().prepare('INSERT INTO shifts (start_at, end_at) VALUES (?, ?)').run(s, e);
  return json({ id: info.lastInsertRowid }, 201);
}
