<script setup lang="ts">
const { tr } = useLocale();

const props = withDefaults(defineProps<{ image?: string }>(), {
  image: '/images/cat-sleeping.png',
});
</script>
<template>
  <div class="empty">
    <img :src="props.image" alt="" loading="lazy" decoding="async" />
    <p>
      <slot>{{ tr('아직 등록된 항목이 없어요.') }}</slot>
    </p>
  </div>
</template>
