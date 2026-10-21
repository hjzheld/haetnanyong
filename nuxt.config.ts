import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  modules: ['@sentry/nuxt/module'],
  sourcemap: { client: 'hidden', server: true },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  routeRules: {
    '/images/**': { headers: { 'Cache-Control': 'public, max-age=86400' } },
  },
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/png', href: '/images/favicon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Gowun+Dodum&display=swap',
        },
      ],
    },
  },
  // Nuxt 4의 `~`는 app/을 가리키므로 프로젝트 루트 assets는 `~~`를 사용합니다.
  css: [
    '~~/assets/css/frontend.css',
    '~~/assets/css/workspace.css',
    '~~/assets/css/depth.css',
    '~~/assets/css/account.css',
    '~~/assets/css/items.css',
    '~~/assets/css/calendar.css',
    '~~/assets/css/landing.css',
    '~~/assets/css/feedback.css',
    '~~/assets/css/layout-fixes.css',
    '~~/assets/css/mobile-header.css',
  ],
  typescript: {
    strict: true,
    // 개발 서버가 vue-tsc 미설치로 중단되지 않도록 타입 검사는 별도 명령으로 실행합니다.
    typeCheck: false,
  },
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
    sessionSecret: process.env.SESSION_SECRET || '',
    slackBotToken: process.env.SLACK_BOT_TOKEN || '',
    slackDmChannelId: process.env.SLACK_DM_CHANNEL_ID || '',
    cronSecret: process.env.CRON_SECRET || '',
    public: {
      appName: '개인 일정·리마인더',
      timezone: 'Asia/Seoul',
      supportFormUrl: process.env.NUXT_PUBLIC_SUPPORT_FORM_URL || '',
      githubIssuesUrl: process.env.NUXT_PUBLIC_GITHUB_ISSUES_URL || '',
    },
  },
  sentry: {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  },
});
