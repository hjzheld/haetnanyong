<script setup lang="ts">
const route = useRoute();
const props = defineProps<{ errorPage?: boolean }>();
const { locale, tr } = useLocale();
const dialog = ref<HTMLDialogElement>();
const trigger = ref<HTMLButtonElement>();
const titleId = useId();
const content = computed(() => {
  const en = locale.value === 'en';
  const path = route.path;
  const section = (ko: string, english: string, text: string, translation: string) => ({
    title: en ? english : ko,
    text: en ? translation : text,
  });
  if (props.errorPage)
    return {
      title: en ? 'Page recovery help' : '오류 화면 도움말',
      sections: [
        section(
          '다시 시작하기',
          'Start again',
          '주소가 정확한지 확인하고 홈이나 로그인 화면으로 이동해주세요. 일시적인 오류라면 잠시 후 다시 시도해주세요. 계속 문제가 생기면 문의 시 발생한 화면과 시간을 알려주세요. 비밀번호나 인증 코드는 보내지 말아주세요.',
          'Check the address and return to Home or sign in. Try again later for temporary errors. If the problem persists, tell support which screen and time it occurred. Never send passwords or authorization codes.',
        ),
      ],
    };
  const basics = section(
    '일정과 할 일의 차이',
    'Events and tasks',
    '일정은 약속처럼 날짜와 시간을 정하는 계획이에요. 할 일은 마감일까지 끝내고 완료 표시하는 작업이에요. 프로젝트로 묶거나 프로젝트 없이 등록할 수 있어요.',
    'Events are plans with dates and times, such as appointments. Tasks are work you check off before a deadline. Both can belong to a project or stand alone.',
  );
  if (path === '/calendar')
    return {
      title: en ? 'Calendar help' : '캘린더 도움말',
      sections: [
        basics,
        section(
          '날짜별 일정 보기',
          'Browse events',
          '캘린더에는 일정만 표시돼요. 월 이동과 프로젝트 필터로 원하는 일정을 찾고, 일정을 누르면 상세 내용을 볼 수 있어요. 할 일은 플랜에서 확인해주세요.',
          'The calendar shows events only. Change the month or project filter, then open an event to see its details. Find tasks in Plans.',
        ),
        section(
          '일정 등록',
          'Create an event',
          '일정 등록 버튼으로 새 일정을 만들어요. 시간 일정은 한국 표준시(KST) 기준이며, 종일 일정의 종료일은 포함하지 않아요.',
          'Use the create button to add an event. Timed events use Korean Standard Time (KST). All-day events exclude the end date.',
        ),
      ],
    };
  if (path === '/reminders')
    return {
      title: en ? 'Reminder help' : '리마인더 도움말',
      sections: [
        section(
          'Slack 알림 예약',
          'Schedule Slack reminders',
          '마이페이지에서 Slack을 연결한 뒤 일정 상세에서 미래 시각의 알림을 예약해주세요. 할 일에는 Slack 알림을 예약하지 않아요. Slack 앱 홈을 열어둘 필요는 없어요.',
          'Connect Slack in My page, then schedule a future reminder from an event detail. Tasks do not support Slack reminders. You do not need to keep the Slack app Home open.',
        ),
        section(
          '예약 상태와 관리',
          'Status and actions',
          '예약 완료는 Slack이 예약을 접수한 상태예요. 확인 중이면 상태 확인을 눌러주세요. 결과를 확인하지 못했다는 안내가 나오면 2분 후 다시 확인해주세요. 실패하거나 시각이 지난 알림은 다시 예약할 수 있어요.',
          'Scheduled means Slack accepted the booking. Use Check status for an uncertain result. If prompted, wait two minutes before checking again. Failed or elapsed reminders can be rescheduled.',
        ),
        section(
          '수신 여부 확인',
          'Check delivery',
          '예약 시각이 지난 것만으로 실제 수신을 보장하지는 않아요. Slack의 봇 DM과 알림 설정을 확인해주세요. 예약 취소는 취소 완료 상태까지 확인해주세요.',
          'An elapsed booking does not guarantee delivery. Check the bot DM and your Slack notification settings. Confirm that a cancellation reaches the canceled state.',
        ),
      ],
    };
  if (path === '/mypage')
    return {
      title: en ? 'My page help' : '마이페이지 도움말',
      sections: [
        section(
          '계정 정보 변경',
          'Account settings',
          '닉네임과 비밀번호를 변경할 수 있어요. 입력 조건과 저장 결과를 확인해주세요. 비밀번호는 다른 서비스와 다르게 설정하는 것이 좋아요.',
          'Change your nickname or password here. Check the input requirements and save confirmation. Use a password unique to this service.',
        ),
        section(
          'Slack 연결',
          'Connect Slack',
          'Slack 연결 버튼에서 알림을 받을 워크스페이스와 계정을 선택하고 권한을 허용해주세요. 연결 완료 후 일정 상세에서 알림을 예약할 수 있어요. 연결만으로 알림이 자동 등록되지는 않아요.',
          'Choose your Slack workspace and account, then approve the requested permissions. Once connected, schedule a reminder from an event detail. Connecting alone does not create reminders.',
        ),
        section(
          '회원 탈퇴',
          'Delete account',
          '탈퇴하면 계정과 플랜을 복구할 수 없어요. Slack 예약 취소에 필요한 최소 정보는 취소 처리 동안 임시 보관될 수 있어요.',
          'Account deletion permanently removes your account and plans. Minimal Slack cancellation data may be retained temporarily to finish canceling bookings.',
        ),
      ],
    };
  if (path.startsWith('/items/'))
    return {
      title: en ? 'Plan item help' : '일정·할 일 도움말',
      sections: [
        basics,
        section(
          '등록과 수정',
          'Create and edit',
          '제목과 기간 등 필수 정보를 입력해주세요. 프로젝트 목록에서 기존 프로젝트를 선택하거나 새 프로젝트를 만들 수 있어요. 뒤로가기는 이전에 보던 화면으로 돌아가며, 작성 중인 변경 사항이 있으면 확인을 요청해요.',
          'Enter the required title and dates. Choose an existing project or create a new one. Back returns to your previous screen and asks before discarding unsaved changes.',
        ),
        section(
          '상세에서 관리',
          'Manage an item',
          '상세 화면에서 수정과 삭제를 할 수 있어요. 할 일은 완료 표시가 가능하고, 일정은 Slack 연결 후 알림을 설정할 수 있어요. 삭제한 내용은 복구할 수 없어요.',
          'Edit or delete an item from its detail screen. Tasks can be completed; events can have Slack reminders after connecting Slack. Deleted items cannot be recovered.',
        ),
      ],
    };
  if (path.startsWith('/projects/'))
    return {
      title: en ? 'Project help' : '프로젝트 도움말',
      sections: [
        basics,
        section(
          '프로젝트 관리',
          'Manage a project',
          '프로젝트는 관련 일정과 할 일을 묶는 공간이에요. 각 탭에서 항목을 추가하고 제목을 눌러 상세에서 수정·삭제할 수 있어요. 프로젝트 자체의 기간 대신 각 항목에 날짜를 정해요.',
          'Projects group related tasks and events. Add items from their tabs and open their titles to edit or delete them. Dates belong to individual items, not the project itself.',
        ),
        section(
          '보관함',
          'Archive',
          '끝난 프로젝트는 보관함으로 옮겨 관리할 수 있어요. 다시 진행하려면 복원해주세요. 삭제는 보관과 달리 되돌릴 수 없으므로 확인 후 진행해주세요.',
          'Archive finished projects and restore them when needed. Deletion is permanent, unlike archiving; read the confirmation carefully.',
        ),
      ],
    };
  if (path === '/login')
    return {
      title: en ? 'Sign-in help' : '로그인·회원가입 도움말',
      sections: [
        section(
          '이메일로 시작하기',
          'Get started with email',
          '가입한 이메일과 비밀번호로 로그인해주세요. 처음이라면 회원가입에서 이메일과 비밀번호를 입력해주세요. 닉네임은 선택이며 비워두면 자동으로 정해져요.',
          'Sign in with your registered email and password. New users can sign up with email and password. Nickname is optional and generated if omitted.',
        ),
        section(
          '접속이 안 될 때',
          'Trouble signing in',
          '이메일의 오타와 비밀번호를 확인해주세요. 요청이 너무 많다는 안내가 나오면 잠시 기다렸다가 다시 시도해주세요. 계속 문제가 생기면 하단 문의 채널을 이용해주세요.',
          'Check your email spelling and password. If you are rate-limited, wait before trying again. Use the support link below if problems continue.',
        ),
      ],
    };
  if (path.startsWith('/slack/'))
    return {
      title: en ? 'Slack connection help' : 'Slack 연결 도움말',
      sections: [
        section(
          '연결 결과 확인',
          'Connection result',
          '연결 완료 여부를 확인하고 마이페이지로 이동해주세요. 실패했다면 마이페이지에서 연결을 새로 시작해주세요. 이전 연결 주소를 재사용하거나 여러 탭에서 동시에 시도하지 말아주세요.',
          'Check the result and return to My page. If it failed, start a fresh connection there. Do not reuse an old authorization URL or connect in multiple tabs at once.',
        ),
      ],
    };
  if (path === '/privacy' || path === '/terms')
    return {
      title: en ? 'Service policy help' : '서비스 정책 도움말',
      sections: [
        section(
          '정책 확인과 문의',
          'Policies and questions',
          '이 페이지에서 서비스 이용과 개인정보 처리 기준을 확인할 수 있어요. 궁금한 내용이나 권리 행사 요청은 하단의 문의하기를 이용해주세요.',
          'Read the service and privacy rules on this page. Use the support link below for questions or privacy requests.',
        ),
      ],
    };
  return {
    title: en ? 'Home help' : '홈 도움말',
    sections: [
      basics,
      section(
        '오늘의 계획 확인',
        'Your daily overview',
        '홈에서 오늘과 내일의 계획을 확인해요. 기한이 지난 미완료 할 일은 지연된 할 일 카드에 따로 보여요. 항목을 누르면 상세로 이동해요.',
        'Home summarizes today and tomorrow. Overdue unfinished tasks appear in a separate card. Open an item to view its details.',
      ),
      section(
        '시작하기',
        'Get started',
        '로그인 후 플랜에서 프로젝트나 개별 항목을 등록해주세요. 캘린더에서는 일정만 모아 보고, 리마인더에서는 예약한 Slack 알림을 관리해요.',
        'After signing in, create projects or standalone items in Plans. Calendar shows events; Reminders manages scheduled Slack notifications.',
      ),
    ],
  };
});
function close() {
  dialog.value?.close();
  trigger.value?.focus();
}
watch(
  () => route.fullPath,
  () => dialog.value?.close(),
);
</script>
<template>
  <button
    ref="trigger"
    type="button"
    class="border-btn page-help-button"
    aria-haspopup="dialog"
    @click="dialog?.showModal()"
  >
     {{ tr('도움말') }}
  </button>
  <dialog
    ref="dialog"
    class="plan-help-dialog"
    :aria-labelledby="titleId"
    @cancel.prevent="close"
    @click="
      (event) => {
        if (event.target === dialog) close();
      }
    "
  >
    <div class="plan-dialog-heading">
      <h2 :id="titleId">{{ content.title }}</h2>
      <button type="button" class="border-btn plan-close" :aria-label="tr('닫기')" @click="close">
        ×
      </button>
    </div>
    <div class="plan-help-content">
      <section v-for="section in content.sections" :key="section.title">
        <h3>{{ section.title }}</h3>
        <p>{{ section.text }}</p>
      </section>
    </div>
    <button type="button" class="solid" @click="close">{{ tr('확인했어요') }}</button>
  </dialog>
</template>
