<script setup lang="ts">
useHead({ title: '했냐옹 · 오늘도 하나씩' });
definePageMeta({
  middleware: async () => {
    await useSession().restore();
  },
});
const { user } = useSession();
</script>
<template>
  <WorkspaceView v-if="user" view="home" />
  <div v-else class="landing-page">
    <section class="landing-hero">
      <div class="landing-copy">
        <h1>깜빡하는 하루에,<br /><span>작은 발자국 하나.</span></h1>
        <p class="landing-lead">
          할 일과 약속을 한곳에 모아두고<br />오늘 해야 할 일을 가볍게 챙겨보세요.
        </p>
        <div class="landing-actions">
          <NuxtLink class="landing-primary" to="/login?mode=register"
            >무료로 시작하기 <span aria-hidden="true">→</span></NuxtLink
          ><NuxtLink class="landing-secondary" to="/login?mode=login">로그인</NuxtLink>
        </div>
        <p class="landing-caption">나만의 일정과 프로젝트를 차근차근 기록해요.</p>
      </div>
      <div class="landing-visual">
        <div class="landing-orbit orbit-one"></div>
        <div class="landing-orbit orbit-two"></div>
        <div class="landing-visual-card">
          <img src="/images/cat-stretching.png" alt="발바닥을 들고 기지개 켜는 했냐옹" /><span
            class="landing-note note-one"
            >오늘도 하나씩 ✦</span
          ><span class="landing-note note-two">잊지 않게 챙겨줄게!</span>
        </div>
      </div>
    </section>
    <section id="features" class="landing-features">
      <div class="landing-section-title">
        <h2>복잡한 계획은 가볍게,<br />잊기 쉬운 일은 꼼꼼하게.</h2>
        <p>프로젝트부터 일정 알림까지, 했냐옹이 한곳에서 정리해요.</p>
      </div>
      <div class="feature-grid">
        <article v-reveal="0" class="feature-card feature-project">
          <div class="feature-card-head">
            <span class="feature-icon"
              ><svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path
                  d="M3.75 6.75A2.25 2.25 0 0 1 6 4.5h4.2l2.1 2.25H18a2.25 2.25 0 0 1 2.25 2.25v8.25A2.25 2.25 0 0 1 18 19.5H6a2.25 2.25 0 0 1-2.25-2.25z"
                />
                <path d="M3.75 9h16.5" /></svg></span
            ><span class="feature-kind">프로젝트</span>
          </div>
          <div class="feature-card-copy">
            <h3>프로젝트별로 모아보기</h3>
            <p>일과 생활의 할 일을 프로젝트로 나눠 한눈에 살펴봐요.</p>
          </div>
          <div class="feature-mini-lines"><i></i><i></i><i></i></div>
        </article>
        <article v-reveal="1" class="feature-card feature-task">
          <div class="feature-card-head">
            <span class="feature-icon"
              ><svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="m8.25 12.75 2.5 2.5 5-6" />
                <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /></svg></span
            ><span class="feature-kind">태스크</span>
          </div>
          <div class="feature-card-copy">
            <h3>오늘 할 일을 차근차근</h3>
            <p>시작일과 마감일을 정하고, 끝낸 일은 체크해요.</p>
          </div>
          <div class="feature-mini-checks">
            <i>✓</i><i></i><i></i><span></span><span></span><span></span>
          </div>
          <img
            src="/images/cat-loaf.png"
            alt="식빵처럼 포근하게 엎드린 고양이"
            loading="lazy"
            decoding="async"
          />
        </article>
        <article v-reveal="2" class="feature-card feature-calendar">
          <div class="feature-card-head">
            <span class="feature-icon"
              ><svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M7.5 3.75v3m9-3v3M4.5 9h15" />
                <rect x="4.5" y="5.25" width="15" height="15" rx="2.25" />
                <path d="m8.25 14.25 2.25 2.25 5.25-5.25" /></svg></span
            ><span class="feature-kind">일정</span>
          </div>
          <div class="feature-card-copy">
            <h3>약속은 캘린더와 알림으로</h3>
            <p>월간 캘린더에서 일정을 보고, Slack DM으로 알림을 받아요.</p>
          </div>
          <div class="feature-calendar-grid">
            <i>일</i><i>월</i><i>화</i><i>수</i><i>목</i><i>금</i><i>토</i><i></i><i></i><i>●</i
            ><i></i><i>●</i><i></i><i></i>
          </div>
        </article>
      </div>
    </section>
    <section v-reveal class="landing-cta">
      <img
        src="/images/cat-sleeping.png"
        alt="포근하게 잠든 고양이"
        loading="lazy"
        decoding="async"
      />
      <div>
        <h2>잊지 말고, 오늘도 했냐옹?</h2>
        <p>작은 기록 하나부터 함께 시작해요.</p>
      </div>
      <NuxtLink class="landing-primary" to="/login?mode=register"
        >내 일정 챙기기 <span aria-hidden="true">→</span></NuxtLink
      >
    </section>
    <footer class="landing-footer"><span>했냐옹</span><span>작은 할 일부터 차근차근.</span></footer>
  </div>
</template>
