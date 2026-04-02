import * as jose from 'jose';
import bcrypt from 'bcryptjs';

const COOKIE = 'tf_admin_session';
const JWT_ALG = 'HS256';

function getSecret() {
  const s = process.env.JWT_SECRET || process.env.AUTH_SECRET;
  if (s && s.length >= 16) return new TextEncoder().encode(s);
  if (process.env.NODE_ENV !== 'production') {
    return new TextEncoder().encode('dev-only-jwt-secret-change-me');
  }
  throw new Error('JWT_SECRET (ou AUTH_SECRET) deve ter pelo menos 16 caracteres em produção.');
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export async function signAdminToken(payload) {
  return new jose.SignJWT({
    sub: payload.sub,
    email: payload.email,
    role: payload.role || 'admin',
  })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function verifyAdminToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jose.jwtVerify(token, getSecret(), {
      algorithms: [JWT_ALG],
    });
    return payload;
  } catch {
    return null;
  }
}

export function getCookieName() {
  return COOKIE;
}

export function buildSessionCookie(token, maxAgeSec = 60 * 60 * 24 * 7) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function parseCookies(header) {
  const out = {};
  if (!header || typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

export function getTokenFromCookie(header) {
  const c = parseCookies(header);
  return c[COOKIE] || null;
}
