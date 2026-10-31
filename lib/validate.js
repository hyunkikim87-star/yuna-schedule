// 입력 검사. 맞으면 { value }, 틀리면 { error } 를 돌려준다.
import { isValidDate, isValidTime } from './sessions.js';

function text(v, max) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return max ? s.slice(0, max) : s;
}

function checkTimes(start_time, end_time, { startRequired }) {
  if (startRequired && !isValidTime(start_time)) return '시작 시간은 HH:MM 형식이어야 해요';
  if (start_time != null && !isValidTime(start_time)) return '시작 시간은 HH:MM 형식이어야 해요';
  if (end_time != null && !isValidTime(end_time)) return '끝 시간은 HH:MM 형식이어야 해요';
  if (start_time && end_time && end_time <= start_time) return '끝 시간은 시작 시간보다 늦어야 해요';
  return null;
}

export function parseClass(body = {}) {
  const name = text(body.name, 100);
  if (!name) return { error: '수업명을 입력해 주세요' };
  const weekday = Number(body.weekday);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { error: '요일은 0(일)~6(토)이어야 해요' };
  const start_time = text(body.start_time);
  const end_time = text(body.end_time);
  const timeError = checkTimes(start_time, end_time, { startRequired: true });
  if (timeError) return { error: timeError };
  if (!isValidDate(body.start_date) || !isValidDate(body.end_date)) return { error: '기간은 YYYY-MM-DD 형식이어야 해요' };
  if (body.start_date > body.end_date) return { error: '종료일은 시작일보다 같거나 늦어야 해요' };
  return {
    value: {
      name, weekday, start_time, end_time,
      location: text(body.location, 100),
      start_date: body.start_date,
      end_date: body.end_date,
      supplies: text(body.supplies),
      memo: text(body.memo),
      color: text(body.color, 20),
      term: text(body.term, 50),
    },
  };
}

export function parseException(body = {}) {
  if (!isValidDate(body.date)) return { error: '날짜는 YYYY-MM-DD 형식이어야 해요' };
  if (body.type !== 'cancel' && body.type !== 'change') return { error: "type은 'cancel' 또는 'change'여야 해요" };
  if (body.type === 'cancel') {
    return { value: { date: body.date, type: 'cancel', start_time: null, end_time: null, location: null, memo: text(body.memo), supplies: null } };
  }
  const start_time = text(body.start_time);
  const end_time = text(body.end_time);
  const location = text(body.location, 100);
  const memo = text(body.memo);
  const supplies = text(body.supplies);
  if (!start_time && !end_time && !location && !memo && !supplies) return { error: '바꿀 내용(시간·장소·준비물·메모)을 하나 이상 입력해 주세요' };
  const timeError = checkTimes(start_time, end_time, { startRequired: false });
  if (timeError) return { error: timeError };
  return { value: { date: body.date, type: 'change', start_time, end_time, location, memo, supplies } };
}

export function parseOneDayEvent(body = {}) {
  const name = text(body.name, 100);
  if (!name) return { error: '수업명을 입력해 주세요' };
  if (!isValidDate(body.date)) return { error: '날짜는 YYYY-MM-DD 형식이어야 해요' };
  const start_time = text(body.start_time);
  const end_time = text(body.end_time);
  const timeError = checkTimes(start_time, end_time, { startRequired: true });
  if (timeError) return { error: timeError };
  return {
    value: {
      name, date: body.date, start_time, end_time,
      location: text(body.location, 100),
      supplies: text(body.supplies),
      memo: text(body.memo),
      color: text(body.color, 20),
    },
  };
}

export function parsePlace(body = {}) {
  const name = text(body.name, 100);
  if (!name) return { error: '장소 이름을 입력해 주세요' };
  return { value: { name, map_url: text(body.map_url) } };
}

export function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}
