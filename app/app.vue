<script setup lang="ts">
const requestUrl = useRequestURL();
const route = useRoute();
const { online } = useNetworkStatus();
const ogImage = new URL('/images/og-image.jpg', requestUrl.origin).href;
const pageUrl = computed(() => new URL(route.path, requestUrl.origin).href);
const isPublicPage = computed(() => route.path === '/');
const title = '🐱 했냐옹 | 오늘 할 일과 리마인드를 한곳에';
const description = '작은 일정부터 반복되는 약속까지, 잊지 않도록 했냐옹이 꼼꼼하게 챙겨줄게옹.';

useSeoMeta({
  description,
  robots: () => (isPublicPage.value ? 'index, follow' : 'noindex, nofollow'),
  ogTitle: title,
  ogDescription: description,
  ogImage,
  ogImageAlt: '했냐옹 서비스 미리보기',
  ogImageType: 'image/png',
  ogImageWidth: 1731,
  ogImageHeight: 909,
  ogUrl: () => pageUrl.value,
  ogSiteName: '했냐옹',
  ogType: 'website',
  ogLocale: 'ko_KR',
  twitterCard: 'summary_large_image',
  twitterTitle: title,
  twitterDescription: description,
  twitterImage: ogImage,
  twitterImageAlt: '했냐옹 서비스 미리보기',
});

useHead(() => ({
  link: isPublicPage.value ? [{ rel: 'canonical', href: pageUrl.value }] : [],
}));
</script>

<template>
  <NuxtLoadingIndicator color="#9b8bad" :height="3" :throttle="120" />
  <ClientOnly
    ><p v-if="!online" class="offline-banner" role="alert">
      인터넷 연결이 끊겼어요. 연결되면 다시 시도해주세요.
    </p></ClientOnly
  >
  <NuxtLayout><NuxtPage /></NuxtLayout>
</template>
