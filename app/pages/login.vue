<script setup lang="ts">
const { tr } = useLocale();

import type { User } from '~/types/workspace';
import { errorText } from '~/utils/display';
import { safeInternalRedirect } from '~/utils/navigation';
definePageMeta({ layout: false, middleware: 'guest' });
useHead(() => ({ title: tr('로그인 · 했냐옹') }));
const { setUser } = useSession();
const route = useRoute();
const register = ref(route.query.mode === 'register'),
  email = ref(''),
  password = ref(''),
  nickname = ref(''),
  busy = ref(false),
  error = ref('');
async function submit() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const result = await $fetch<{ user: User }>(
      `/api/auth/${register.value ? 'register' : 'login'}`,
      {
        method: 'POST',
        timeout: 20000,
        body: {
          email: email.value.trim(),
          password: password.value,
          ...(register.value && nickname.value.trim() ? { nickname: nickname.value.trim() } : {}),
        },
      },
    );
    setUser(result.user);
    await navigateTo(safeInternalRedirect(route.query.redirect), { replace: true });
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    error.value =
      status === 401
        ? '이메일 또는 비밀번호를 다시 확인해주세요.'
        : status === 409
          ? '이미 사용 중인 이메일 또는 닉네임이에요. 다른 정보로 시도해주세요.'
          : status && status >= 500
            ? '잠시 연결이 원활하지 않아요. 조금 뒤에 다시 시도해주세요.'
            : errorText(e, register.value ? 'register' : 'login');
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div id="pdesk" class="is-logged-out">
    <section class="login-screen">
      <div class="login-card">
        <img class="login-cat" src="/images/cat.png" :alt="tr('했냐옹 고양이')" />
        <h1>{{ tr('잊지 말고, 오늘도 했냐옹') }}</h1>
        <form class="auth-form" :aria-busy="busy" @submit.prevent="submit">
          <h2>{{ register ? tr('회원가입') : tr('로그인') }}</h2>
          <fieldset :disabled="busy" class="auth-fields">
            <label
              >{{ tr('이메일')
              }}<input
                v-model="email"
                type="email"
                required
                maxlength="254"
                autocomplete="email"
                :placeholder="tr('이메일 주소를 입력해주세요')"
            /></label>
            <label
              >{{ tr('비밀번호')
              }}<input
                v-model="password"
                type="password"
                required
                :minlength="register ? 8 : 1"
                maxlength="200"
                :autocomplete="register ? 'new-password' : 'current-password'"
                :placeholder="
                  register ? tr('8자 이상 입력해주세요') : tr('비밀번호를 입력해주세요')
                "
            /></label>
            <label v-if="register"
              >{{ tr('닉네임 (선택)')
              }}<input
                v-model="nickname"
                minlength="2"
                maxlength="30"
                :placeholder="tr('비워두면 귀여운 닉네임을 만들어드려요')"
                autocomplete="nickname"
            /></label>
          </fieldset>
          <p v-if="error" role="alert" class="form-error">{{ tr(error) }}</p>
          <button class="login-button" :disabled="busy" :aria-busy="busy">
            {{
              busy
                ? register
                  ? tr('가입 중…')
                  : tr('로그인 중…')
                : register
                  ? tr('가입하고 시작하기')
                  : tr('로그인')
            }}
          </button>
          <div v-if="busy" class="request-progress" aria-hidden="true"><span /></div>
          <p class="auth-status" role="status" aria-live="polite">
            {{
              busy
                ? register
                  ? tr('계정을 만들고 있어요. 잠시만 기다려주세요.')
                  : tr('로그인 정보를 확인하고 있어요. 잠시만 기다려주세요.')
                : ''
            }}
          </p>
          <button
            type="button"
            class="switch-auth"
            :disabled="busy"
            @click="
              register = !register;
              error = '';
            "
          >
            <span>{{ register ? tr('이미 가입된 계정이 있나요?') : tr('처음이신가요?') }}</span
            ><strong>{{ register ? tr('로그인') : tr('회원가입') }}</strong>
          </button>
          <NuxtLink
            class="login-intro-link"
            to="/"
            :aria-disabled="busy"
            @click="busy && $event.preventDefault()"
            ><span aria-hidden="true">←</span><span>{{ tr('소개페이지 보기') }}</span></NuxtLink
          >
        </form>
      </div>
    </section>
  </div>
</template>
