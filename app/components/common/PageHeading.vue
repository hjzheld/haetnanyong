<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>
<template>
  <div class="workspace-top">
    <div>
      <h1>{{ title }}</h1>
      <p class="small">{{ description }}</p>
    </div>
    <div class="actions"><slot /></div>
  </div>
</template>
