<script setup lang="ts">
import type { User } from '~/types/workspace';
import { errorText, showTime } from '~/utils/display';
definePageMeta({ middleware: 'auth' });
useHead({ title: '마이페이지 · 했냐옹' });
const { user, setUser } = useSession();
const { request } = useApi();
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
const memberId = ref(''),
  code = ref(''),
  sent = ref(false);
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
async function sendCode() {
  if (slackBusy.value) return;
  slackBusy.value = true;
  connectionError.value = '';
  slackNotice.value = '';
  try {
    await request('/api/account/slack/challenge', {
      method: 'POST',
      body: { memberId: memberId.value.trim() },
    });
    sent.value = true;
    code.value = '';
    slackNotice.value = 'Slack DM으로 인증 코드를 보냈어요. 10분 안에 입력해주세요.';
  } catch (e) {
    connectionError.value = errorText(e, 'slack');
  } finally {
    slackBusy.value = false;
  }
}
async function verify() {
  if (slackBusy.value) return;
  slackBusy.value = true;
  connectionError.value = '';
  try {
    await request('/api/account/slack/verify', {
      method: 'POST',
      body: { code: code.value.trim() },
    });
    await refresh();
    sent.value = false;
    code.value = '';
    slackNotice.value = 'Slack 계정을 연결했어요.';
  } catch (e) {
    connectionError.value = errorText(e, 'slackVerify');
  } finally {
    slackBusy.value = false;
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
    sent.value = false;
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
      <section id="slack" class="panel">
        <div class="heading">
          <h2>Slack 연결</h2>
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
          <p class="small">
            했냐옹 앱이 설치된 워크스페이스에서 내 Slack 계정을 연결해요. 인증 후 일정 알림을 개인
            DM으로 받을 수 있어요.
          </p>
          <div v-if="slack.connected" class="connection-details">
            <p>워크스페이스 {{ slack.workspaceId }}</p>
            <p>멤버 {{ slack.memberId }}</p>
            <p class="small">연결일 {{ showTime(slack.connectedAt) }}</p>
            <button
              class="border-btn"
              :disabled="slackBusy"
              :aria-busy="slackBusy"
              @click="disconnect"
            >
              {{ slackBusy ? '처리 중…' : '연결 해제' }}</button
            ><NuxtLink to="/reminders" class="border-btn">리마인더 보기 →</NuxtLink>
          </div>
          <p v-if="!slack.configured" class="form-error">
            관리자가 먼저 이 서버에 Slack 앱의 봇 토큰을 설정해야 해요.
          </p>
          <template v-else
            ><ol class="slack-steps">
              <li>Slack에서 내 프로필을 열어요.</li>
              <li>더보기 메뉴에서 ‘멤버 ID 복사’를 선택해요.</li>
              <li>아래에 붙여넣고, 했냐옹 앱 DM으로 받은 코드를 입력해요.</li>
            </ol>
            <form class="account-form" @submit.prevent="sendCode">
              <label
                >Slack 멤버 ID<input
                  v-model="memberId"
                  required
                  pattern="[UWuw][A-Za-z0-9]{8,49}"
                  maxlength="50"
                  placeholder="U0123456789"
                  :disabled="slackBusy"
                  @input="sent = false"
              /></label>
              <p class="small">
                인증 코드 보내기를 누르면 입력한 멤버에게 확인용 DM 1건을 보내요. 본인의 ID를
                입력해주세요.
              </p>
              <button class="border-btn" :disabled="slackBusy" :aria-busy="slackBusy">
                {{ slackBusy ? '처리 중…' : sent ? '인증 코드 재발송' : '인증 코드 보내기' }}
              </button>
            </form>
            <form v-if="sent" class="account-form" @submit.prevent="verify">
              <label
                >DM 인증 코드<input
                  v-model="code"
                  required
                  minlength="12"
                  maxlength="12"
                  autocomplete="one-time-code"
                  placeholder="12자리 인증 코드"
                  :disabled="slackBusy" /></label
              ><button class="solid" :disabled="slackBusy" :aria-busy="slackBusy">
                {{ slackBusy ? '연결 확인 중…' : '연결 확인' }}
              </button>
            </form>
          </template>
          <p class="small">
            예약 중이거나 결과 확인이 필요한 알림이 있으면 먼저 리마인더에서 정리한 뒤 연결을
            변경해주세요.
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
