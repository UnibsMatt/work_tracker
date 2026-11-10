import { COOKIE, MAX_AGE, checkCredentials, createToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const { username, password } = await req.json().catch(() => ({}));
  if (!process.env.APP_USER || !process.env.APP_PASSWORD) {
    return Response.json({ error: 'Imposta APP_USER e APP_PASSWORD nel file .env' }, { status: 500 });
  }
  if (!checkCredentials(username, password)) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return Response.json({ error: 'Nome utente o password errati 🙈' }, { status: 401 });
  }
  const https = req.headers.get('x-forwarded-proto') === 'https' || new URL(req.url).protocol === 'https:';
  const res = Response.json({ ok: true });
  res.headers.append(
    'Set-Cookie',
    `${COOKIE}=${await createToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${https ? '; Secure' : ''}`
  );
  return res;
}
