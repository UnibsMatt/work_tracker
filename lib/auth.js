// Signed session cookie: "<user>.<expiresMs>.<hmac>". Uses Web Crypto so it
// works both in middleware (edge) and in API routes (node).
export const COOKIE = 'bunny_session';
export const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const enc = new TextEncoder();

function secret() {
  return process.env.SESSION_SECRET || `${process.env.APP_USER}:${process.env.APP_PASSWORD}:bunny`;
}

async function sign(text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function checkCredentials(user, pass) {
  const u = process.env.APP_USER, p = process.env.APP_PASSWORD;
  if (!u || !p) return false;
  return safeEqual(String(user ?? ''), u) & safeEqual(String(pass ?? ''), p) ? true : false;
}

export async function createToken() {
  const payload = `${encodeURIComponent(process.env.APP_USER)}.${Date.now() + MAX_AGE * 1000}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifyToken(token) {
  if (!token) return false;
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const payload = token.slice(0, i);
  const exp = Number(payload.split('.')[1]);
  if (!exp || exp < Date.now()) return false;
  return safeEqual(token.slice(i + 1), await sign(payload));
}
