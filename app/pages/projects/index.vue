<script setup lang="ts">
const { tr } = useLocale();

definePageMeta({ middleware: 'auth' });
useHead(() => ({ title: tr('프로젝트 · 했냐옹') }));
</script>
<template><WorkspaceView view="projects" /></template>
