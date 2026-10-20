import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // Nuxt 4의 `~`는 app/을 가리키므로 프로젝트 루트 assets는 `~~`를 사용합니다.
  css: ['~~/assets/css/main.css'],
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
    public: {
      appName: '개인 일정·리마인더',
      timezone: 'Asia/Seoul',
    },
  },
})
