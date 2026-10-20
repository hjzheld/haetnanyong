<script setup lang="ts">
const config = useRuntimeConfig()
const today = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'full',
  timeZone: config.public.timezone,
}).format(new Date())
</script>

<template>
  <main class="shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">PERSONAL WORKSPACE</p>
        <h1>{{ config.public.appName }}</h1>
      </div>
      <span class="date-chip">{{ today }}</span>
    </header>

    <section class="hero-grid">
      <article class="hero-card">
        <p class="eyebrow">TODAY</p>
        <h2>오늘의 흐름을 한곳에서 관리하세요.</h2>
        <p class="muted">프로젝트, 업무, 일정과 Slack 리마인더를 개인 소유 범위로 안전하게 연결합니다.</p>
        <div class="actions">
          <button class="button primary" type="button">업무 추가</button>
          <button class="button secondary" type="button">일정 추가</button>
        </div>
      </article>

      <aside class="stat-card">
        <span class="stat-label">완료율</span>
        <strong>0%</strong>
        <span class="muted">아직 등록된 업무가 없습니다.</span>
      </aside>
    </section>

    <section class="section-heading">
      <div>
        <p class="eyebrow">OVERVIEW</p>
        <h2>대시보드</h2>
      </div>
      <span class="status-pill">준비 중</span>
    </section>

    <section class="empty-grid">
      <article v-for="item in ['오늘 일정', '임박한 업무', '프로젝트']" :key="item" class="empty-card">
        <div class="icon-dot" />
        <h3>{{ item }}</h3>
        <p class="muted">API 연결 후 개인 데이터가 표시됩니다.</p>
      </article>
    </section>
  </main>
</template>
