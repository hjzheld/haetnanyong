<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
</script>
<template><WorkspaceStandalonePage :key="$route.fullPath" mode="edit" /></template>
