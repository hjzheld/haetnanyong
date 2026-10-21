<script setup lang="ts">
import type { Project } from '~/types/workspace';
defineProps<{ project?: Project }>();
</script>

<template>
  <div v-if="project" class="reminder-project">
    <NuxtLink :to="`/projects/${project.id}?tab=events`" class="reminder-project-badge">
      <span
        class="reminder-project-dot"
        :style="{ backgroundColor: project.color }"
        aria-hidden="true"
      />
      <span>{{ project.name }}</span>
    </NuxtLink>
  </div>
</template>
