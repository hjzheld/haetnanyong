<script setup lang="ts">
const { tr } = useLocale();

definePageMeta({ middleware: 'auth' });
useHead(() => ({ title: tr('리마인더 · 했냐옹') }));
</script>
<template><WorkspaceView view="reminders" /></template>
