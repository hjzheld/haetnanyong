<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
useHead({ title: '프로젝트 · 했냐옹' });
</script>
<template><WorkspaceView view="projects" /></template>
