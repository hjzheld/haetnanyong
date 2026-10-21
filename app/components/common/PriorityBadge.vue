<script setup lang="ts">
import { labels } from '~/utils/display';
defineProps<{ priority: string }>();
const { tr } = useLocale();
</script>
<template>
  <span class="priority-badge" :data-priority="priority">{{ tr(labels[priority] || '보통') }}</span>
</template>
