// PIN 로그인. 첫 PIN 해시는 환경변수 APP_PIN_HASH, 앱에서 바꾼 PIN은 app_settings.pin_hash(우선).
// 세션 쿠키 서명 키는 SESSION_SECRET. PIN 값은 코드·로그에 남기지 않는다.
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const COOKIE_NAME = 'yuna_session';
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30일
export const MAX_FAILS = 5;
export const LOCK_MS = 5 * 60 * 1000;
export const PIN_RE = /^\d{4,6}$/;

// 두 사람이 PIN 하나를 같이 쓰는 앱이라 실패 횟수는 프로세스 메모리에 하나만 둔다.
let failCount = 0;
let lockedUntil = 0;
let storedHash = null; // app_settings에서 읽은 값 (앱에서 PIN을 바꾼 적이 있으면)

export function hashPin(pin) {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 32);
  // 마지막 칸은 PIN 자릿수 (화면 숫자패드가 몇 자리에서 확인할지 알려고)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}$${pin.length}`;
}

export function pinLength() {
  const len = Number(currentHash().split('$')[3]);
  return Number.isInteger(len) && len >= 4 && len <= 6 ? len : 4;
}

function checkHash(pin, encoded) {
  const [scheme, saltHex, hashHex] = String(encoded).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(String(pin), Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

export function currentHash() {
  return storedHash || (process.env.APP_PIN_HASH || '').trim();
}

export function setStoredHash(hash) {
  storedHash = hash || null;
}

export function authEnabled() {
  return Boolean(currentHash());
}

export function checkConfig() {
  if (!authEnabled()) {
    console.warn('APP_PIN_HASH가 비어 있어 PIN 인증을 건너뜁니다 (로컬 개발용). 배포 환경에서는 반드시 설정하세요.');
    return;
  }
  if (!process.env.SESSION_SECRET) {
    throw new Error('APP_PIN_HASH가 설정됐는데 SESSION_SECRET이 비어 있습니다.');
  }
}

export function lockRemainingMs() {
  return Math.max(0, lockedUntil - Date.now());
}

export function resetLock() {
  failCount = 0;
  lockedUntil = 0;
}

// 맞으면 true. 5번 연속 틀리면 5분 잠근다. 잠겨 있는 동안은 호출하지 않는다(라우트에서 먼저 확인).
export function verifyPin(pin) {
  if (checkHash(pin, currentHash())) {
    resetLock();
    return true;
  }
  failCount += 1;
  if (failCount >= MAX_FAILS) {
    lockedUntil = Date.now() + LOCK_MS;
    failCount = 0;
  }
  return false;
}

// PIN이 바뀌면 이 값이 달라져서, 예전 PIN으로 받은 쿠키는 모두 무효가 된다.
function pinVersion() {
  return createHash('sha256').update(currentHash()).digest('hex').slice(0, 16);
}

function sign(payload) {
  return createHmac('sha256', process.env.SESSION_SECRET).update(payload).digest('base64url');
}

export function issueToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_MAX_AGE_MS, v: pinVersion() })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function isValidToken(token) {
  if (!token || typeof token !== 'string') return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
  try {
    const { exp, v } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof exp === 'number' && exp > Date.now() && v === pinVersion();
  } catch {
    return false;
  }
}

export function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  };
}

const PUBLIC_API_PATHS = new Set(['/api/health', '/api/auth/status', '/api/auth/login', '/api/auth/logout']);

// /api 아래는 로그인해야 쓸 수 있다. 화면(정적 파일)은 열리고 화면에서 PIN을 묻는다.
export function requireAuth(req, res, next) {
  if (!authEnabled() || !req.path.startsWith('/api/') || PUBLIC_API_PATHS.has(req.path)) return next();
  if (isValidToken(readCookie(req, COOKIE_NAME))) return next();
  res.status(401).json({ error: '로그인이 필요해요' });
}
