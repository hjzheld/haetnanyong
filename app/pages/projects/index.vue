<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  redirect: (to) => ({ path: '/plans', query: { ...to.query, tab: 'projects' } }),
});
</script>
<template><span /></template>
