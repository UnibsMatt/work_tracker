import { getDb, getActive, json } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST() {
  const active = getActive();
  if (active) return json({ shift: active });
  const now = Date.now();
  const info = getDb().prepare('INSERT INTO shifts (start_at) VALUES (?)').run(now);
  return json({ shift: { id: info.lastInsertRowid, start_at: now, end_at: null } }, 201);
}
