<script setup lang="ts">
const { tr } = useLocale();

definePageMeta({ middleware: 'auth' });
useHead(() => ({ title: tr('캘린더 · 했냐옹') }));
</script>
<template><WorkspaceView view="calendar" /></template>
