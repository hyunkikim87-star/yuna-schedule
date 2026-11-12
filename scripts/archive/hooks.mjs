// 모듈 훅: 예전 앱 폴더(yuna-schedule-v1)의 db.js가 'pg'를 부르면 메모리 DB 대체품을 준다.
const SHIM = new URL('./pg-shim.mjs', import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === 'pg' && context.parentURL && /yuna-schedule-v1\/db\.js$/.test(context.parentURL)) {
    return { url: SHIM, shortCircuit: true };
  }
  return next(specifier, context);
}
