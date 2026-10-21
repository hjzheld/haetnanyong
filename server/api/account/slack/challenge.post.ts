import { requireUser } from '#server/utils/auth';

export default defineEventHandler(async (event) => {
  await requireUser(event);
  throw createError({
    statusCode: 410,
    statusMessage: 'Slack member ID connection is no longer supported',
    data: {
      message:
        'Slack 연결 방식이 변경됐어요. 페이지를 새로고침한 뒤 Slack 연결 버튼으로 시작해주세요.',
    },
  });
});
