import { Router } from 'express';
import pool from '../db.js';
import {
  COOKIE_NAME, PIN_RE, authEnabled, cookieOptions, hashPin, isValidToken, issueToken,
  lockRemainingMs, pinLength, readCookie, setStoredHash, verifyPin,
} from '../lib/auth.js';

const router = Router();

function lockedResponse(res) {
  const seconds = Math.ceil(lockRemainingMs() / 1000);
  return res.status(429).json({ error: `여러 번 틀려서 잠겼어요. ${Math.ceil(seconds / 60)}분 뒤에 다시 해주세요`, retry_after: seconds });
}

router.get('/status', (req, res) => {
  const enabled = authEnabled();
  res.json({
    auth_enabled: enabled,
    logged_in: !enabled || isValidToken(readCookie(req, COOKIE_NAME)),
    locked_seconds: Math.ceil(lockRemainingMs() / 1000),
    pin_length: pinLength(),
  });
});

router.post('/login', (req, res) => {
  if (!authEnabled()) return res.json({ ok: true, auth: 'disabled' });
  if (lockRemainingMs() > 0) return lockedResponse(res);
  if (!verifyPin(String(req.body?.pin ?? ''))) {
    if (lockRemainingMs() > 0) return lockedResponse(res);
    return res.status(401).json({ error: 'PIN이 맞지 않아요' });
  }
  res.cookie(COOKIE_NAME, issueToken(), cookieOptions());
  res.json({ ok: true });
});

router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

// 로그인한 상태에서 지금 PIN을 한 번 더 확인하고 바꾼다. 바꾸면 다른 기기는 로그아웃된다.
router.post('/change-pin', async (req, res) => {
  if (!authEnabled()) return res.status(400).json({ error: 'PIN이 설정되지 않은 환경이에요' });
  const currentPin = String(req.body?.current_pin ?? '');
  const newPin = String(req.body?.new_pin ?? '');
  if (!PIN_RE.test(newPin)) return res.status(400).json({ error: '새 PIN은 숫자 4~6자리여야 해요' });
  if (lockRemainingMs() > 0) return lockedResponse(res);
  if (!verifyPin(currentPin)) {
    if (lockRemainingMs() > 0) return lockedResponse(res);
    return res.status(401).json({ error: '지금 PIN이 맞지 않아요' });
  }
  const hash = hashPin(newPin);
  await pool.query(
    `INSERT INTO app_settings (key, value) VALUES ('pin_hash', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [hash]
  );
  setStoredHash(hash);
  res.cookie(COOKIE_NAME, issueToken(), cookieOptions());
  res.json({ ok: true });
});

// 앱에서 바꾼 PIN(DB)을 읽는다. PIN을 잊었을 때는 Railway 환경변수 APP_PIN_RESET=true로 한 번 재시작하면
// DB의 PIN을 지우고 APP_PIN_HASH(환경변수)의 PIN으로 돌아간다. 재시작 뒤 APP_PIN_RESET은 지운다.
export async function loadStoredPinHash() {
  if (process.env.APP_PIN_RESET === 'true') {
    await pool.query(`DELETE FROM app_settings WHERE key = 'pin_hash'`);
    console.warn('APP_PIN_RESET=true: 앱에서 바꾼 PIN을 지우고 APP_PIN_HASH로 돌아갑니다. 이 환경변수는 지워 주세요.');
    setStoredHash(null);
    return;
  }
  const { rows } = await pool.query(`SELECT value FROM app_settings WHERE key = 'pin_hash'`);
  setStoredHash(rows[0]?.value);
}

export default router;
