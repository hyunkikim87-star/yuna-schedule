// PIN을 해시로 바꿔 APP_PIN_HASH 환경변수 값을 만든다.
// 사용법: node scripts/hash-pin.js   (PIN은 화면에 보이지 않게 입력)
import { randomBytes } from 'node:crypto';
import { PIN_RE, hashPin } from '../lib/auth.js';
import { askHidden } from './lib/prompt.js';

const pin = await askHidden('PIN (숫자 4~6자리): ');
if (!PIN_RE.test(pin)) {
  console.error('PIN은 숫자 4~6자리여야 합니다.');
  process.exit(1);
}
if ((await askHidden('한 번 더: ')) !== pin) {
  console.error('두 PIN이 다릅니다.');
  process.exit(1);
}

console.log();
console.log(`APP_PIN_HASH=${hashPin(pin)}`);
console.log(`SESSION_SECRET=${randomBytes(32).toString('base64url')}   (처음 한 번만 설정, 바꾸면 모두 로그아웃)`);
