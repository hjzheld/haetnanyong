<script setup lang="ts">
const { tr, formatTime } = useLocale();

import type { Task, ScheduleEvent } from '~/types/workspace';
import { datePart, labels, errorText } from '~/utils/display';
definePageMeta({ middleware: 'auth' });
useHead(() => ({ title: tr('일정·태스크 · 했냐옹') }));
const { request } = useApi();
const { data, pending, status, error, refresh } = useAsyncData(
  'standalone-items',
  () =>
    request<{ tasks: Task[]; events: ScheduleEvent[] }>('/api/items', {
      query: { scope: 'standalone' },
    }),
  { lazy: true },
);
const tab = ref('events');
</script>
<template>
  <CommonPageHeading
    :title="tr('일정·태스크')"
    :description="tr('프로젝트 없이 일상의 약속과 할 일을 관리해요.')"
  >
    <NuxtLink class="solid" to="/items/events/new">{{ tr('+ 일정 등록') }}</NuxtLink
    ><NuxtLink class="border-btn" to="/items/tasks/new">{{ tr('+ 태스크 등록') }}</NuxtLink>
  </CommonPageHeading>
  <p v-if="pending || status === 'idle'" role="status">{{ tr('불러오는 중…') }}</p>
  <section v-else-if="error" class="panel" role="alert">
    {{ tr(errorText(error, 'load')) }} <button @click="refresh()">{{ tr('다시 시도') }}</button>
  </section>
  <template v-else-if="data">
    <div class="subnav">
      <button :aria-pressed="tab === 'events'" @click="tab = 'events'">
        {{ tr('일정') }} {{ data.events.length }}</button
      ><button :aria-pressed="tab === 'tasks'" @click="tab = 'tasks'">
        {{ tr('태스크') }} {{ data.tasks.length }}
      </button>
    </div>
    <section class="panel">
      <template v-if="tab === 'events'"
        ><NuxtLink
          v-for="e in data.events"
          :key="e.id"
          :to="`/items/events/${e.id}`"
          class="list-row colored-item"
          :style="{ '--item-color': e.color }"
        >
          <div class="grow">
            <strong>{{ e.title }}</strong>
            <p class="small">
              {{
                e.allDay
                  ? datePart(e.startDate) + ' ~ ' + datePart(e.endDate) + tr(' (종료일 제외)')
                  : formatTime(e.startsAt) + ' ~ ' + formatTime(e.endsAt)
              }}
            </p>
          </div>
          <span>{{ tr('상세 보기 →') }}</span> </NuxtLink
        ><CommonEmptyState v-if="!data.events.length">{{
          tr('아직 일정이 없어요. 새 일정을 등록해보세요.')
        }}</CommonEmptyState></template
      >
      <template v-else
        ><NuxtLink
          v-for="t in data.tasks"
          :key="t.id"
          :to="`/items/tasks/${t.id}`"
          class="list-row colored-item"
          :style="{ '--item-color': t.color }"
        >
          <div class="grow">
            <strong :class="{ done: t.status === 'DONE' }">{{ t.title }}</strong>
            <p class="small">
              {{ datePart(t.startDate) }} ~ {{ datePart(t.dueDate) }} · {{ tr(labels[t.priority]) }}
            </p>
          </div>
          <span class="badge">{{ tr(labels[t.status]) }}</span> </NuxtLink
        ><CommonEmptyState v-if="!data.tasks.length">{{
          tr('아직 태스크가 없어요. 새 할 일을 등록해보세요.')
        }}</CommonEmptyState></template
      >
    </section></template
  >
</template>
