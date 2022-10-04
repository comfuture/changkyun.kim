<template>
  <div class="ui card">
    <slot name="header"></slot>
    <slot></slot>
  </div>
</template>
<script lang="ts">
export default {
  name: 'ui-card'
}
</script>
<style lang="postcss">
.ui.card {
  @apply bg-white shadow-md rounded-md;
}
</style>
