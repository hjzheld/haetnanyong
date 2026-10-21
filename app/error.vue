<script setup lang="ts">
import type { NuxtError } from '#app';

const props = defineProps<{ error: NuxtError }>();
const { user, restore } = useSession();
useSeoMeta({ robots: 'noindex, nofollow' });

await restore().catch(() => undefined);

const isNotFound = computed(() => props.error.statusCode === 404);
const destination = computed(() => (user.value ? '/' : '/login'));
const buttonLabel = computed(() => (user.value ? '홈으로 돌아가기' : '로그인하러 가기'));

function leaveErrorPage() {
  return clearError({ redirect: destination.value });
}
</script>

<template>
  <div id="pdesk" class="is-logged-out error-screen">
    <main class="error-card">
      <img src="/images/cat.png" alt="길을 잃은 했냐옹 고양이" />
      <p class="error-code">{{ error.statusCode }}</p>
      <h1>{{ isNotFound ? '페이지를 찾지 못했어요' : '잠시 문제가 생겼어요' }}</h1>
      <p>
        {{
          isNotFound
            ? '주소가 잘못되었거나 페이지가 이동되었을 수 있어요.'
            : '잠시 후 다시 시도해주세요.'
        }}
      </p>
      <div class="error-actions">
        <button class="solid" @click="leaveErrorPage">{{ buttonLabel }}</button>
        <button v-if="!user" class="border-btn" @click="clearError({ redirect: '/' })">
          소개 페이지 보기
        </button>
      </div>
    </main>
  </div>
</template>
