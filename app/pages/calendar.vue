<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
useHead({ title: '캘린더 · 했냐옹' });
</script>
<template><WorkspaceView view="calendar" /></template>
