// 테스트용 PIN 설정. 실제 PIN이 아닌 테스트 값.
import { hashPin } from '../lib/auth.js';

export const TEST_PIN = '2468';

export function setTestAuthEnv() {
  process.env.APP_PIN_HASH = hashPin(TEST_PIN);
  process.env.SESSION_SECRET = 'test-session-secret';
}

// 로그인한 supertest agent를 돌려준다 (쿠키가 이후 요청에 자동으로 붙음).
export async function loggedInAgent(request, app) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ pin: TEST_PIN });
  if (res.status !== 200) throw new Error(`test login failed: ${res.status}`);
  return agent;
}
