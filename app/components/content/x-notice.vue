<script setup lang="ts">
const props = defineProps<{
  type?: 'info' | 'success' | 'warning' | 'error'
}>()

const color = computed(() => {
  switch (props.type) {
    case 'success':
      return 'success'
    case 'warning':
      return 'warning'
    case 'error':
      return 'error'
    default:
      return 'info'
  }
})
</script>
<template>
  <UAlert :color="color" variant="subtle" class="my-3">
    <slot />
  </UAlert>
</template>
