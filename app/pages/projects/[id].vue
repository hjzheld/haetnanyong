<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
const route = useRoute();
useHead({ title: '프로젝트 상세 · 했냐옹' });
</script>
<template>
  <WorkspaceView
    :key="String(route.params.id)"
    view="detail"
    :project-id="String(route.params.id)"
  />
</template>
