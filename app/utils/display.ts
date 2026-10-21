export const labels: Record<string, string> = {
  TODO: '할 일',
  IN_PROGRESS: '진행 중',
  DONE: '완료',
  LOW: '낮음',
  MEDIUM: '보통',
  HIGH: '높음',
  PENDING: '대기',
  SCHEDULING: '예약 처리 중',
  SCHEDULED: '예약됨',
  FAILED: '실패',
  UNKNOWN: '결과 확인 필요',
  CANCEL_PENDING: '취소 처리 중',
  CANCELED: '취소됨',
  CANCEL_FAILED: '취소 실패',
  ELAPSED: '시간 경과 · 발송 미확인',
};
const koreaDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' });
const timeOptions: Intl.DateTimeFormatOptions = {
  timeZone: 'Asia/Seoul',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};
const timeFormatters = {
  ko: new Intl.DateTimeFormat('ko-KR', timeOptions),
  en: new Intl.DateTimeFormat('en-US', timeOptions),
};
export const koreaDate = (value = new Date()) => koreaDateFormatter.format(value);
export const datePart = (value?: string | null) =>
  !value ? '' : /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : koreaDate(new Date(value));
export const localTime = (value?: string | null) =>
  value
    ? new Date(value)
        .toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
        .slice(0, 16)
        .replace(' ', 'T')
    : '';
export const showTime = (value?: string | null, locale: 'ko' | 'en' = 'ko') =>
  value ? timeFormatters[locale].format(new Date(value)) : '';
export type ErrorContext =
  | 'default'
  | 'load'
  | 'save'
  | 'delete'
  | 'login'
  | 'register'
  | 'logout'
  | 'profile'
  | 'password'
  | 'slack'
  | 'slackVerify'
  | 'reminder'
  | 'calendar';

type ApiErrorLike = {
  status?: number;
  statusCode?: number;
  statusMessage?: string;
  message?: string;
  data?: {
    statusCode?: number;
    statusMessage?: string;
    message?: string;
    data?: { message?: string };
  };
  response?: { headers?: { get?: (name: string) => string | null } };
};

const friendlyMessages = new Set([
  '새 프로젝트 이름을 1~150자로 입력해주세요.',
  '알림은 현재부터 1분 이후, 120일 이내로 설정해주세요.',
  '마감일은 시작일 이후여야 해요.',
  '종료는 시작보다 뒤여야 해요.',
  '닉네임은 2~30자로 입력해주세요.',
  '이메일 형식을 확인해주세요.',
  '비밀번호 변경 메뉴를 이용해주세요.',
  '현재 비밀번호가 일치하지 않아요.',
  '새 비밀번호는 8~200자로 입력해주세요.',
  '계정 정보가 변경되었어요. 다시 로그인해주세요.',
  '인증 코드가 틀리거나 만료되었어요.',
  'Slack 멤버 ID를 확인해주세요. U 또는 W로 시작합니다.',
  '인증 코드 재발송은 1분 후에 가능해요.',
  '이 앱이 설치된 워크스페이스의 활성 사용자만 연결할 수 있어요.',
  'Slack DM을 열지 못했어요.',
  'Slack 연결이 서버에 설정되지 않았어요.',
  '마이페이지에서 본인의 Slack 계정을 먼저 연결해주세요.',
  '예약 중이거나 결과 확인이 필요한 알림을 먼저 취소·확인해주세요.',
]);

const exactMessages: Record<string, string> = {
  'Reminder must be at least 1 minute in the future and within 120 days':
    '알림은 현재부터 1분 이후, 120일 이내로 설정해주세요.',
  'Slack reservation list is incomplete':
    'Slack 예약 목록을 확인하지 못했어요. 기존 알림은 유지돼요. 잠시 후 상태 확인을 다시 눌러주세요.',
  'Slack reservation was not found; choose a new reminder time':
    'Slack에서 예약을 찾지 못했어요. 알림 시각을 확인하고 다시 예약해주세요.',
  'Slack workspace does not match the connected account':
    '연결된 Slack 워크스페이스가 달라요. 마이페이지에서 다시 연결해주세요.',
  'Slack installation token is unavailable':
    'Slack 연결 정보를 사용할 수 없어요. 관리자에게 문의해주세요.',
  'Invalid email': '이메일 형식을 확인해주세요.',
  'Invalid email or password': '이메일 또는 비밀번호가 일치하지 않아요.',
  'Email is already registered': '이미 가입된 이메일이에요.',
  'nickname must be a string': '닉네임을 다시 입력해주세요.',
  'User registration failed': '회원가입을 완료하지 못했어요. 잠시 후 다시 시도해주세요.',
  'Authentication required': '로그인이 필요한 기능이에요.',
  'Session expired': '로그인이 만료됐어요. 다시 로그인해주세요.',
  'Resource not found': '요청한 내용을 찾을 수 없어요.',
  'Project not found': '프로젝트를 찾을 수 없거나 이미 삭제됐어요.',
  'Task not found': '할 일을 찾을 수 없거나 이미 삭제됐어요.',
  'Event not found': '일정을 찾을 수 없거나 이미 삭제됐어요.',
  'Reminder not found': '리마인더를 찾을 수 없거나 이미 삭제됐어요.',
  'Project not found or archived': '프로젝트를 찾을 수 없거나 보관된 프로젝트예요.',
  'Event not found or project archived': '일정을 찾을 수 없거나 프로젝트가 보관됐어요.',
  'Task not found or invalid date range': '할 일을 찾을 수 없거나 날짜 범위가 올바르지 않아요.',
  'Event not found or invalid date range': '일정을 찾을 수 없거나 날짜 범위가 올바르지 않아요.',
  'Project name is required': '프로젝트 이름을 입력해주세요.',
  'Project name exceeds 150 characters': '프로젝트 이름은 150자 이내로 입력해주세요.',
  'Title cannot be empty': '제목을 입력해주세요.',
  'startDate must not exceed dueDate': '마감일은 시작일과 같거나 이후여야 해요.',
  'Event end must follow start': '일정 종료 시각은 시작 시각보다 뒤여야 해요.',
  'All-day events require startDate and endDate': '종일 일정의 시작일과 종료일을 입력해주세요.',
  'Timed events require startsAt and endsAt': '일정의 시작 시각과 종료 시각을 입력해주세요.',
  'Cancel or reconcile the reminder before editing this event':
    '연결된 리마인더를 먼저 취소하거나 상태를 확인해주세요.',
  'Use scheduledAt or offsetMinutes, not both':
    '알림 시각 또는 시작 전 알림 중 하나만 선택해주세요.',
  'Timed events require offsetMinutes 10 or 30; all-day events require scheduledAt':
    '시간 일정은 10분 전 또는 30분 전을, 종일 일정은 알림 시각을 선택해주세요.',
  'Reminder must be in the future and within 120 days':
    '리마인더는 현재부터 120일 이내의 미래 시각으로 설정해주세요.',
  'Event already has a reminder; cancel it before replacing it':
    '이 일정에는 이미 리마인더가 있어요. 기존 리마인더를 먼저 취소해주세요.',
  'Slack did not return a reservation ID':
    'Slack 알림 예약을 확인하지 못했어요. 잠시 후 상태를 다시 확인해주세요.',
  'Reservation outcome requires reconciliation before cancellation':
    '아직 예약 처리 중이거나 결과가 불확실해요. 2분 후 상태 확인을 누르고 다시 취소해주세요.',
  'Reminder state changed; reload before retrying':
    '리마인더 상태가 변경됐어요. 새로고침 후 다시 시도해주세요.',
  'Stored Slack channel is missing': 'Slack 연결 정보가 없어요. 마이페이지에서 다시 연결해주세요.',
  'Cancellation failed': 'Slack 리마인더 취소에 실패했어요. 잠시 후 다시 시도해주세요.',
  'Scheduling outcome unknown':
    'Slack 예약 결과를 확인하지 못했어요. 2분 후 알림 목록에서 상태 확인을 눌러주세요.',
  'A record with the same unique value already exists':
    '이미 사용 중인 값이 있어요. 입력 내용을 확인해주세요.',
  'Input violates a database field or relationship constraint':
    '입력 내용이 올바르지 않거나 연결된 항목을 찾을 수 없어요.',
  'DATABASE_URL is not configured': '서비스 설정을 확인하고 있어요. 잠시 후 다시 시도해주세요.',
  'Database connection failed': '데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
  'SLACK_BOT_TOKEN is not configured':
    'Slack 연결 준비가 완료되지 않았어요. 관리자에게 문의해주세요.',
  'Unable to reach Slack': 'Slack에 연결하지 못했어요. 잠시 후 다시 시도해주세요.',
  'Page not found': '요청한 페이지를 찾을 수 없어요.',
  'Invalid numeric ID': '잘못된 주소예요. 목록에서 다시 선택해주세요.',
  'Invalid scope': '요청 방식이 올바르지 않아요. 화면을 새로고침해주세요.',
  'from must precede to': '조회 기간이 올바르지 않아요. 날짜를 다시 선택해주세요.',
};

const contextFallbacks: Record<ErrorContext, string> = {
  default: '요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.',
  load: '내용을 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
  save: '저장하지 못했어요. 입력 내용을 확인하고 다시 시도해주세요.',
  delete: '삭제하지 못했어요. 새로고침 후 다시 시도해주세요.',
  login: '로그인하지 못했어요. 입력 내용을 확인하고 다시 시도해주세요.',
  register: '회원가입을 완료하지 못했어요. 입력 내용을 확인해주세요.',
  logout: '로그아웃하지 못했어요. 잠시 후 다시 시도해주세요.',
  profile: '회원 정보를 저장하지 못했어요. 입력 내용을 확인해주세요.',
  password: '비밀번호를 변경하지 못했어요. 입력 내용을 확인해주세요.',
  slack: 'Slack 계정을 연결하지 못했어요. 잠시 후 다시 시도해주세요.',
  slackVerify: 'Slack 인증을 완료하지 못했어요. 인증 코드를 다시 확인해주세요.',
  reminder: '리마인더를 처리하지 못했어요. 잠시 후 다시 시도해주세요.',
  calendar: '캘린더를 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
};

function technicalMessage(raw: string) {
  if (/messages_tab_disabled/i.test(raw))
    return 'Slack 앱의 App Home에서 Messages Tab을 켠 뒤 다시 시도해주세요.';
  if (/Scheduled time passed; delivery is unverified/i.test(raw))
    return '예약 시간이 지났지만 발송 여부는 확인되지 않았어요. 마이페이지에서 테스트 DM을 보내 확인해주세요.';
  if (/Slack (?:workspace|recipient) does not match/i.test(raw))
    return 'Slack 대화방을 찾지 못했어요. Slack 계정을 다시 연결해주세요.';
  if (/missing_scope/i.test(raw)) return 'Slack 앱 권한이 부족해요. 관리자에게 문의해주세요.';
  if (/invalid_auth|not_authed|token_(?:expired|revoked)/i.test(raw))
    return 'Slack 연결 인증이 만료됐어요. 관리자에게 문의해주세요.';
  if (/user_not_found|users_not_found/i.test(raw))
    return 'Slack 사용자를 찾지 못했어요. 멤버 ID와 워크스페이스를 확인해주세요.';
  if (/ratelimited|too_many_requests/i.test(raw))
    return '요청이 너무 많아요. 잠시 후 다시 시도해주세요.';
  if (/internal_error|fatal_error|Slack .* request failed/i.test(raw))
    return 'Slack 응답을 확인하지 못했어요. 알림 목록에서 2분 후 상태 확인을 눌러주세요.';
  if (/channel_not_found|not_in_channel/i.test(raw))
    return 'Slack 대화방을 찾지 못했어요. Slack 계정을 다시 연결해주세요.';
  if (/account_inactive|user_not_visible/i.test(raw))
    return '사용할 수 없는 Slack 계정이에요. 활성 계정인지 확인해주세요.';
  if (/timeout|timed out|abort/i.test(raw))
    return '응답이 지연되고 있어요. 잠시 후 다시 시도해주세요.';
  if (/failed to fetch|fetch failed|network|econnrefused|load failed/i.test(raw))
    return '네트워크 연결을 확인한 뒤 다시 시도해주세요.';
  if (/Color must be|must be a hex color/i.test(raw))
    return '색상 값이 올바르지 않아요. 색상을 다시 선택해주세요.';
  if (/must be a valid YYYY-MM-DD date|must be an ISO timestamp/i.test(raw))
    return '날짜 또는 시간이 올바르지 않아요. 다시 선택해주세요.';
  if (/must be a non-empty string|required|JSON object body/i.test(raw))
    return '필수 입력값을 확인해주세요.';
  if (/exceeds \d+ characters|too long/i.test(raw)) return '입력 가능한 글자 수를 초과했어요.';
  if (/At least one .* field is required/i.test(raw)) return '변경할 내용을 입력해주세요.';
  return undefined;
}

export function errorText(error: unknown, context: ErrorContext = 'default') {
  const e = (error || {}) as ApiErrorLike;
  const status = e.statusCode || e.status || e.data?.statusCode || 0;
  const requestId = e.response?.headers?.get?.('x-request-id');
  const messages = [
    e.data?.data?.message,
    e.data?.statusMessage,
    e.statusMessage,
    e.data?.message,
    e.message,
  ].filter((value): value is string => Boolean(value));
  let result = '';

  for (const message of messages) {
    if (friendlyMessages.has(message)) {
      result = message;
      break;
    }
    if (exactMessages[message]) {
      result = exactMessages[message];
      break;
    }
    const translated = technicalMessage(message);
    if (translated) {
      result = translated;
      break;
    }
  }

  if (!result && (status === 400 || status === 422))
    result = contextFallbacks[context] || '입력 내용을 확인해주세요.';
  else if (!result && status === 401) result = '로그인이 만료됐어요. 다시 로그인해주세요.';
  else if (!result && status === 403) result = '이 작업을 수행할 권한이 없어요.';
  else if (!result && status === 404) result = '요청한 내용을 찾을 수 없거나 이미 삭제됐어요.';
  else if (!result && status === 409)
    result = '다른 변경 사항과 충돌했어요. 새로고침 후 다시 시도해주세요.';
  else if (!result && status === 413) result = '입력한 내용의 크기가 너무 커요.';
  else if (!result && status === 429) result = '요청이 너무 많아요. 잠시 후 다시 시도해주세요.';
  else if (!result && [500, 502, 503, 504].includes(status))
    result = '서비스 연결이 원활하지 않아요. 잠시 후 다시 시도해주세요.';
  else if (!result) result = contextFallbacks[context];

  return status >= 500 && requestId ? `${result} (오류 번호: ${requestId})` : result;
}

export function reminderErrorText(message?: string | null, status?: string) {
  if (status === 'ELAPSED')
    return '예약 시간이 지났지만 발송 여부는 확인되지 않았어요. 마이페이지에서 테스트 DM을 보내 확인해주세요.';
  return message ? errorText({ statusCode: 502, statusMessage: message }, 'reminder') : '';
}
