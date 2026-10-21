<template>
  <span class="status-pill" :data-tone="tone"><slot /></span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'neutral' | 'success' | 'danger' | 'warning' }>(), {
  tone: 'neutral',
});
</script>
