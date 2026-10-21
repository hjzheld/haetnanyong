<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>
<template>
  <div class="workspace-top">
    <div>
      <h1>{{ title }}</h1>
      <p class="small">{{ description }}</p>
    </div>
    <div class="actions"><CommonPageHelp v-if="$route.path !== '/plans'" /><slot /></div>
  </div>
</template>
