<template>
  <header class="topbar">
    <div>
      <h1>{{ title }}</h1>
    </div>
    <slot name="actions" />
  </header>
</template>

<script setup lang="ts">
defineProps<{ title: string }>();
</script>
