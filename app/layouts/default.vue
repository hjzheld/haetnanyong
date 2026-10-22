<script setup lang="ts">
const { tr } = useLocale();

import { errorText } from '~/utils/display';
const { user, logout } = useSession(),
  error = ref(''),
  logoutBusy = ref(false);
const links = [
  { to: '/', label: '홈' },
  { to: '/plans', label: '플랜' },
  { to: '/calendar', label: '캘린더' },
  { to: '/reminders', label: '리마인더' },
  { to: '/mypage', label: '마이페이지' },
];
const config = useRuntimeConfig();
const route = useRoute();
function activeLink(to: string) {
  if (to === '/plans')
    return ['/plans', '/projects', '/items'].some(
      (path) => route.path === path || route.path.startsWith(path + '/'),
    );
  return to === '/' ? route.path === '/' : route.path === to || route.path.startsWith(to + '/');
}
const mobileMenuOpen = ref(false);
const menuButton = ref<HTMLButtonElement>();
watch(
  () => route.fullPath,
  () => {
    mobileMenuOpen.value = false;
  },
);
watch(user, () => {
  mobileMenuOpen.value = false;
});
function closeMobileMenu() {
  if (!mobileMenuOpen.value) return;
  mobileMenuOpen.value = false;
  menuButton.value?.focus();
}
async function signOut() {
  if (logoutBusy.value) return;
  logoutBusy.value = true;
  try {
    await logout();
  } catch (e) {
    error.value = errorText(e, 'logout');
  } finally {
    logoutBusy.value = false;
  }
}
</script>
<template>
  <div
    id="pdesk"
    :class="{ 'is-logged-out': !user, 'landing-shell': $route.path === '/' && !user }"
  >
    <header
      v-if="user"
      :class="{ 'mobile-menu-open': mobileMenuOpen }"
      @keydown.esc="closeMobileMenu"
    >
      <NuxtLink to="/" class="logo"
        ><span class="logo-mark"><img src="/images/paw-pad.png" alt="" /></span
        >{{ tr('했냐옹') }}</NuxtLink
      >
      <button
        ref="menuButton"
        type="button"
        class="mobile-menu-toggle"
        :aria-expanded="mobileMenuOpen"
        aria-controls="primary-navigation account-navigation"
        :aria-label="mobileMenuOpen ? tr('메뉴 닫기') : tr('메뉴 열기')"
        @click="mobileMenuOpen = !mobileMenuOpen"
      >
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path v-if="mobileMenuOpen" d="m6 6 12 12M6 18 18 6" />
          <path v-else d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span>{{ mobileMenuOpen ? tr('닫기') : tr('메뉴') }}</span>
      </button>
      <nav id="primary-navigation" :aria-label="tr('주요 메뉴')">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          @click="mobileMenuOpen = false"
          :aria-current="activeLink(link.to) ? 'page' : undefined"
          :class="{
            selected: activeLink(link.to),
          }"
          >{{ tr(link.label) }}</NuxtLink
        >
      </nav>
      <div id="account-navigation" class="profile">
        <span class="avatar">{{ user?.nickname.slice(0, 1) }}</span
        ><span class="small">{{ user?.nickname }} {{ tr('님') }}</span
        ><button
          class="logout-button"
          :disabled="logoutBusy"
          :aria-busy="logoutBusy"
          @click="signOut"
        >
          {{ logoutBusy ? tr('로그아웃 중…') : tr('로그아웃') }}
        </button>
      </div>
    </header>
    <main>
      <p v-if="error" role="alert" class="form-error">{{ tr(error) }}</p>
      <div v-if="['/login', '/slack/callback'].includes($route.path)" class="page-help-toolbar">
        <CommonPageHelp />
      </div>
      <slot />
    </main>
    <footer class="site-footer">
      <span>© {{ new Date().getFullYear() }} {{ tr('했냐옹') }}</span>
      <nav :aria-label="tr('서비스 안내')">
        <NuxtLink to="/privacy">{{ tr('개인정보처리방침') }}</NuxtLink>
        <NuxtLink to="/terms">{{ tr('이용약관') }}</NuxtLink>
        <a
          v-if="config.public.supportFormUrl"
          :href="config.public.supportFormUrl"
          target="_blank"
          rel="noopener noreferrer"
          >{{ tr('문의하기') }}</a
        >
        <a
          v-if="config.public.githubIssuesUrl"
          :href="config.public.githubIssuesUrl"
          target="_blank"
          rel="noopener noreferrer"
          >{{ tr('버그 제보') }}</a
        >
      </nav>
    </footer>
  </div>
</template>
