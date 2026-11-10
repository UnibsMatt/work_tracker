import { getDb, getActive, json } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST() {
  const active = getActive();
  if (!active) return json({ error: 'No shift running' }, 400);
  const now = Date.now();
  getDb().prepare('UPDATE shifts SET end_at = ? WHERE id = ?').run(now, active.id);
  return json({ shift: { ...active, end_at: now } });
}
