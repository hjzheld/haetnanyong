<script setup lang="ts">
import type { User } from '~/types/workspace';
import { errorText, showTime } from '~/utils/display';
definePageMeta({ middleware: 'auth' });
useHead({ title: '마이페이지 · 했냐옹' });
const { user, setUser } = useSession();
const { request } = useApi();
async function connectSlackOAuth() {
  if (slackBusy.value) return;
  slackBusy.value = true;
  connectionError.value = '';
  try {
    const { url } = await request<{ url: string }>('/api/account/slack/start', { method: 'POST' });
    window.location.assign(url);
  } catch (error) {
    connectionError.value = errorText(error, 'slack');
    slackBusy.value = false;
  }
}
const profile = reactive({ email: user.value?.email || '', nickname: user.value?.nickname || '' });
const {
  data: slack,
  error: slackError,
  status: slackStatus,
  refresh,
} = useSlackConnection({ lazy: true });
const profileBusy = ref(false),
  slackBusy = ref(false),
  profileError = ref(''),
  connectionError = ref(''),
  profileNotice = ref(''),
  slackNotice = ref(''),
  disconnectConfirm = ref(false);
const passwordDialog = ref(false),
  password = reactive({ current: '', next: '', confirmation: '' }),
  passwordBusy = ref(false),
  passwordError = ref('');
const sessionBusy = ref(false);
const deleteDialog = ref(false),
  deletePassword = ref(''),
  deleteBusy = ref(false),
  deleteError = ref('');
const passwordModal = ref<HTMLDialogElement>(),
  profilePassword = ref(''),
  deleteModal = ref<HTMLDialogElement>();
const emailChanged = computed(() => profile.email.trim().toLowerCase() !== user.value?.email);
watch(passwordDialog, async (open) => {
  await nextTick();
  if (open) passwordModal.value?.showModal();
  else {
    passwordModal.value?.close();
    password.current = '';
    password.next = '';
    password.confirmation = '';
    passwordError.value = '';
  }
});
watch(deleteDialog, async (open) => {
  await nextTick();
  if (open) deleteModal.value?.showModal();
  else {
    deleteModal.value?.close();
    deletePassword.value = '';
    deleteError.value = '';
  }
});
const passwordMismatch = computed(
  () => Boolean(password.confirmation) && password.next !== password.confirmation,
);
async function saveProfile() {
  if (profileBusy.value) return;
  profileError.value = '';
  profileNotice.value = '';
  profileBusy.value = true;
  try {
    const result = await request<{ user: User }>('/api/account/profile', {
      method: 'PATCH',
      body: {
        email: profile.email.trim(),
        nickname: profile.nickname.trim(),
        ...(emailChanged.value ? { currentPassword: profilePassword.value } : {}),
      },
    });
    setUser(result.user);
    profile.email = result.user.email;
    profile.nickname = result.user.nickname;
    profilePassword.value = '';
    profileNotice.value = '회원 정보를 저장했어요.';
  } catch (e) {
    profileError.value = errorText(e, 'profile');
  } finally {
    profileBusy.value = false;
  }
}
async function changePassword() {
  if (passwordBusy.value) return;
  passwordError.value = '';
  if (password.next !== password.confirmation) {
    passwordError.value = '새 비밀번호와 확인이 일치하지 않습니다.';
    return;
  }
  passwordBusy.value = true;
  try {
    await request('/api/account/password', {
      method: 'PATCH',
      body: { currentPassword: password.current, newPassword: password.next },
    });
    password.current = '';
    password.next = '';
    password.confirmation = '';
    passwordDialog.value = false;
    profileNotice.value = '비밀번호를 변경했어요.';
  } catch (e) {
    passwordError.value = errorText(e, 'password');
  } finally {
    passwordBusy.value = false;
  }
}
async function revokeOtherSessions() {
  if (sessionBusy.value) return;
  sessionBusy.value = true;
  profileError.value = '';
  profileNotice.value = '';
  try {
    const result = await request<{ revokedCount: number }>('/api/account/sessions', {
      method: 'DELETE',
    });
    profileNotice.value = result.revokedCount
      ? `다른 기기 ${result.revokedCount}곳에서 로그아웃했어요.`
      : '로그인된 다른 기기가 없어요.';
  } catch (e) {
    profileError.value = errorText(e, 'profile');
  } finally {
    sessionBusy.value = false;
  }
}
async function disconnect() {
  if (!slackBusy.value) disconnectConfirm.value = true;
}
async function confirmDisconnect() {
  if (slackBusy.value) return;
  slackBusy.value = true;
  connectionError.value = '';
  try {
    await request('/api/account/slack', { method: 'DELETE' });
    await refresh();
    disconnectConfirm.value = false;
    slackNotice.value = '연결을 해제했어요.';
  } catch (e) {
    connectionError.value = errorText(e, 'slack');
  } finally {
    slackBusy.value = false;
  }
}
async function deleteAccount() {
  if (deleteBusy.value) return;
  deleteBusy.value = true;
  deleteError.value = '';
  try {
    await request('/api/account', { method: 'DELETE', body: { password: deletePassword.value } });
    setUser(null);
    clearNuxtData();
    await navigateTo('/?withdrawn=1', { replace: true });
  } catch (e) {
    deleteError.value = errorText(e, 'delete');
  } finally {
    deleteBusy.value = false;
  }
}
</script>
<template>
  <div class="page-tone-account">
    <CommonPageHeading
      title="마이페이지"
      description="내 정보와 알림을 받을 Slack 계정을 관리해요."
    />
    <div class="account-grid">
      <section class="panel">
        <div class="heading">
          <h2>내 정보</h2>
          <span class="badge lavender">{{ user?.nickname }}</span>
        </div>
        <form class="account-form" @submit.prevent="saveProfile">
          <fieldset :disabled="profileBusy">
            <label
              >이메일<input
                v-model="profile.email"
                type="email"
                required
                readonly
                maxlength="254"
                autocomplete="email"
            /></label>
            <label
              >닉네임<input
                v-model="profile.nickname"
                required
                minlength="2"
                maxlength="30"
                autocomplete="nickname"
            /></label>
            <p class="small">
              이메일은 인증된 계정 식별자라 현재 변경할 수 없고, 닉네임만 수정할 수 있어요.
            </p>
          </fieldset>
          <p v-if="profileError" role="alert" class="form-error">{{ profileError }}</p>
          <p v-if="profileNotice" role="status" class="notice">{{ profileNotice }}</p>
          <div class="account-actions">
            <button class="solid" :disabled="profileBusy" :aria-busy="profileBusy">
              {{ profileBusy ? '저장 중…' : '회원 정보 저장' }}</button
            ><button type="button" class="border-btn" @click="passwordDialog = true">
              비밀번호 변경</button
            ><button
              type="button"
              class="border-btn"
              :disabled="sessionBusy"
              :aria-busy="sessionBusy"
              @click="revokeOtherSessions"
            >
              {{ sessionBusy ? '정리 중…' : '다른 기기 모두 로그아웃' }}
            </button>
          </div>
        </form>
      </section>
      <section id="slack" class="panel slack-panel">
        <div class="heading">
          <div class="slack-brand">
            <span class="slack-brand-mark"><CommonSlackMark /></span>
            <h2>Slack 연결</h2>
          </div>
          <span class="badge" :class="{ rose: !slack?.connected }">{{
            slackStatus === 'pending' || slackStatus === 'idle'
              ? '확인 중'
              : slack?.connected
                ? '연결됨'
                : '연결 전'
          }}</span>
        </div>
        <p v-if="slackStatus === 'pending' || slackStatus === 'idle'" role="status">
          연결 상태를 불러오는 중…
        </p>
        <p v-else-if="slackError" role="alert" class="form-error">
          {{ errorText(slackError, 'slack') }}
          <button class="border-btn" @click="refresh()">다시 시도</button>
        </p>
        <template v-else-if="slack">
          <div class="slack-intro">
            <h3>
              {{
                slack.connected
                  ? '일정 알림을 받을 준비가 됐어요'
                  : '놓치기 쉬운 일정, DM으로 챙겨요'
              }}
            </h3>
            <p>
              {{
                slack.connected
                  ? '일정에서 알림 시간을 설정하면 연결된 Slack 계정으로 보내드려요.'
                  : '평소 사용하는 Slack을 연결하고, 원하는 시간에 개인 메시지로 일정 알림을 받아보세요.'
              }}
            </p>
          </div>
          <dl v-if="slack.connected" class="slack-account-details">
            <div>
              <dt>워크스페이스 ID</dt>
              <dd>{{ slack.workspaceId }}</dd>
            </div>
            <div>
              <dt>멤버 ID</dt>
              <dd>{{ slack.memberId }}</dd>
            </div>
            <div>
              <dt>연결한 날짜</dt>
              <dd>{{ showTime(slack.connectedAt) }}</dd>
            </div>
          </dl>
          <ol v-else class="slack-connect-steps" aria-label="Slack 연결 순서">
            <li><span>1</span>워크스페이스 선택</li>
            <li><span>2</span>연결 권한 승인</li>
            <li><span>3</span>일정 알림 설정</li>
          </ol>
          <p v-if="!slack.oauthConfigured" class="slack-inline-notice" role="status">
            관리자가 먼저 Slack 연결 설정을 완료해야 해요.
          </p>
          <div class="slack-actions">
            <NuxtLink v-if="slack.connected" to="/reminders" class="solid"
              >리마인더 보기 →</NuxtLink
            >
            <button
              v-if="slack.oauthConfigured"
              :class="slack.connected ? 'border-btn' : 'slack-connect-button'"
              :disabled="slackBusy"
              :aria-busy="slackBusy"
              @click="connectSlackOAuth"
            >
              <CommonSlackMark v-if="!slack.connected" />
              {{
                slackBusy
                  ? 'Slack으로 이동 중…'
                  : slack.connected
                    ? '다른 Slack 계정 연결'
                    : 'Slack 연결'
              }}
            </button>
            <button
              v-if="slack.connected"
              class="slack-disconnect"
              :disabled="slackBusy"
              @click="disconnect"
            >
              연결 해제
            </button>
          </div>
          <p class="slack-footnote">
            {{
              slack.connected
                ? '연결을 변경하거나 해제하기 전, 예약된 리마인더를 먼저 정리해주세요.'
                : '내 워크스페이스에서 연결할 수 있어요. 설치 정책에 따라 관리자 승인이 필요할 수 있어요.'
            }}
          </p>
        </template>
        <p v-if="connectionError" role="alert" class="form-error">{{ connectionError }}</p>
        <p v-if="slackNotice" role="status" class="notice">{{ slackNotice }}</p>
      </section>
    </div>
    <section class="panel danger-zone">
      <div class="heading">
        <h2>회원 탈퇴</h2>
        <span class="badge rose">되돌릴 수 없음</span>
      </div>
      <p class="small">
        계정과 일정 데이터는 즉시 삭제해요. 취소 확인이 안 된 Slack 예약은 개인정보 없이 취소
        식별정보만 잠시 보관해 재시도해요.
      </p>
      <button class="border-btn danger-button" @click="deleteDialog = true">회원 탈퇴</button>
    </section>
  </div>
  <dialog
    ref="passwordModal"
    class="password-dialog"
    aria-label="비밀번호 변경"
    @cancel.prevent="!passwordBusy && (passwordDialog = false)"
  >
    <form class="account-form" @submit.prevent="changePassword">
      <div class="heading">
        <h2>비밀번호 변경</h2>
        <button
          type="button"
          class="border-btn"
          aria-label="닫기"
          :disabled="passwordBusy"
          @click="passwordDialog = false"
        >
          ×
        </button>
      </div>
      <label
        >현재 비밀번호<input
          v-model="password.current"
          :disabled="passwordBusy"
          type="password"
          required
          autocomplete="current-password" /></label
      ><label
        >새 비밀번호<input
          v-model="password.next"
          :disabled="passwordBusy"
          type="password"
          required
          minlength="8"
          maxlength="200"
          autocomplete="new-password" /></label
      ><label
        >새 비밀번호 확인<input
          v-model="password.confirmation"
          :disabled="passwordBusy"
          type="password"
          required
          minlength="8"
          maxlength="200"
          autocomplete="new-password"
          :aria-invalid="passwordMismatch"
      /></label>
      <p v-if="passwordMismatch" role="alert" class="password-hint">
        새 비밀번호와 확인이 일치하지 않습니다.
      </p>
      <p v-if="passwordError" role="alert" class="form-error">{{ passwordError }}</p>
      <div class="actions">
        <button
          type="button"
          class="border-btn"
          :disabled="passwordBusy"
          @click="passwordDialog = false"
        >
          취소</button
        ><button
          class="solid"
          :aria-busy="passwordBusy"
          :disabled="passwordBusy || passwordMismatch || !password.next || !password.confirmation"
        >
          {{ passwordBusy ? '변경 중…' : '비밀번호 변경' }}
        </button>
      </div>
    </form>
  </dialog>
  <dialog
    ref="deleteModal"
    aria-label="회원 탈퇴"
    @cancel.prevent="!deleteBusy && (deleteDialog = false)"
  >
    <form class="account-form" @submit.prevent="deleteAccount">
      <div class="heading"><h2>정말 탈퇴할까요?</h2></div>
      <p>프로젝트, 일정, 태스크와 로그인 정보가 즉시 삭제되며 복구할 수 없어요.</p>
      <label
        >현재 비밀번호<input
          v-model="deletePassword"
          type="password"
          autocomplete="current-password"
          required
          :disabled="deleteBusy"
      /></label>
      <p v-if="deleteError" role="alert" class="form-error">{{ deleteError }}</p>
      <div class="actions">
        <button
          type="button"
          class="border-btn"
          :disabled="deleteBusy"
          @click="deleteDialog = false"
        >
          돌아가기
        </button>
        <button class="solid" :disabled="deleteBusy || !deletePassword" :aria-busy="deleteBusy">
          {{ deleteBusy ? '삭제 중…' : '계정 영구 삭제' }}
        </button>
      </div>
    </form>
  </dialog>
  <CommonConfirmDialog
    :open="disconnectConfirm"
    title="Slack 연결을 해제할까요?"
    description="새 리마인더를 예약하려면 Slack 계정을 다시 연결해야 해요. 예약 상태를 먼저 확인해주세요."
    confirm-label="연결 해제"
    :busy="slackBusy"
    @cancel="disconnectConfirm = false"
    @confirm="confirmDisconnect"
  />
</template>
