import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file, dependencies = {}) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (id) => dependencies[id],
      Intl,
      Date,
      Set,
      Map,
      Object,
    },
  );
  return module.exports;
}
const english = load('app/locales/en.ts');
const { translate } = load('app/utils/locale.ts', { '~/locales/en': english });
assert.equal(translate('ko', '로그인'), '로그인');
assert.equal(translate('en', '로그인'), 'Sign in');
assert.equal(
  translate('en', '다른 기기 3곳에서 로그아웃했어요.'),
  'Signed out of 3 other devices.',
);
assert.equal(translate('en', '할 일 상세 · 했냐옹'), 'Task Details · Haetnyaong');
assert.equal(translate('en', '새 이름을 삭제할까요?'), 'Delete 새 이름?');
assert.equal(
  translate('en', '입력 내용을 확인해주세요. (오류 번호: AB12)'),
  'Please check your input. (Error ID: AB12)',
);
assert.equal(translate('en', '내가 작성한 제목'), '내가 작성한 제목');
assert.equal(translate('en', ' 수정'), ' Edit');
assert.equal(
  translate(
    'en',
    '탈퇴 즉시 계정과 서비스 데이터는 운영 데이터베이스에서 삭제합니다. Slack 예약 취소가 확인되지 않은 경우에는 취소에 필요한 채널 ID와 예약 메시지 ID, 워크스페이스의 암호화된 앱 설치 토큰을 임시 보관합니다. 설치 토큰은 다른 연결 사용자가 있거나 예약 취소에 필요한 동안 유지하며, 연결과 취소 작업이 모두 정리되면 정기 정리 작업에서 삭제합니다.',
  ),
  english.default[
    '탈퇴 즉시 계정과 서비스 데이터는 운영 데이터베이스에서 삭제합니다. Slack 예약 취소가 확인되지 않은 경우에는 취소에 필요한 채널 ID와 예약 메시지 ID, 워크스페이스의 암호화된 앱 설치 토큰을 임시 보관합니다. 설치 토큰은 다른 연결 사용자가 있거나 예약 취소에 필요한 동안 유지하며, 연결과 취소 작업이 모두 정리되면 정기 정리 작업에서 삭제합니다.'
  ],
);
const display = load('app/utils/display.ts');
assert.notEqual(
  display.showTime('2026-10-22T00:00:00Z', 'ko'),
  display.showTime('2026-10-22T00:00:00Z', 'en'),
);
assert.match(display.showTime('2026-10-22T00:00:00Z', 'en'), /9:00/);
assert.equal(display.koreaDate(new Date('2026-10-21T15:00:00Z')), '2026-10-22');
for (const [key, value] of Object.entries(english.default)) {
  assert.equal(typeof value, 'string');
  assert.deepEqual(
    (key.match(/\{\d+\}/g) || []).sort(),
    (value.match(/\{\d+\}/g) || []).sort(),
    key + ' placeholders',
  );
}
console.log(
  'PASS: Korean fallback, English messages, dynamic counts/titles/error IDs, unchanged user text, placeholder parity, locale dates with unchanged KST semantics.',
);
