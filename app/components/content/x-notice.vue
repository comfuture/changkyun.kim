<template>
  <div class="x-notice">
    <slot />
  </div>
</template>
<style lang="postcss">
.x-notice {
  @apply my-3 px-2 rounded border border-blue-500 bg-blue-100 text-blue-500;
}
</style>
