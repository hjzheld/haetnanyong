<script setup lang="ts">
import type { Project, Task } from '~/types/workspace';
const props = defineProps<{ project: Project; tasks: Task[]; eventCount: number }>();
const done = computed(() => props.tasks.filter((t) => t.status === 'DONE').length),
  rate = computed(() =>
    props.tasks.length ? Math.round((done.value / props.tasks.length) * 100) : 0,
  );
</script>
<template>
  <NuxtLink v-reveal :to="`/projects/${project.id}`" class="project"
    ><div class="between">
      <span class="dot" :style="{ background: project.color }" /><span class="badge">{{
        project.archivedAt ? '보관됨' : '진행 중'
      }}</span>
    </div>
    <div>
      <h3>{{ project.name }}</h3>
      <p class="small">{{ project.description || '작은 목표부터 하나씩.' }}</p>
    </div>
    <div>
      <div class="between small">
        <span>태스크 {{ done }} / {{ tasks.length }} 완료</span><strong>{{ rate }}%</strong>
      </div>
      <div class="bar"><span :style="{ width: rate + '%' }" /></div>
    </div>
    <div class="project-foot">
      태스크 {{ tasks.length }}개 · 일정 {{ eventCount }}개 <span>열기 →</span>
    </div></NuxtLink
  >
</template>
