import { getDb, json } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req, { params }) {
  const { id } = await params;
  const { start_at, end_at } = await req.json().catch(() => ({}));
  const s = Number(start_at);
  const e = end_at == null ? null : Number(end_at);
  if (!s || (e !== null && e <= s)) return json({ error: 'End must be after start' }, 400);
  const info = getDb().prepare('UPDATE shifts SET start_at = ?, end_at = ? WHERE id = ?').run(s, e, Number(id));
  if (!info.changes) return json({ error: 'Not found' }, 404);
  return json({ ok: true });
}

export async function DELETE(_req, { params }) {
  const { id } = await params;
  getDb().prepare('DELETE FROM shifts WHERE id = ?').run(Number(id));
  return json({ ok: true });
}
