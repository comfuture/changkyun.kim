<script setup lang="ts">
const props = defineProps<{
  active?: boolean
}>()
const emit = defineEmits(['change'])
const active = ref<boolean>(props.active)
const toggleMenu = () => {
  active.value = !active.value
  emit('change')
}
onMounted(() => {
  document.body.addEventListener('click', (e) => {
    const burger = (e.target as HTMLElement).closest('.active.hamburger')
    if (!burger) {
      active.value = false
      emit('change')
    }
  })
})
</script>
<template>
  <button :class="['hamburger', { active }]" @click="toggleMenu">
    <span class="sr-only">Menu</span>
    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
    </svg>
  </button>
</template>
<style lang="postcss">
button.hamburger {
  @apply inline-block md:hidden;
}
</style>
