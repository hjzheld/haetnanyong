<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  redirect: (to) => ({ path: '/plans', query: { ...to.query, tab: 'individual' } }),
});
</script>
<template><span /></template>
