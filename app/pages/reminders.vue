<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
useHead({ title: '리마인더 · 했냐옹' });
</script>
<template><WorkspaceView view="reminders" /></template>
